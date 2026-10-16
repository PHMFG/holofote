import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  afinidadeDepois,
  alcanceBase,
  calcularDm,
  calcularPost,
  calcularResposta,
  limiarViral,
  previa,
  type Marcado,
  type NumerosJogador,
} from './acoes';
import { limitarAtributo } from './atributos';
import { criarRng, RNG_MAXIMO, rngFixo } from './rng';
import { LISTA_TONS, TONS } from './tom';
import type { Delta, Tom } from './tipos';

const JOGADOR: NumerosJogador = { fama: 20, carisma: 50, polemica: 10, seguidores: 2500 };
const valor = (deltas: readonly Delta[], alvo: string) =>
  deltas.find((d) => d.alvo === alvo)?.valor ?? 0;

const arbJogador = fc.record({
  fama: fc.integer({ min: 0, max: 100 }),
  carisma: fc.integer({ min: 0, max: 100 }),
  polemica: fc.integer({ min: 0, max: 100 }),
  seguidores: fc.integer({ min: 0, max: 5_000_000 }),
});
const arbTom = fc.constantFrom<Tom>(...LISTA_TONS);
const arbMarcados = fc.uniqueArray(
  fc.record({
    id: fc.constantFrom('vic', 'duda', 'bento', 'lua'),
    afinidade: fc.integer({ min: 0, max: 100 }),
  }),
  { selector: (m) => m.id, maxLength: 3 },
);

