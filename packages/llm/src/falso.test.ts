import { describe, expect, it } from 'vitest';
import { EXEMPLOS } from '../evals/exemplos';
import { BIBLIA_POP_BRASIL, MUNDO_ID } from '../evals/pop-brasil';
import { criarProvedorFalso } from './falso';
import { JOBS, NOMES_JOBS, type NomeJob } from './jobs';
import { idsDaEntrada, montarPrefixo, montarPromptDoJob } from './prompts';
import type { PedidoGeracao } from './provedor';
import { analisarResposta } from './validacao';

function pedido(job: NomeJob): PedidoGeracao {
  return {
    modelo: 'modelo-de-teste',
    sistema: montarPrefixo({ biblia: job === 'criar_mundo' ? null : BIBLIA_POP_BRASIL }),
    mensagens: [{ papel: 'usuario', conteudo: montarPromptDoJob(job, EXEMPLOS[job] as never) }],
    maxTokens: JOBS[job].maxTokens,
    sessao: MUNDO_ID,
    json: true,
  };
}

describe('provedor falso', () => {
  const provedor = criarProvedorFalso();

  it.each([...NOMES_JOBS])('devolve JSON válido para o job %s', async (job) => {
    const resposta = await provedor.gerar(pedido(job));
    const analise = analisarResposta(job, resposta.texto, {
      ids: idsDaEntrada(job, EXEMPLOS[job] as never),
      entrada: EXEMPLOS[job] as never,
    });
    expect(analise.problemas).toEqual([]);
    expect(analise.ok).toBe(true);
    expect(resposta.modelo).toBe('modelo-de-teste');
    expect(resposta.uso.entrada).toBeGreaterThan(resposta.uso.cache);
    expect(resposta.uso.saida).toBeGreaterThan(0);
  });

  it('é determinístico', async () => {
    for (const job of NOMES_JOBS) {
      const a = await provedor.gerar(pedido(job));
      const b = await provedor.gerar(pedido(job));
      expect(a.texto).toBe(b.texto);
    }
  });

  it('assina as reações com os reatores recebidos', async () => {
    const resposta = await provedor.gerar(pedido('diretor'));
    const dados = JSON.parse(resposta.texto) as { reacoes: { personagemId: string }[] };
    expect(dados.reacoes.map((r) => r.personagemId)).toEqual(
      EXEMPLOS.diretor.reatores.map((r) => r.id),
    );
  });

  it('cria o mundo a partir do universo pedido, sem repetir o handle do jogador', async () => {
    const resposta = await provedor.gerar(pedido('criar_mundo'));
    const dados = JSON.parse(resposta.texto) as {
      nomeMundo: string;
      elenco: { handle: string }[];
      biblia: string;
    };
    expect(dados.nomeMundo).toBe('Pop Brasil');
    expect(dados.elenco.map((p) => p.handle)).not.toContain('@luaprado');
    expect(dados.biblia).toMatch(/^Universo: Pop Brasil\./);
  });

  it('cria mundo válido mesmo com universo livre em outra língua', async () => {
    const entrada = {
      ...EXEMPLOS.criar_mundo,
      universo: 'Space pirates in the year 3000 with the crew',
    };
    const resposta = await provedor.gerar({
      ...pedido('criar_mundo'),
      mensagens: [{ papel: 'usuario', conteudo: montarPromptDoJob('criar_mundo', entrada) }],
    });
    const analise = analisarResposta('criar_mundo', resposta.texto, {
      ids: { personagens: [] },
      entrada,
    });
    expect(analise.problemas).toEqual([]);
  });

  it('no lote, puxa conversa e resume as memórias pedidas', async () => {
    const resposta = await provedor.gerar(pedido('lote_diario'));
    const dados = JSON.parse(resposta.texto) as {
      posts: unknown[];
      memorias: { personagemId: string }[];
      puxaConversa: unknown;
    };
    expect(dados.posts).toHaveLength(20);
    expect(dados.memorias).toHaveLength(1);
    expect(dados.puxaConversa).not.toBeNull();
  });

  it('falha alto se o prompt não começar com JOB', async () => {
    const semJob = {
      ...pedido('diretor'),
      mensagens: [{ papel: 'usuario' as const, conteudo: 'oi' }],
    };
    await expect(provedor.gerar(semJob)).rejects.toThrow(/JOB: <nome>/);
  });
});
