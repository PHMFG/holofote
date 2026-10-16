import { describe, expect, it } from 'vitest';
import {
  Handle,
  MundoGerado,
  SaidaCriarMundo,
  SaidaDiretor,
  SaidaDiscurso,
  SaidaDm,
  SaidaFeed,
  SaidaFeedInicial,
  SaidaFicha,
  SaidaLoteDiario,
  SCHEMAS,
  schemaParaValidar,
  mundoFoiRecusado,
  validarIds,
} from './schemas';

const diretorValido = {
  reacoes: [
    { personagemId: 'vic', tipo: 'resposta', texto: 'olha só quem acordou ousada', atrasoSeg: 45 },
  ],
  cartao: { titulo: 'A indireta pegou', texto: 'Vic respondeu em minutos e a polêmica subiu.' },
  deltasSugeridos: [{ alvo: 'relacao:vic', valor: -2 }],
  memorias: [{ personagemId: 'vic', fato: 'foi provocada em público' }],
  moderacao: { ok: true },
};

const membro = (nome: string, handle: string, tipoVinculo: string) => ({
  nome,
  handle,
  ficha: 'escreve curto e quer o topo',
  tipoVinculo,
  verificado: true,
  tomAvatar: 'claro',
});

const mundoValido = {
  nomeMundo: 'Pop Brasil',
  biblia:
    'Universo: pop nacional.\nTom: dramático.\nElenco:\nVic (@vic): rival\nDuda (@duda): parceria\n' +
    'Bento (@bento): amizade\nFofocalizei (@fofocalizei): fofoca\nNina (@nina): interesse',
  objetivoAto: 'Dominar o pop nacional',
  elenco: [
    membro('Vic', '@vic', 'rival'),
    membro('Duda', '@duda', 'parceria'),
    membro('Bento', '@bento', 'amizade'),
    membro('Fofocalizei', '@fofocalizei', 'fofoca'),
    membro('Nina', '@nina', 'interesse'),
  ],
  figurantes: ['Mari', 'Otávio', 'Rui', 'Lia'].map((nome, i) => ({
    nome,
    handle: `@figurante${i}`,
    ficha: 'comenta tudo',
    tipo: 'fã',
  })),
  marcos: Array.from({ length: 5 }, (_, i) => ({
    titulo: `Marco ${i + 1}`,
    descricao: 'fazer algo',
  })),
  evento: { tipo: 'premio', titulo: 'Prêmio Pop Brasil', categoria: 'Revelação do ano' },
  moderacao: { ok: true },
};

describe('SaidaDiretor', () => {
  it('aceita a saída do plano', () => {
    expect(SaidaDiretor.parse(diretorValido)).toMatchObject({ reacoes: [{ personagemId: 'vic' }] });
  });

  it('aceita null nos opcionais e completa listas ausentes', () => {
    const semDeltas: Record<string, unknown> = { ...diretorValido };
    delete semDeltas.deltasSugeridos;
    const saida = SaidaDiretor.parse({
      ...semDeltas,
      memorias: null,
      moderacao: { ok: true, motivo: null },
    });
    expect(saida.deltasSugeridos).toEqual([]);
    expect(saida.memorias).toEqual([]);
    expect(saida.moderacao.motivo).toBeUndefined();
  });

  it('recusa texto acima de 220, atraso fora de 20..900 e mais de 5 reações', () => {
    const reacao = diretorValido.reacoes[0];
    const comTexto = (texto: string) => ({ ...diretorValido, reacoes: [{ ...reacao, texto }] });
    expect(SaidaDiretor.safeParse(comTexto('a'.repeat(221))).success).toBe(false);
    expect(SaidaDiretor.safeParse(comTexto('a'.repeat(220))).success).toBe(true);
    expect(
      SaidaDiretor.safeParse({ ...diretorValido, reacoes: [{ ...reacao, atrasoSeg: 10 }] }).success,
    ).toBe(false);
    expect(
      SaidaDiretor.safeParse({ ...diretorValido, reacoes: Array(6).fill(reacao) }).success,
    ).toBe(false);
  });

  it('recusa cartão acima do limite e alvo de delta desconhecido', () => {
    expect(
      SaidaDiretor.safeParse({ ...diretorValido, cartao: { titulo: 'a'.repeat(61), texto: 'x' } })
        .success,
    ).toBe(false);
    expect(
      SaidaDiretor.safeParse({ ...diretorValido, deltasSugeridos: [{ alvo: 'energia', valor: 1 }] })
        .success,
    ).toBe(false);
  });
});

