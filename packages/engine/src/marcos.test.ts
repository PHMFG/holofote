import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ACOES_NOVAS,
  ESCALA_REQUISITOS,
  ORDEM_REQUISITOS,
  RECOMPENSA_PADRAO,
  ROTULOS_REQUISITO,
  alvoDoRequisito,
  arredondarSignificativo,
  avaliarMarco,
  contarAliados,
  progressoDoAto,
  recompensaDoMarco,
  requisitosDoMarco,
  type ChaveRequisito,
} from './marcos';
import { criarRng, RNG_MAXIMO, rngFixo } from './rng';

const INICIO = { seguidores: 2000, fama: 20, carisma: 50 };

const arbInicio = fc.record({
  seguidores: fc.integer({ min: 0, max: 2_000_000 }),
  fama: fc.integer({ min: 0, max: 100 }),
  carisma: fc.integer({ min: 0, max: 100 }),
  posts: fc.integer({ min: 0, max: 500 }),
  dms: fc.integer({ min: 0, max: 500 }),
  escandalos: fc.integer({ min: 0, max: 50 }),
  aliados: fc.integer({ min: 0, max: 10 }),
});

describe('arredondarSignificativo', () => {
  it('dois algarismos significativos a partir de 100', () => {
    expect(arredondarSignificativo(99.4)).toBe(99);
    expect(arredondarSignificativo(100)).toBe(100);
    expect(arredondarSignificativo(9873)).toBe(9900);
    expect(arredondarSignificativo(12_345)).toBe(12_000);
    expect(arredondarSignificativo(1_049_000)).toBe(1_000_000);
  });
});

describe('requisitosDoMarco', () => {
  it('marco 1 tem 2 requisitos; os demais têm 3; seguidores sempre', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        arbInicio,
        fc.string(),
        (ordem, inicio, semente) => {
          const reqs = requisitosDoMarco(ordem, inicio, criarRng(semente));
          expect(reqs).toHaveLength(ordem === 1 ? 2 : 3);
          expect(reqs[0]?.chave).toBe('seguidores');
          expect(new Set(reqs.map((r) => r.chave)).size).toBe(reqs.length);
          const posicoes = reqs.map((r) => ORDEM_REQUISITOS.indexOf(r.chave));
          expect(posicoes).toEqual([...posicoes].sort((a, b) => a - b));
          for (const r of reqs) {
            expect(r.rotulo).toBe(ROTULOS_REQUISITO[r.chave]);
            expect(ESCALA_REQUISITOS[r.chave].aPartirDe).toBeLessThanOrEqual(ordem);
            expect(Number.isInteger(r.alvo)).toBe(true);
          }
        },
      ),
    );
  });

  it('ordem fora de 1..5 é limitada', () => {
    expect(requisitosDoMarco(0, INICIO, rngFixo(0))).toHaveLength(2);
    expect(requisitosDoMarco(9, INICIO, rngFixo(0))).toEqual(
      requisitosDoMarco(5, INICIO, rngFixo(0)),
    );
  });

  it('exemplo do plano: marco 2 com 2 000 seguidores pede cerca de 10 mil', () => {
    const baixo = alvoDoRequisito('seguidores', 2, INICIO, rngFixo(0));
    const alto = alvoDoRequisito('seguidores', 2, INICIO, rngFixo(RNG_MAXIMO));
    expect(baixo).toBe(9000);
    expect(alto).toBe(11_000);
    expect(alvoDoRequisito('escandalos', 2, INICIO, rngFixo(0.5))).toBe(4);
  });

  it('propriedade: os alvos crescem com a ordem, com qualquer sorteio', () => {
    const chaves = Object.keys(ESCALA_REQUISITOS) as ChaveRequisito[];
    fc.assert(
      fc.property(
        fc.constantFrom(...chaves),
        fc.integer({ min: 1, max: 4 }),
        arbInicio,
        fc.string(),
        fc.string(),
        (chave, ordem, inicio, s1, s2) => {
          const atual = alvoDoRequisito(chave, ordem, inicio, criarRng(s1));
          const seguinte = alvoDoRequisito(chave, ordem + 1, inicio, criarRng(s2));
          expect(seguinte).toBeGreaterThanOrEqual(atual);
        },
      ),
    );
  });

  it('propriedade: todo alvo exige avanço sobre o início do ato, e atributos param em 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        arbInicio,
        fc.string(),
        (ordem, inicio, semente) => {
          for (const r of requisitosDoMarco(ordem, inicio, criarRng(semente))) {
            if (r.chave === 'fama' || r.chave === 'carisma') {
              expect(r.alvo).toBeLessThanOrEqual(100);
              expect(r.alvo).toBe(Math.min(100, r.alvo));
              if (inicio[r.chave] < 100) expect(r.alvo).toBeGreaterThan(inicio[r.chave]);
            } else {
              expect(r.alvo).toBeGreaterThan(inicio[r.chave]);
            }
          }
        },
      ),
    );
  });

  it('conta quase vazia usa base de 1 000 seguidores', () => {
    expect(alvoDoRequisito('seguidores', 1, { ...INICIO, seguidores: 0 }, rngFixo(0))).toBe(1800);
  });

  it('contadores ausentes no início valem 0', () => {
    expect(alvoDoRequisito('aliados', 3, INICIO, rngFixo(0))).toBe(1);
    expect(alvoDoRequisito('aliados', 3, { ...INICIO, aliados: 2 }, rngFixo(0))).toBe(3);
  });
});

