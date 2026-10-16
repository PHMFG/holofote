import { describe, expect, it } from 'vitest';
import { EXEMPLOS } from '../evals/exemplos';
import { analisarResposta, caminhoSeguro, coletarTextos } from './validacao';

const diretor = (texto: string) =>
  JSON.stringify({
    reacoes: [{ personagemId: 'vic', tipo: 'resposta', texto, atrasoSeg: 30 }],
    cartao: { titulo: 'Repercussão', texto: 'a Vic respondeu rápido' },
    moderacao: { ok: true },
  });

const ids = { personagens: ['vic'] };

describe('analisarResposta', () => {
  it('aceita uma resposta boa e devolve os dados', () => {
    const analise = analisarResposta('diretor', diretor('olha só quem acordou ousada'), { ids });
    expect(analise.ok).toBe(true);
    expect(analise.dados?.reacoes[0]?.personagemId).toBe('vic');
    expect(analise.contagem).toMatchObject({ foraDoPortugues: 0, comEmoji: 0, acimaDoLimite: 0 });
  });

  it('recusa emoji e texto em inglês, apontando o caminho', () => {
    const emoji = analisarResposta('diretor', diretor('que show 🔥'), { ids });
    expect(emoji.ok).toBe(false);
    expect(emoji.schemaOk).toBe(true);
    expect(emoji.problemas).toContain('reacoes.0.texto: tem emoji, que é proibido');

    const ingles = analisarResposta('diretor', diretor('this is what we were waiting for'), {
      ids,
    });
    expect(ingles.ok).toBe(false);
    expect(ingles.contagem.foraDoPortugues).toBe(1);
    expect(ingles.problemas[0]).toMatch(/reacoes\.0\.texto: não está em português/);
  });

  it('conta textos acima do limite com mensagem em português', () => {
    const analise = analisarResposta('diretor', diretor('a'.repeat(300)), { ids });
    expect(analise.schemaOk).toBe(false);
    expect(analise.contagem.acimaDoLimite).toBe(1);
    expect(analise.problemas.join(' ')).toMatch(/reacoes\.0\.texto: .*220/);
  });

  it('acusa JSON quebrado e id inventado', () => {
    expect(analisarResposta('diretor', 'não é json', { ids })).toMatchObject({
      ok: false,
      jsonOk: false,
    });
    const outro = analisarResposta('diretor', diretor('oi gente'), {
      ids: { personagens: ['duda'] },
    });
    expect(outro.ok).toBe(false);
    expect(outro.contagem.idsInvalidos).toBe(1);
  });

  it('não confere idioma de nome e handle', () => {
    const textos = coletarTextos({ nome: 'Taylor Swift Jones', handle: '@the.best', texto: 'oi' });
    expect(textos.filter((t) => t.livre).map((t) => t.caminho)).toEqual(['texto']);
  });

  it('no feed, respondeA numérico tem de apontar para trás', () => {
    const feed = JSON.stringify({
      posts: [
        { autorId: 'vic', texto: 'bom dia, gente', respondeA: 1 },
        { autorId: 'vic', texto: 'é isso mesmo', respondeA: 0 },
      ],
      resumo: { manchete: 'Dia agitado na rede' },
    });
    const analise = analisarResposta('feed_inicial', feed, { ids });
    expect(analise.ok).toBe(false);
    expect(analise.problemas).toEqual([expect.stringMatching(/posts\.0\.respondeA/)]);
  });

  it.each(['feed_inicial', 'lote_diario'] as const)('no %s, resumo é obrigatório', (job) => {
    const feed = JSON.stringify({ posts: [{ autorId: 'vic', texto: 'bom dia, gente' }] });
    const analise = analisarResposta(job, feed, { ids });
    expect(analise.ok).toBe(false);
    expect(analise.falhas).toEqual(['resumo: invalid_type']);
  });

  it('o mesmo reator duas vezes no diretor vira problema com caminho e código fixos', () => {
    const reacao = { personagemId: 'vic', tipo: 'resposta', texto: 'oi gente', atrasoSeg: 30 };
    const json = JSON.stringify({
      reacoes: [reacao, reacao],
      cartao: { titulo: 'Repercussão', texto: 'a Vic respondeu rápido' },
      moderacao: { ok: true },
    });
    const analise = analisarResposta('diretor', json, { ids });
    expect(analise.ok).toBe(false);
    expect(analise.falhas).toEqual(['reacoes.1.personagemId: repetido']);
  });

  it('falhas guardam só caminho e código, nunca o texto nem o id do modelo', () => {
    const json = JSON.stringify({
      reacoes: [
        {
          personagemId: 'id-secreto-do-modelo',
          tipo: 'resposta',
          texto: 'frase 🔥 única',
          atrasoSeg: 30,
        },
      ],
      'chave com frase inventada pelo modelo': 'x',
      cartao: { titulo: 'Repercussão', texto: 'a Vic respondeu rápido' },
      moderacao: { ok: true },
    });
    const analise = analisarResposta('diretor', json, { ids });
    expect(analise.problemas.join(' ')).toContain('id-secreto-do-modelo');
    expect(analise.falhas).toEqual([
      'reacoes.0.texto: emoji',
      'reacoes.0.personagemId: id_invalido',
    ]);
    const quebrado = analisarResposta('diretor', '{"texto": "segredo da resposta" [', { ids });
    expect(quebrado.falhas).toEqual(['(raiz): json_invalido']);
  });

  it('caminhoSeguro troca chave que não parece campo por *', () => {
    expect(caminhoSeguro('reacoes.0.texto')).toBe('reacoes.0.texto');
    expect(caminhoSeguro('(raiz)')).toBe('(raiz)');
    expect(caminhoSeguro('reacoes.uma frase solta.texto')).toBe('reacoes.*.texto');
  });

  it('na ficha, recusa nome ou handle que já existem', () => {
    const ficha = JSON.stringify({
      nome: 'Vic Ferraz',
      handle: '@vicferraz',
      ficha: 'mentora calma que escreve pouco',
      tipoVinculo: 'mentor',
      tomAvatar: 'medio',
      verificado: false,
    });
    const analise = analisarResposta('ficha', ficha, {
      ids: { personagens: [] },
      entrada: EXEMPLOS.ficha,
    });
    expect(analise.ok).toBe(false);
    expect(analise.problemas).toHaveLength(2);
  });

  it('no criar_mundo, recusa o handle do jogador', () => {
    const mundo = {
      nomeMundo: 'Pop Brasil',
      biblia:
        'Universo: pop nacional.\nTom: dramático.\nElenco:\n' +
        '@luaprado @pessoa1 @pessoa2 @pessoa3 @pessoa4',
      objetivoAto: 'Dominar o pop nacional',
      elenco: ['rival', 'amizade', 'parceria', 'mentor', 'fofoca'].map((tipoVinculo, i) => ({
        nome: `Pessoa ${i}`,
        handle: i === 0 ? '@luaprado' : `@pessoa${i}`,
        ficha: 'escreve curto e quer o topo',
        tipoVinculo,
        verificado: false,
        tomAvatar: 'medio',
      })),
      figurantes: [0, 1, 2, 3].map((i) => ({
        nome: `Figurante ${i}`,
        handle: `@fig${i}`,
        ficha: 'comenta tudo',
        tipo: 'fã',
      })),
      marcos: [1, 2, 3, 4, 5].map((i) => ({
        titulo: `Marco ${i}`,
        descricao: 'fazer algo grande',
      })),
      evento: { tipo: 'show', titulo: 'Show de estreia', categoria: 'Abertura' },
      moderacao: { ok: true },
    };
    const analise = analisarResposta('criar_mundo', JSON.stringify(mundo), {
      ids: { personagens: [] },
      entrada: EXEMPLOS.criar_mundo,
    });
    expect(analise.problemas).toEqual(['handle @luaprado é o do jogador']);
  });
});
