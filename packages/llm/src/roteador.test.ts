import { describe, expect, it } from 'vitest';
import { EXEMPLOS } from '../evals/exemplos';
import { BIBLIA_POP_BRASIL, MARI, MUNDO_ID, VIC, reator } from '../evals/pop-brasil';
import { lerConfigLlm } from './config';
import { estimarCusto } from './custo';
import { criarProvedorFalso } from './falso';
import { JOBS, NOMES_JOBS, type NomeJob } from './jobs';
import { VERSAO_PROMPTS, montarPrefixo } from './prompts';
import type { EntradasJobs } from './prompts/tipos';
import {
  ErroJsonInvalido,
  ErroLimite,
  ErroOrcamento,
  ErroProvedor,
  type PedidoGeracao,
} from './provedor';
import { chamarJob, type ChamadaLlm } from './roteador';
import { criarProvedorRoteirizado, type PassoRoteiro } from './roteirizado';
import { mundoFoiRecusado } from './schemas';

const config = lerConfigLlm({});

const diretorOk = {
  reacoes: [
    {
      personagemId: VIC.id,
      tipo: 'resposta',
      texto: 'pequeno ficou o seu alcance, querida',
      atrasoSeg: 40,
    },
  ],
  cartao: { titulo: 'A indireta pegou', texto: 'Vic respondeu em minutos e a polêmica subiu.' },
  deltasSugeridos: [{ alvo: `relacao:${VIC.id}`, valor: -3 }],
  memorias: [{ personagemId: VIC.id, fato: 'foi provocada em público pela Lua' }],
  moderacao: { ok: true },
};

function montar(passos: PassoRoteiro[], opcoes: { gasto?: () => number; teto?: number } = {}) {
  const provedor = criarProvedorRoteirizado(passos);
  const registradas: ChamadaLlm[] = [];
  const chamar = <J extends NomeJob>(
    job: J,
    entrada: EntradasJobs[J],
    biblia: string | null = BIBLIA_POP_BRASIL,
  ) =>
    chamarJob({
      job,
      mundoId: MUNDO_ID,
      biblia,
      entrada,
      provedor,
      config: { ...config, orcamentoDiarioUsd: opcoes.teto ?? config.orcamentoDiarioUsd },
      gastoHojeUsd: async () => opcoes.gasto?.() ?? 0,
      registrar: async (c) => {
        registradas.push(c);
      },
    });
  return { provedor, registradas, chamar };
}