describe('avaliarMarco', () => {
  const reqs = requisitosDoMarco(2, INICIO, criarRng('marco-2'));

  it('cumprido só com todos os alvos atingidos', () => {
    const tudo = Object.fromEntries(reqs.map((r) => [r.chave, r.alvo]));
    const ok = avaliarMarco(reqs, tudo);
    expect(ok.cumprido).toBe(true);
    expect(ok.requisitos.map((r) => r.atual)).toEqual(reqs.map((r) => r.alvo));
    const falta = avaliarMarco(reqs, { ...tudo, seguidores: 10 });
    expect(falta.cumprido).toBe(false);
  });

  it('chave ausente no estado vale 0', () => {
    const r = avaliarMarco([{ chave: 'dms', rotulo: 'Mensagens enviadas', alvo: 3 }], {});
    expect(r).toEqual({
      requisitos: [{ chave: 'dms', rotulo: 'Mensagens enviadas', atual: 0, alvo: 3 }],
      cumprido: false,
    });
  });

  it('aliados são relações com afinidade a partir de 80', () => {
    expect(contarAliados([79, 80, 88, 12, 100])).toBe(3);
  });
});

describe('recompensas', () => {
  it('padrão do plano: +25 gemas, energia cheia, personagem novo e ação nova', () => {
    expect(RECOMPENSA_PADRAO).toEqual({
      gemas: 25,
      energiaCheia: true,
      personagemNovo: true,
      acaoNova: 'enquete',
    });
  });

  it('cada ordem libera uma ação nova diferente', () => {
    const acoes = [1, 2, 3, 4, 5].map((ordem) => recompensaDoMarco(ordem).acaoNova);
    expect(acoes).toEqual(ACOES_NOVAS.map((a) => a.id));
    expect(recompensaDoMarco(7).acaoNova).toBe('ao_vivo');
    expect(recompensaDoMarco(3).gemas).toBe(25);
  });
});

describe('progressoDoAto', () => {
  it('concluídos mais a fração do marco atual, sobre 5', () => {
    expect(progressoDoAto([])).toBe(0);
    const marcos = [
      { concluido: true },
      { concluido: true },
      {
        concluido: false,
        requisitos: [
          { atual: 5, alvo: 10 },
          { atual: 30, alvo: 10 },
        ],
      },
      { concluido: false, requisitos: [{ atual: 1000, alvo: 1 }] },
      { concluido: false },
    ];
    // (2 + (0,5 + 1) / 2) / 5
    expect(progressoDoAto(marcos)).toBeCloseTo(0.55);
    expect(progressoDoAto(marcos.map((m) => ({ ...m, concluido: true })))).toBe(1);
    expect(progressoDoAto([{ concluido: false }])).toBe(0);
    expect(progressoDoAto([{ concluido: false, requisitos: [{ atual: 0, alvo: 0 }] }])).toBe(0.2);
  });

  it('propriedade: fica sempre em 0..1', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            concluido: fc.boolean(),
            requisitos: fc.array(
              fc.record({
                atual: fc.integer({ min: -10, max: 1000 }),
                alvo: fc.integer({ min: -5, max: 500 }),
              }),
            ),
          }),
          { maxLength: 8 },
        ),
        (marcos) => {
          const p = progressoDoAto(marcos);
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThanOrEqual(1);
        },
      ),
    );
  });
});