describe('SaidaCriarMundo', () => {
  it('aceita um mundo completo', () => {
    const saida = SaidaCriarMundo.parse(mundoValido);
    expect(mundoFoiRecusado(saida)).toBe(false);
  });

  it('exige 1 rival, 1 aliado e handles únicos', () => {
    const semRival = {
      ...mundoValido,
      elenco: mundoValido.elenco.map((p) => ({ ...p, tipoVinculo: 'amizade' })),
    };
    expect(MundoGerado.safeParse(semRival).error?.issues[0]?.message).toMatch(/rival/);
    const semAliado = {
      ...mundoValido,
      elenco: mundoValido.elenco.map((p, i) => ({
        ...p,
        tipoVinculo: i === 0 ? 'rival' : 'fofoca',
      })),
    };
    expect(MundoGerado.safeParse(semAliado).error?.issues[0]?.message).toMatch(/aliado/);
    const repetido = {
      ...mundoValido,
      elenco: mundoValido.elenco.map((p) => ({ ...p, handle: '@igual' })),
    };
    expect(MundoGerado.safeParse(repetido).error?.issues[0]?.message).toMatch(/handles/);
  });

  it('exige exatamente 5 no elenco, 4 figurantes e 5 marcos', () => {
    expect(
      MundoGerado.safeParse({ ...mundoValido, elenco: mundoValido.elenco.slice(0, 4) }).success,
    ).toBe(false);
    expect(MundoGerado.safeParse({ ...mundoValido, figurantes: [] }).success).toBe(false);
    expect(
      MundoGerado.safeParse({ ...mundoValido, marcos: mundoValido.marcos.slice(1) }).success,
    ).toBe(false);
  });

  it('moderacao.ok false junto com elenco vale como recusa, nunca como mundo', () => {
    const barrado = { ...mundoValido, moderacao: { ok: false, motivo: 'pessoa real' } };
    expect(MundoGerado.safeParse(barrado).success).toBe(false);
    expect(schemaParaValidar('criar_mundo', barrado)).not.toBe(MundoGerado);
    const saida = SaidaCriarMundo.parse(barrado);
    expect(mundoFoiRecusado(saida)).toBe(true);
    expect('elenco' in saida).toBe(false);
    // Sem motivo a recusa é inválida (o roteador pede reparo em vez de criar o mundo).
    const semMotivo = { ...mundoValido, moderacao: { ok: false } };
    expect(schemaParaValidar('criar_mundo', semMotivo).safeParse(semMotivo).success).toBe(false);
  });

  it('aceita a recusa da moderação', () => {
    const saida = SaidaCriarMundo.parse({ moderacao: { ok: false, motivo: 'pessoa real' } });
    expect(mundoFoiRecusado(saida)).toBe(true);
  });

  it('exige as três partes da bíblia e uma linha por personagem do elenco', () => {
    const semTom = { ...mundoValido, biblia: mundoValido.biblia.replace('Tom:', 'Clima:') };
    expect(MundoGerado.safeParse(semTom).error?.issues[0]?.message).toMatch(/faltou tom:/);
    const semNina = { ...mundoValido, biblia: mundoValido.biblia.replace('(@nina)', '') };
    expect(MundoGerado.safeParse(semNina).error?.issues[0]?.message).toMatch(/faltou @nina/);
  });

  it('recusa bíblia acima de 3.000 caracteres', () => {
    expect(MundoGerado.safeParse({ ...mundoValido, biblia: 'a'.repeat(3001) }).success).toBe(false);
  });
});

describe('Handle', () => {
  it('normaliza maiúsculas e o @ que faltar', () => {
    expect(Handle.parse('VicFerraz')).toBe('@vicferraz');
    expect(Handle.parse(' @duda.marques ')).toBe('@duda.marques');
    expect(Handle.safeParse('@com espaço').success).toBe(false);
    expect(Handle.safeParse('@a').success).toBe(false);
  });
});

describe('feed_inicial e lote_diario exigem resumo', () => {
  const feed = {
    posts: [{ autorId: 'vic', texto: 'bom dia' }],
    resumo: { manchete: 'Dia agitado', pendencias: [] },
  };
  const semResumo = { posts: feed.posts };

  it('SaidaFeed (tipo comum) aceita sem resumo, os dois jobs não', () => {
    expect(SaidaFeed.safeParse(semResumo).success).toBe(true);
    for (const schema of [SaidaFeedInicial, SaidaLoteDiario]) {
      const r = schema.safeParse(semResumo);
      expect(r.success).toBe(false);
      expect(r.error?.issues[0]?.path).toEqual(['resumo']);
      expect(schema.safeParse({ ...feed, resumo: null }).success).toBe(false);
      expect(schema.parse(feed).resumo.manchete).toBe('Dia agitado');
    }
    expect(SCHEMAS.feed_inicial).toBe(SaidaFeedInicial);
    expect(SCHEMAS.lote_diario).toBe(SaidaLoteDiario);
  });
});

