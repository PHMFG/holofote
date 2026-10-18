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
  ACRESCIMO_POR_ATO,
  contarAliados,
  fatorDoAto,
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

describe('atos seguintes', () => {
  const ATO_2 = { seguidores: 80_000, fama: 70, carisma: 60, posts: 40, dms: 12, escandalos: 5 };

  it('o fator do ato começa em 1 e cresce a cada ato', () => {
    expect(fatorDoAto(1)).toBe(1);
    expect(fatorDoAto(2)).toBe(1 + ACRESCIMO_POR_ATO);
    expect(fatorDoAto(4)).toBeGreaterThan(fatorDoAto(3));
    expect(fatorDoAto(0)).toBe(1);
    expect(fatorDoAto(2.9)).toBe(fatorDoAto(2));
  });

  it('o Ato 1 não muda: o ato é opcional e vale 1', () => {
    const r = () => requisitosDoMarco(3, INICIO, criarRng('mesmo'));
    expect(requisitosDoMarco(3, INICIO, criarRng('mesmo'), 1)).toEqual(r());
  });

  it('parte dos números atuais e pede mais que o ato anterior com o mesmo sorteio', () => {
    for (const chave of Object.keys(ESCALA_REQUISITOS) as ChaveRequisito[]) {
      for (const ordem of [1, 3, 5]) {
        const ato1 = alvoDoRequisito(chave, ordem, ATO_2, rngFixo(0.5), 1);
        const ato2 = alvoDoRequisito(chave, ordem, ATO_2, rngFixo(0.5), 2);
        const ato3 = alvoDoRequisito(chave, ordem, ATO_2, rngFixo(0.5), 3);
        expect(ato2).toBeGreaterThanOrEqual(ato1);
        expect(ato3).toBeGreaterThanOrEqual(ato2);
        if (chave !== 'fama' && chave !== 'carisma') expect(ato3).toBeGreaterThan(ato1);
      }
    }
    expect(alvoDoRequisito('seguidores', 1, ATO_2, rngFixo(0.5), 2)).toBe(
      arredondarSignificativo(80_000 * 2 * 1.25),
    );
    expect(alvoDoRequisito('posts', 1, ATO_2, rngFixo(0.5), 2)).toBe(40 + 13);
  });

  it('propriedade: todo alvo do ato novo passa dos números atuais do jogador', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 2, max: 6 }),
        arbInicio,
        fc.string(),
        (ordem, ato, inicio, semente) => {
          for (const r of requisitosDoMarco(ordem, inicio, criarRng(semente), ato)) {
            expect(r.alvo).toBeGreaterThan(inicio[r.chave]);
          }
        },
      ),
    );
  });

  it('fama e carisma já no teto não viram requisito', () => {
    const noTeto = { ...ATO_2, fama: 100, carisma: 100 };
    for (const ordem of [2, 3, 4, 5]) {
      const chaves = requisitosDoMarco(ordem, noTeto, criarRng(`teto-${ordem}`), 2).map(
        (r) => r.chave,
      );
      expect(chaves).not.toContain('fama');
      expect(chaves).not.toContain('carisma');
      expect(chaves).toHaveLength(3);
    }
    // Só o carisma no teto: a fama ainda pode aparecer.
    const soCarisma = { ...ATO_2, carisma: 100 };
    const todas = [2, 3, 4, 5].flatMap((ordem) =>
      Array.from({ length: 30 }, (_, i) =>
        requisitosDoMarco(ordem, soCarisma, criarRng(`c-${ordem}-${i}`), 2).map((r) => r.chave),
      ).flat(),
    );
    expect(todas).toContain('fama');
    expect(todas).not.toContain('carisma');
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
