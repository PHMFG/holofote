import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { escolherReatores, type CandidatoReator } from './reatores';
import { criarRng, rngFixo } from './rng';

const p = (
  id: string,
  afinidade: number,
  extra: Partial<CandidatoReator> = {},
): CandidatoReator => ({ id, papel: 'elenco', afinidade, perfilFofoca: false, ...extra });

const ELENCO = [
  p('morno1', 50),
  p('vic', 38),
  p('bento', 88),
  p('rival', 10),
  p('fofoca', 50, { perfilFofoca: true }),
  p('morno2', 55),
  p('fa1', 50, { papel: 'figurante' }),
  p('fa2', 52, { papel: 'figurante' }),
  p('fa3', 48, { papel: 'figurante' }),
];

describe('escolherReatores', () => {
  it('prioridade: marcados, autor alvo, afinidades extremas, fofoca', () => {
    const ids = escolherReatores({
      personagens: ELENCO,
      marcados: ['vic'],
      autorAlvo: 'morno2',
      rng: rngFixo(0),
    });
    // rival (10) está mais longe de 50 que bento (88).
    expect(ids).toEqual(['vic', 'morno2', 'rival', 'bento', 'fofoca']);
  });

  it('marcado e autor repetidos ou fora da lista ainda entram uma vez', () => {
    const ids = escolherReatores({
      personagens: [],
      marcados: ['x', 'x'],
      autorAlvo: 'x',
      rng: rngFixo(0),
    });
    expect(ids).toEqual(['x']);
  });

  it('sorteio dos demais inclui 1 ou 2 figurantes quando houver vaga', () => {
    const personagens = ELENCO.filter(
      (c) => c.afinidade > 24 && c.afinidade < 80 && !c.perfilFofoca,
    );
    const um = escolherReatores({ personagens, marcados: [], rng: rngFixo(0) });
    const dois = escolherReatores({ personagens, marcados: [], rng: rngFixo(0.9) });
    const figurantes = (ids: string[]) => ids.filter((id) => id.startsWith('fa')).length;
    expect(um).toHaveLength(5);
    // Só há 3 do elenco fora das prioridades: com 1 figurante sorteado, falta 1 e entra outro.
    expect(figurantes(um)).toBe(2);
    expect(figurantes(dois)).toBe(2);
    const muitos = [...personagens, p('morno3', 50), p('morno4', 50), p('morno5', 50)];
    expect(
      figurantes(escolherReatores({ personagens: muitos, marcados: [], rng: rngFixo(0) })),
    ).toBe(1);
    expect(
      figurantes(escolherReatores({ personagens: muitos, marcados: [], rng: rngFixo(0.9) })),
    ).toBe(2);
  });

  it('sem figurantes, só elenco', () => {
    const ids = escolherReatores({
      personagens: [p('a', 50), p('b', 50)],
      marcados: [],
      rng: criarRng('x'),
    });
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('máximo zero ou negativo devolve lista vazia', () => {
    expect(
      escolherReatores({ personagens: ELENCO, marcados: ['vic'], rng: rngFixo(0), maximo: 0 }),
    ).toEqual([]);
    expect(
      escolherReatores({ personagens: ELENCO, marcados: [], rng: rngFixo(0), maximo: -3 }),
    ).toEqual([]);
  });

  const arbCandidatos = fc.uniqueArray(
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 4 }),
      papel: fc.constantFrom('elenco' as const, 'figurante' as const),
      afinidade: fc.integer({ min: 0, max: 100 }),
      perfilFofoca: fc.boolean(),
    }),
    { selector: (c) => c.id, maxLength: 15 },
  );

  it('propriedade: sem repetição, no máximo `maximo`, marcados primeiro e determinístico', () => {
    fc.assert(
      fc.property(
        arbCandidatos,
        fc.string(),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 0, max: 3 }),
        (personagens, semente, maximo, quantosMarcados) => {
          const marcados = personagens.slice(0, quantosMarcados).map((c) => c.id);
          const entrada = { personagens, marcados, rng: criarRng(semente), maximo };
          const ids = escolherReatores(entrada);
          expect(new Set(ids).size).toBe(ids.length);
          expect(ids.length).toBeLessThanOrEqual(maximo);
          expect(ids.length).toBe(Math.min(maximo, personagens.length));
          expect(ids.slice(0, Math.min(maximo, marcados.length))).toEqual(
            marcados.slice(0, Math.min(maximo, marcados.length)),
          );
          expect(escolherReatores({ ...entrada, rng: criarRng(semente) })).toEqual(ids);
        },
      ),
    );
  });

  it('propriedade: com vaga sobrando depois das prioridades, entra pelo menos um figurante', () => {
    fc.assert(
      fc.property(arbCandidatos, fc.string(), (personagens, semente) => {
        const ids = escolherReatores({ personagens, marcados: [], rng: criarRng(semente) });
        const prioritarios = personagens.filter(
          (c) => c.afinidade <= 24 || c.afinidade >= 80 || c.perfilFofoca,
        ).length;
        const figurantesLivres = personagens.filter(
          (c) => c.papel === 'figurante' && c.afinidade > 24 && c.afinidade < 80 && !c.perfilFofoca,
        );
        if (prioritarios < 5 && figurantesLivres.length > 0) {
          expect(ids.some((id) => figurantesLivres.some((f) => f.id === id))).toBe(true);
        }
      }),
    );
  });
});