describe('um reator só reage uma vez', () => {
  const reacao = (personagemId: string) => ({
    personagemId,
    tipo: 'resposta',
    texto: 'oi',
    atrasoSeg: 30,
  });

  it('o diretor rejeita personagemId repetido, apontando a segunda reação', () => {
    const repetido = { ...diretorValido, reacoes: [reacao('vic'), reacao('duda'), reacao('vic')] };
    const r = SaidaDiretor.safeParse(repetido);
    expect(r.success).toBe(false);
    expect(r.error?.issues).toHaveLength(1);
    expect(r.error?.issues[0]?.path).toEqual(['reacoes', 2, 'personagemId']);
    expect(
      SaidaDiretor.safeParse({ ...diretorValido, reacoes: [reacao('vic'), reacao('duda')] })
        .success,
    ).toBe(true);
  });

  it('o discurso também', () => {
    const base = { manchete: 'Lua vence' };
    const r1 = { personagemId: 'vic', texto: 'oi', atrasoSeg: 30 };
    expect(SaidaDiscurso.safeParse({ ...base, reacoes: [r1, r1] }).success).toBe(false);
    expect(SaidaDiscurso.safeParse({ ...base, reacoes: [r1] }).success).toBe(true);
  });
});

describe('SaidaDm, SaidaFeed e SaidaFicha', () => {
  it('aceita deltaSugerido fracionário (o worker arredonda), mas só de -3 a 3', () => {
    const dm = { mensagens: ['oi'], resumoConversa: 'conversaram' };
    expect(SaidaDm.parse({ ...dm, deltaSugerido: 1.5 }).deltaSugerido).toBe(1.5);
    expect(SaidaDm.parse({ ...dm, deltaSugerido: -2.6 }).deltaSugerido).toBe(-2.6);
    expect(SaidaDm.safeParse({ ...dm, deltaSugerido: 3.2 }).success).toBe(false);
    expect(SaidaDm.safeParse({ ...dm, deltaSugerido: Number.NaN }).success).toBe(false);
  });

  it('limita a DM a 1..3 mensagens e o delta a -3..3', () => {
    const dm = { mensagens: ['oi'], resumoConversa: 'conversaram', deltaSugerido: 1 };
    expect(SaidaDm.parse(dm).memoria).toBeUndefined();
    expect(SaidaDm.safeParse({ ...dm, mensagens: [] }).success).toBe(false);
    expect(SaidaDm.safeParse({ ...dm, mensagens: ['a', 'b', 'c', 'd'] }).success).toBe(false);
    expect(SaidaDm.safeParse({ ...dm, deltaSugerido: 4 }).success).toBe(false);
    expect(SaidaDm.safeParse({ ...dm, resumoConversa: 'a'.repeat(401) }).success).toBe(false);
  });

  it('valida posts, histórias com enquete e resumo do feed', () => {
    const feed = {
      posts: [
        { autorId: 'vic', texto: 'bom dia' },
        { autorId: 'duda', texto: 'oi', respondeA: 0 },
      ],
      historias: [
        { autorId: 'vic', texto: 'ensaio', enquete: { pergunta: 'qual?', opcoes: ['a', 'b'] } },
      ],
      resumo: {
        manchete: 'Dia agitado',
        pendencias: [{ texto: 'responder a Vic', personagemId: 'vic' }],
      },
      puxaConversa: null,
    };
    const saida = SaidaFeed.parse(feed);
    expect(saida.memorias).toEqual([]);
    expect(saida.puxaConversa).toBeUndefined();
    const enqueteRuim = {
      ...feed,
      historias: [{ autorId: 'vic', texto: 'x', enquete: { pergunta: 'q', opcoes: ['a'] } }],
    };
    expect(SaidaFeed.safeParse(enqueteRuim).success).toBe(false);
    expect(SaidaFeed.safeParse({ ...feed, posts: [] }).success).toBe(false);
  });

  it('valida a ficha nova', () => {
    const ficha = {
      nome: 'Rita',
      handle: '@rita',
      ficha: 'mentora calma',
      tipoVinculo: 'mentor',
      tomAvatar: 'medio',
      verificado: false,
    };
    expect(SaidaFicha.parse(ficha).handle).toBe('@rita');
    expect(SaidaFicha.safeParse({ ...ficha, tomAvatar: 'escuro' }).success).toBe(false);
    expect(SaidaFicha.safeParse({ ...ficha, ficha: 'a'.repeat(601) }).success).toBe(false);
  });
});

describe('validarIds', () => {
  it('aceita só ids enviados', () => {
    expect(validarIds(diretorValido, ['vic'])).toEqual([]);
    const problemas = validarIds(diretorValido, ['duda']);
    expect(problemas).toHaveLength(3);
    expect(problemas.join(' ')).toMatch(/reacoes\.0\.personagemId/);
    expect(problemas.join(' ')).toMatch(/deltasSugeridos\.0\.alvo/);
  });

  it('separa personagens, sobreId e posts', () => {
    const feed = {
      posts: [
        { autorId: 'vic', texto: 'x', respondeA: 'post-1' },
        { autorId: 'lua', texto: 'y' },
      ],
      memorias: [{ personagemId: 'vic', sobreId: 'lua', fatos: 'z' }],
    };
    const ids = { personagens: ['vic'], sobre: ['vic', 'lua'], posts: ['post-1'] };
    const problemas = validarIds(feed, ids);
    expect(problemas).toEqual([expect.stringMatching(/posts\.1\.autorId/)]);
    expect(validarIds(feed, { ...ids, posts: [] })).toHaveLength(2);
  });
});