describe('fórmulas de post', () => {
  it('alcance base sublinear e limiar viral', () => {
    expect(alcanceBase(0)).toBe(200);
    expect(alcanceBase(-5)).toBe(200);
    expect(alcanceBase(2500)).toBe(1200);
    expect(limiarViral(0, 0)).toBe(50);
    // 1 200 × 1,4² × 0,02 × 1,5 = 70,56
    expect(limiarViral(2500, 20)).toBe(71);
  });

  it('caso de referência com o RNG no mínimo', () => {
    // 1 200 × 1,0 × 1,4 × 1,1 × 0,85 = 1 570,8
    const r = calcularPost({ jogador: JOGADOR, tom: 'sincero', marcados: [], rng: rngFixo(0) });
    expect(r).toEqual({
      alcance: 1571,
      curtidasSimuladas: 63, // 1 571 × 0,04
      seguidoresGanhos: 22, // 1 571 × 0,01 × 1,4
      deltas: [{ alvo: 'seguidores', valor: 22 }],
    });
  });

  it('post viral dá +1 de fama', () => {
    const jogador = { ...JOGADOR, polemica: 100 };
    const r = calcularPost({ jogador, tom: 'provocativo', marcados: [], rng: rngFixo(RNG_MAXIMO) });
    expect(r.seguidoresGanhos).toBeGreaterThanOrEqual(
      limiarViral(jogador.seguidores, jogador.fama),
    );
    expect(valor(r.deltas, 'fama')).toBe(1);
    const noTeto = calcularPost({
      jogador: { ...jogador, fama: 100 },
      tom: 'provocativo',
      marcados: [],
      rng: rngFixo(RNG_MAXIMO),
    });
    expect(valor(noTeto.deltas, 'fama')).toBe(0);
  });

  it('reproduz a tabela de tons (carisma 30 é neutro no ajuste)', () => {
    const jogador = { fama: 20, carisma: 30, polemica: 50, seguidores: 2500 };
    const marcados = [{ id: 'vic', afinidade: 50 }];
    const sincero = calcularPost({ jogador, tom: 'sincero', marcados, rng: rngFixo(0) });
    for (const tom of LISTA_TONS) {
      const efeito = TONS[tom];
      const faixas = previa({ jogador, tom, marcados });
      expect(faixas.polemica).toEqual(efeito.polemica);
      expect(faixas.relacoes[0]?.afinidade).toEqual([
        50 + efeito.relacao[0],
        50 + efeito.relacao[1],
      ]);
      const r = calcularPost({ jogador, tom, marcados, rng: rngFixo(0) });
      expect(r.alcance / sincero.alcance).toBeCloseTo(efeito.alcance, 3);
      const baixo = calcularPost({ jogador, tom, marcados, rng: rngFixo(0) });
      const alto = calcularPost({ jogador, tom, marcados, rng: rngFixo(RNG_MAXIMO) });
      expect([valor(baixo.deltas, 'carisma'), valor(alto.deltas, 'carisma')]).toEqual(
        efeito.carisma,
      );
    }
  });

  it('marcados repetidos contam uma vez só', () => {
    const marcados = [
      { id: 'vic', afinidade: 40 },
      { id: 'vic', afinidade: 40 },
    ];
    const r = calcularPost({ jogador: JOGADOR, tom: 'fofo', marcados, rng: rngFixo(0) });
    expect(r.deltas.filter((d) => d.alvo === 'relacao:vic')).toHaveLength(1);
    expect(previa({ jogador: JOGADOR, tom: 'fofo', marcados }).relacoes).toHaveLength(1);
  });

  it('deltas efetivos respeitam as bordas de 0..100', () => {
    const jogador = { fama: 20, carisma: 50, polemica: 1, seguidores: 2500 };
    const r = calcularPost({
      jogador,
      tom: 'fofo',
      marcados: [{ id: 'bento', afinidade: 99 }],
      rng: rngFixo(RNG_MAXIMO),
    });
    expect(valor(r.deltas, 'relacao:bento')).toBe(1);
    const baixo = calcularPost({ jogador, tom: 'fofo', marcados: [], rng: rngFixo(0) });
    expect(valor(baixo.deltas, 'polemica')).toBe(-1);
  });

  it('propriedade: mesma semente, mesmo resultado', () => {
    fc.assert(
      fc.property(
        fc.string(),
        arbJogador,
        arbTom,
        arbMarcados,
        (semente, jogador, tom, marcados) => {
          const a = calcularPost({ jogador, tom, marcados, rng: criarRng(semente) });
          const b = calcularPost({ jogador, tom, marcados, rng: criarRng(semente) });
          expect(a).toEqual(b);
        },
      ),
    );
  });

  it('propriedade: deltas dentro dos limites e números coerentes', () => {
    fc.assert(
      fc.property(
        fc.string(),
        arbJogador,
        arbTom,
        arbMarcados,
        (semente, jogador, tom, marcados) => {
          const r = calcularPost({ jogador, tom, marcados, rng: criarRng(semente) });
          const efeito = TONS[tom];
          expect(r.alcance).toBeGreaterThan(0);
          expect(r.curtidasSimuladas).toBeGreaterThanOrEqual(0);
          expect(r.curtidasSimuladas).toBeLessThanOrEqual(r.alcance);
          expect(r.seguidoresGanhos).toBeGreaterThanOrEqual(0);
          expect(r.deltas.every((d) => d.valor !== 0)).toBe(true);
          expect(valor(r.deltas, 'seguidores')).toBe(r.seguidoresGanhos);
          expect([0, 1]).toContain(valor(r.deltas, 'fama'));
          const p = valor(r.deltas, 'polemica');
          expect(p).toBeGreaterThanOrEqual(
            limitarAtributo(jogador.polemica + efeito.polemica[0]) - jogador.polemica,
          );
          expect(p).toBeLessThanOrEqual(
            limitarAtributo(jogador.polemica + efeito.polemica[1]) - jogador.polemica,
          );
          for (const m of marcados) {
            const d = valor(r.deltas, `relacao:${m.id}`);
            expect(Math.abs(d)).toBeLessThanOrEqual(8);
            expect(m.afinidade + d).toBeGreaterThanOrEqual(0);
            expect(m.afinidade + d).toBeLessThanOrEqual(100);
          }
        },
      ),
    );
  });
});