describe('chamarJob', () => {
  it('chama o modelo do papel, valida e registra a chamada', async () => {
    const { provedor, registradas, chamar } = montar([diretorOk]);
    const { dados, chamadas } = await chamar('diretor', EXEMPLOS.diretor);

    expect(dados.reacoes[0]?.texto).toBe('pequeno ficou o seu alcance, querida');
    const enviado = provedor.pedidos[0] as PedidoGeracao;
    expect(enviado).toMatchObject({
      modelo: 'deepseek-v4.1-flash',
      maxTokens: JOBS.diretor.maxTokens,
      sessao: MUNDO_ID,
      json: true,
      sistema: montarPrefixo({ biblia: BIBLIA_POP_BRASIL }),
    });
    expect(enviado.mensagens).toHaveLength(1);
    expect(enviado.mensagens[0]?.conteudo.startsWith('JOB: diretor\n')).toBe(true);

    expect(chamadas).toEqual(registradas);
    expect(registradas).toEqual([
      {
        job: 'diretor',
        mundoId: MUNDO_ID,
        provedor: 'roteirizado',
        papel: 'diretor',
        modelo: 'deepseek-v4.1-flash',
        tentativa: 'inicial',
        tokensEntrada: 2000,
        tokensCache: 1500,
        tokensSaida: 350,
        custoUsd: estimarCusto('deepseek-v4.1-flash', { entrada: 2000, cache: 1500, saida: 350 }),
        latenciaMs: 5,
        ok: true,
        erro: null,
        versaoPrompts: VERSAO_PROMPTS,
      },
    ]);
  });

  it('usa o max_tokens e o modelo de cada job', async () => {
    const esperado: Record<NomeJob, [string, number]> = {
      diretor: ['deepseek-v4.1-flash', 1200],
      dm: ['deepseek-v4.1-flash', 500],
      discurso: ['deepseek-v4.1-flash', 900],
      criar_mundo: ['mimo-v2.6-flash', 5000],
      feed_inicial: ['mimo-v2.6-flash', 4500],
      lote_diario: ['mimo-v2.6-flash', 5000],
      memoria: ['mimo-v2.6-flash', 1200],
      ficha: ['mimo-v2.6-flash', 700],
      novo_ato: ['mimo-v2.6-flash', 1500],
    };
    const falso = criarProvedorFalso();
    for (const job of NOMES_JOBS) {
      const pedidos: PedidoGeracao[] = [];
      await chamarJob({
        job,
        mundoId: MUNDO_ID,
        biblia: job === 'criar_mundo' ? null : BIBLIA_POP_BRASIL,
        entrada: EXEMPLOS[job] as never,
        provedor: { nome: 'espiao', gerar: (p) => (pedidos.push(p), falso.gerar(p)) },
        config,
        gastoHojeUsd: async () => 0,
        registrar: async () => {},
      });
      expect([pedidos[0]?.modelo, pedidos[0]?.maxTokens]).toEqual(esperado[job]);
    }
  });

  it('na DM, figurante usa o modelo diretor e elenco o principal', async () => {
    const dmOk = {
      mensagens: ['oi, tudo certo?'],
      resumoConversa: 'conversaram rápido',
      deltaSugerido: 0,
    };
    const { provedor, chamar } = montar([dmOk, dmOk]);
    await chamar('dm', { ...EXEMPLOS.dm, personagem: reator(MARI, 'conversa') });
    await chamar('dm', EXEMPLOS.dm);
    // Os dois papéis usam o Flash hoje (decisão do dono); o teste confere o papel de cada um.
    expect(provedor.pedidos.map((p) => p.modelo)).toEqual([
      config.modelos.diretor,
      config.modelos.principal,
    ]);
  });

  it('o prefixo é o mesmo em todas as chamadas do mundo', async () => {
    const { provedor, chamar } = montar([diretorOk, { manchete: 'Lua vence', reacoes: [] }]);
    await chamar('diretor', EXEMPLOS.diretor);
    await chamar('discurso', EXEMPLOS.discurso);
    expect(provedor.pedidos[0]?.sistema).toBe(provedor.pedidos[1]?.sistema);
  });

  it('repara uma vez quando o JSON vem inválido', async () => {
    const { provedor, registradas, chamar } = montar(['{"reacoes": [', diretorOk]);
    const { dados } = await chamar('diretor', EXEMPLOS.diretor);

    expect(dados.cartao.titulo).toBe('A indireta pegou');
    const reparo = provedor.pedidos[1] as PedidoGeracao;
    expect(reparo.sistema).toBe(provedor.pedidos[0]?.sistema);
    expect(reparo.mensagens.map((m) => m.papel)).toEqual(['usuario', 'assistente', 'usuario']);
    expect(reparo.mensagens[1]?.conteudo).toBe('{"reacoes": [');
    expect(reparo.mensagens[2]?.conteudo).toMatch(/^REPARO\n.*\n- JSON malformado/);
    expect(registradas.map((c) => [c.tentativa, c.ok])).toEqual([
      ['inicial', false],
      ['reparo', true],
    ]);
    expect(registradas[0]?.erro).toMatch(/^json_invalido: /);
  });

  it('repara texto fora do limite, emoji, inglês e id inventado', async () => {
    const ruim = {
      ...diretorOk,
      reacoes: [
        { personagemId: VIC.id, tipo: 'resposta', texto: 'a'.repeat(230), atrasoSeg: 40 },
        { personagemId: VIC.id, tipo: 'resposta', texto: 'que show 🔥', atrasoSeg: 40 },
        {
          personagemId: VIC.id,
          tipo: 'resposta',
          texto: 'this is what we were waiting for',
          atrasoSeg: 40,
        },
        { personagemId: 'id-inventado', tipo: 'resposta', texto: 'olha só', atrasoSeg: 40 },
      ],
    };
    const { provedor, chamar } = montar([ruim, diretorOk]);
    await chamar('diretor', EXEMPLOS.diretor);
    const mensagem = provedor.pedidos[1]?.mensagens[2]?.conteudo ?? '';
    expect(mensagem).toContain('reacoes.0.texto');
    expect(mensagem).toContain('reacoes.1.texto: tem emoji');
    expect(mensagem).toContain('reacoes.2.texto: não está em português');
    expect(mensagem).toContain('reacoes.3.personagemId: id "id-inventado"');
  });

  it('lança ErroJsonInvalido só depois de tentar a reserva, que também repara', async () => {
    const { provedor, registradas, chamar } = montar([
      'nada de json',
      '{"ainda": "errado"}',
      'ainda sem json',
      '{"também": "errado"}',
    ]);
    const erro = await chamar('diretor', EXEMPLOS.diretor).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroJsonInvalido);
    expect((erro as ErroJsonInvalido).modelo).toBe('glm-5.3-flash');
    expect(provedor.pedidos.map((p) => p.modelo)).toEqual([
      'deepseek-v4.1-flash',
      'deepseek-v4.1-flash',
      'glm-5.3-flash',
      'glm-5.3-flash',
    ]);
    expect(registradas.map((c) => [c.papel, c.tentativa, c.ok])).toEqual([
      ['diretor', 'inicial', false],
      ['diretor', 'reparo', false],
      ['reserva', 'inicial', false],
      ['reserva', 'reparo', false],
    ]);
  });

  it('JSON inválido mesmo depois do reparo no principal: a reserva resolve', async () => {
    const { provedor, registradas, chamar } = montar([
      'nada de json',
      '{"ainda": "errado"}',
      diretorOk,
    ]);
    const { dados } = await chamar('diretor', EXEMPLOS.diretor);
    expect(dados.cartao.titulo).toBe('A indireta pegou');
    expect(provedor.pedidos.map((p) => p.modelo)).toEqual([
      'deepseek-v4.1-flash',
      'deepseek-v4.1-flash',
      'glm-5.3-flash',
    ]);
    // A reserva começa do zero: o pedido dela não leva a conversa de reparo do principal.
    expect(provedor.pedidos[2]?.mensagens).toHaveLength(1);
    expect(registradas.at(-1)).toMatchObject({ papel: 'reserva', tentativa: 'inicial', ok: true });
  });

  it('sem reserva distinta, o JSON inválido depois do reparo lança na hora', async () => {
    const provedor = criarProvedorRoteirizado(['x', '{"ainda": "errado"}']);
    const mesmo = { ...config, modelos: { ...config.modelos, reserva: config.modelos.diretor } };
    await expect(
      chamarJob({
        job: 'diretor',
        mundoId: MUNDO_ID,
        biblia: BIBLIA_POP_BRASIL,
        entrada: EXEMPLOS.diretor,
        provedor,
        config: mesmo,
        gastoHojeUsd: async () => 0,
        registrar: async () => {},
      }),
    ).rejects.toBeInstanceOf(ErroJsonInvalido);
    expect(provedor.pedidos).toHaveLength(2);
  });

  it('reparo manda o mesmo reator repetido de volta ao modelo', async () => {
    const repetido = { ...diretorOk, reacoes: [...diretorOk.reacoes, ...diretorOk.reacoes] };
    const { provedor, registradas, chamar } = montar([repetido, diretorOk]);
    const { dados } = await chamar('diretor', EXEMPLOS.diretor);
    expect(dados.reacoes).toHaveLength(1);
    expect(provedor.pedidos[1]?.mensagens[2]?.conteudo).toContain('reacoes.1.personagemId');
    expect(registradas[0]?.erro).toBe('json_invalido: reacoes.1.personagemId: repetido');
  });

  it('chamada_llm.erro e as mensagens dos erros não carregam texto do modelo nem do prompt', async () => {
    const ruim = {
      ...diretorOk,
      reacoes: [
        {
          personagemId: 'id-inventado-secreto',
          tipo: 'resposta',
          texto: 'frase única do modelo 🔥 com emoji',
          atrasoSeg: 40,
        },
      ],
    };
    const textoDoJogador = EXEMPLOS.diretor.acao.texto;
    const { registradas, chamar } = montar([ruim, ruim, ruim, ruim]);
    const erro = (await chamar('diretor', EXEMPLOS.diretor).catch((e: unknown) => e)) as Error;
    expect(erro).toBeInstanceOf(ErroJsonInvalido);
    const guardado = [erro.message, ...registradas.map((c) => c.erro ?? '')].join('\n');
    expect(guardado).toContain('reacoes.0.texto: emoji');
    expect(guardado).toContain('reacoes.0.personagemId: id_invalido');
    for (const proibido of ['id-inventado-secreto', 'frase única', textoDoJogador]) {
      expect(guardado).not.toContain(proibido);
    }
  });

  it('erro sem tipo do provedor vira ErroProvedor só com o nome, sem a mensagem', async () => {
    const vaza = new Error('falhou ao processar o texto do jogador: "segredo do prompt"');
    const { registradas, chamar } = montar([vaza, vaza]);
    const erro = (await chamar('diretor', EXEMPLOS.diretor).catch((e: unknown) => e)) as Error;
    expect(erro).toBeInstanceOf(ErroProvedor);
    for (const texto of [erro.message, ...registradas.map((c) => c.erro ?? '')]) {
      expect(texto).not.toContain('segredo do prompt');
    }
    expect(registradas[0]?.erro).toMatch(/^provedor: falha do provedor no modelo \S+: Error$/);
  });

  describe('registrar é melhor esforço', () => {
    const chamarComRegistro = (
      passos: PassoRoteiro[],
      registrar: () => Promise<void>,
      aoFalharRegistro?: (erro: unknown, chamada: ChamadaLlm) => void,
    ) =>
      chamarJob({
        job: 'diretor',
        mundoId: MUNDO_ID,
        biblia: BIBLIA_POP_BRASIL,
        entrada: EXEMPLOS.diretor,
        provedor: criarProvedorRoteirizado(passos),
        config,
        gastoHojeUsd: async () => 0,
        registrar,
        aoFalharRegistro,
      });

    it('falha ao gravar não engole o resultado nem trava, e o aviso recebe a chamada', async () => {
      const avisos: [unknown, ChamadaLlm][] = [];
      const resultado = await chamarComRegistro(
        [diretorOk],
        async () => {
          throw new Error('banco fora do ar');
        },
        (e, c) => avisos.push([e, c]),
      );
      expect(resultado.dados.cartao.titulo).toBe('A indireta pegou');
      // O worker ainda pode regravar a partir daqui.
      expect(resultado.chamadas).toHaveLength(1);
      expect(avisos).toHaveLength(1);
      expect(avisos[0]?.[1]).toBe(resultado.chamadas[0]);
    });

    it('falha ao gravar não esconde o erro do provedor nem impede a reserva', async () => {
      const resultado = await chamarComRegistro(
        [new ErroLimite('x', 429, 'rate_limit'), diretorOk],
        async () => {
          throw new Error('banco fora do ar');
        },
      );
      expect(resultado.chamadas.map((c) => [c.papel, c.ok])).toEqual([
        ['diretor', false],
        ['reserva', true],
      ]);
      const erro = await chamarComRegistro(
        [new ErroProvedor('x', 503, 'indisponivel'), new ErroProvedor('y', 503, 'indisponivel')],
        async () => {
          throw new Error('banco fora do ar');
        },
      ).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroProvedor);
    });

    it('um aoFalharRegistro que lança também é engolido', async () => {
      await expect(
        chamarComRegistro(
          [diretorOk],
          async () => {
            throw new Error('x');
          },
          () => {
            throw new Error('log quebrado');
          },
        ),
      ).resolves.toMatchObject({ dados: { moderacao: { ok: true } } });
    });
  });

  it('cai para o modelo reserva no limite', async () => {
    const { provedor, registradas, chamar } = montar([
      new ErroLimite('deepseek-v4.1-flash', 429, 'rate limit'),
      diretorOk,
    ]);
    const { dados } = await chamar('diretor', EXEMPLOS.diretor);
    expect(dados.reacoes).toHaveLength(1);
    expect(provedor.pedidos.map((p) => p.modelo)).toEqual(['deepseek-v4.1-flash', 'glm-5.3-flash']);
    expect(registradas.map((c) => [c.papel, c.ok])).toEqual([
      ['diretor', false],
      ['reserva', true],
    ]);
    expect(registradas[0]?.erro).toMatch(/^limite: /);
    expect(registradas[0]?.custoUsd).toBe(0);
  });

  it('cai para a reserva em falha do provedor, inclusive erro sem tipo', async () => {
    const { provedor, chamar } = montar([new Error('socket hang up'), diretorOk]);
    await chamar('diretor', EXEMPLOS.diretor);
    expect(provedor.pedidos.map((p) => p.modelo)).toEqual(['deepseek-v4.1-flash', 'glm-5.3-flash']);
  });

  it('se a reserva também falhar, lança o erro tipado para o worker reagendar', async () => {
    const { registradas, chamar } = montar([
      new ErroLimite('deepseek-v4.1-flash', 429, 'rate limit'),
      new ErroProvedor('glm-5.3-flash', 503, 'indisponível'),
    ]);
    const erro = await chamar('diretor', EXEMPLOS.diretor).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroProvedor);
    expect((erro as ErroProvedor).atrasoSugeridoMs).toBeGreaterThan(0);
    expect(registradas).toHaveLength(2);
  });

  it('não repete o modelo quando a reserva é o próprio modelo do papel', async () => {
    const provedor = criarProvedorRoteirizado([new ErroLimite('x', 429, 'rate limit')]);
    const mesmo = { ...config, modelos: { ...config.modelos, reserva: config.modelos.diretor } };
    await expect(
      chamarJob({
        job: 'diretor',
        mundoId: MUNDO_ID,
        biblia: BIBLIA_POP_BRASIL,
        entrada: EXEMPLOS.diretor,
        provedor,
        config: mesmo,
        gastoHojeUsd: async () => 0,
        registrar: async () => {},
      }),
    ).rejects.toBeInstanceOf(ErroLimite);
    expect(provedor.pedidos).toHaveLength(1);
  });

  it('para no teto diário antes de chamar o provedor', async () => {
    const { provedor, registradas, chamar } = montar([diretorOk], { gasto: () => 2.5, teto: 2 });
    const erro = await chamar('diretor', EXEMPLOS.diretor).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroOrcamento);
    expect((erro as ErroOrcamento).atrasoSugeridoMs).toBeGreaterThan(0);
    expect(provedor.pedidos).toHaveLength(0);
    expect(registradas).toHaveLength(0);
  });

  it('confere o teto de novo antes do reparo', async () => {
    let gasto = 1.99;
    const { provedor, chamar } = montar(['quebrado', diretorOk], {
      gasto: () => {
        const atual = gasto;
        gasto = 2;
        return atual;
      },
      teto: 2,
    });
    await expect(chamar('diretor', EXEMPLOS.diretor)).rejects.toBeInstanceOf(ErroOrcamento);
    expect(provedor.pedidos).toHaveLength(1);
  });

  it('devolve a recusa do criar_mundo quando a moderação barra o universo', async () => {
    const { chamar } = montar([{ moderacao: { ok: false, motivo: 'pede uma pessoa real' } }]);
    const { dados } = await chamar('criar_mundo', EXEMPLOS.criar_mundo, null);
    expect(mundoFoiRecusado(dados)).toBe(true);
  });

  it('usa idsValidos explícitos no lugar dos ids do prompt', async () => {
    const chamarCom = (idsValidos: string[]) =>
      chamarJob({
        job: 'diretor',
        mundoId: MUNDO_ID,
        biblia: BIBLIA_POP_BRASIL,
        entrada: EXEMPLOS.diretor,
        provedor: criarProvedorRoteirizado([diretorOk, diretorOk, diretorOk, diretorOk]),
        config,
        gastoHojeUsd: async () => 0,
        registrar: async () => {},
        idsValidos,
      });
    await expect(chamarCom(['outro-id'])).rejects.toBeInstanceOf(ErroJsonInvalido);
    await expect(chamarCom([VIC.id])).resolves.toMatchObject({
      dados: { moderacao: { ok: true } },
    });
  });
});