describe('previa', () => {
  it('custa 0 e mostra o custo do post', () => {
    const faixas = previa({ jogador: JOGADOR, tom: 'sincero', marcados: [] });
    expect(faixas.custo).toBe(1);
    expect(faixas.alcance).toEqual([1571, 2125]);
    expect(faixas.relacoes).toEqual([]);
  });

  it('propriedade: o resultado real com qualquer semente cai dentro das faixas', () => {
    fc.assert(
      fc.property(
        fc.string(),
        arbJogador,
        arbTom,
        arbMarcados,
        (semente, jogador, tom, marcados) => {
          const faixas = previa({ jogador, tom, marcados });
          const r = calcularPost({ jogador, tom, marcados, rng: criarRng(semente) });
          const dentro = (x: number, [min, max]: readonly [number, number]) => {
            expect(x).toBeGreaterThanOrEqual(min);
            expect(x).toBeLessThanOrEqual(max);
          };
          dentro(r.alcance, faixas.alcance);
          dentro(r.curtidasSimuladas, faixas.curtidas);
          dentro(r.seguidoresGanhos, faixas.seguidores);
          dentro(valor(r.deltas, 'polemica'), faixas.polemica);
          for (const rel of faixas.relacoes) {
            const m = marcados.find((x) => x.id === rel.id) as Marcado;
            dentro(afinidadeDepois(m.afinidade, r.deltas, m.id), rel.afinidade);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('calcularResposta', () => {
  it('usa o tom sincero, 30 % do alcance e mexe na relação com o autor', () => {
    const autor = { id: 'duda', afinidade: 72 };
    const resposta = calcularResposta({ jogador: JOGADOR, autor, rng: rngFixo(0) });
    // 1 200 × 1,4 × 1,1 × 0,3 × 0,85 = 471,24
    expect(resposta.alcance).toBe(471);
    const alto = calcularResposta({ jogador: JOGADOR, autor, rng: rngFixo(RNG_MAXIMO) });
    // sincero: relação 0..+3, carisma 50 → +4
    expect(valor(alto.deltas, 'relacao:duda')).toBe(4);
  });

  it('propriedade: delta com o autor entre 0 e o teto do sincero', () => {
    fc.assert(
      fc.property(
        fc.string(),
        arbJogador,
        fc.integer({ min: 0, max: 100 }),
        (semente, jogador, af) => {
          const r = calcularResposta({
            jogador,
            autor: { id: 'x', afinidade: af },
            rng: criarRng(semente),
          });
          const d = valor(r.deltas, 'relacao:x');
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThanOrEqual(5);
        },
      ),
    );
  });
});

describe('calcularDm', () => {
  it('delta de 0 a +2 ajustado pelo carisma', () => {
    expect(calcularDm({ afinidade: 50, carisma: 50, rng: rngFixo(0) })).toEqual({
      delta: 0,
      afinidade: 50,
    });
    // +2 × 1,2 = 2,4
    expect(calcularDm({ afinidade: 50, carisma: 50, rng: rngFixo(RNG_MAXIMO) })).toEqual({
      delta: 2,
      afinidade: 52,
    });
    // +2 × 1,7 = 3,4
    expect(calcularDm({ afinidade: 50, carisma: 100, rng: rngFixo(RNG_MAXIMO) }).delta).toBe(3);
    expect(calcularDm({ afinidade: 100, carisma: 100, rng: rngFixo(RNG_MAXIMO) })).toEqual({
      delta: 0,
      afinidade: 100,
    });
  });

  it('propriedade: afinidade em 0..100 e delta coerente', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (semente, afinidade, carisma) => {
          const r = calcularDm({ afinidade, carisma, rng: criarRng(semente) });
          expect(r.delta).toBeGreaterThanOrEqual(0);
          expect(r.delta).toBeLessThanOrEqual(3);
          expect(r.afinidade).toBe(afinidade + r.delta);
          expect(r.afinidade).toBeLessThanOrEqual(100);
        },
      ),
    );
  });
});
