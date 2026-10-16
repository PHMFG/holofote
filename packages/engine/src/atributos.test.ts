import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ajustarDeltaRelacao,
  arredondar,
  chanceDeCrise,
  decairPolemica,
  limitar,
  limitarAtributo,
  multFama,
  multPolemica,
  sortearCrise,
} from './atributos';
import { rngFixo } from './rng';

describe('arredondar e limitar', () => {
  it('arredonda simétrico em torno de zero e nunca devolve −0', () => {
    expect(arredondar(2.5)).toBe(3);
    expect(arredondar(-2.5)).toBe(-3);
    expect(arredondar(-1.4)).toBe(-1);
    expect(Object.is(arredondar(-0.2), 0)).toBe(true);
  });

  it('limitarAtributo fica em 0..100 e inteiro', () => {
    expect(limitarAtributo(-4)).toBe(0);
    expect(limitarAtributo(140)).toBe(100);
    expect(limitarAtributo(49.6)).toBe(50);
    expect(limitar(5, 0, 3)).toBe(3);
  });
});

describe('multiplicadores', () => {
  it('fama: 1 + fama / 50', () => {
    expect(multFama(0)).toBe(1);
    expect(multFama(20)).toBeCloseTo(1.4);
    expect(multFama(50)).toBe(2);
    expect(multFama(100)).toBe(3);
    expect(multFama(300)).toBe(3);
  });

  it('polêmica: 1 + polêmica / 100', () => {
    expect(multPolemica(0)).toBe(1);
    expect(multPolemica(10)).toBeCloseTo(1.1);
    expect(multPolemica(100)).toBe(2);
    expect(multPolemica(-10)).toBe(1);
  });
});

describe('ajustarDeltaRelacao', () => {
  it('ganho × (0,7 + carisma / 100), perda × (1,3 − carisma / 100)', () => {
    expect(ajustarDeltaRelacao(4, 50)).toBe(5); // 4 × 1,2 = 4,8
    expect(ajustarDeltaRelacao(-4, 50)).toBe(-3); // −4 × 0,8 = −3,2
    expect(ajustarDeltaRelacao(4, 0)).toBe(3); // 2,8
    expect(ajustarDeltaRelacao(-5, 0)).toBe(-7); // −6,5
    expect(ajustarDeltaRelacao(-1, 100)).toBe(0); // −0,3
    expect(ajustarDeltaRelacao(3, 30)).toBe(3); // carisma 30 é neutro
    expect(ajustarDeltaRelacao(-3, 30)).toBe(-3);
    expect(ajustarDeltaRelacao(0, 80)).toBe(0);
  });

  it('nunca troca o sinal e mais carisma nunca piora o resultado', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -20, max: 20 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (delta, c1, c2) => {
          const [baixo, alto] = c1 <= c2 ? [c1, c2] : [c2, c1];
          const a = ajustarDeltaRelacao(delta, baixo);
          const b = ajustarDeltaRelacao(delta, alto);
          expect(Math.sign(a) === 0 || Math.sign(a) === Math.sign(delta)).toBe(true);
          expect(b).toBeGreaterThanOrEqual(a);
        },
      ),
    );
  });
});

describe('polêmica', () => {
  it('decai 3 por dia inteiro sem provocação, até 0', () => {
    expect(decairPolemica(10, 2)).toBe(4);
    expect(decairPolemica(10, 2.9)).toBe(4);
    expect(decairPolemica(2, 1)).toBe(0);
    expect(decairPolemica(40, -3)).toBe(40);
  });

  it('crise só acima de 70, com 20 %', () => {
    expect(chanceDeCrise(70)).toBe(0);
    expect(chanceDeCrise(71)).toBe(0.2);
    expect(sortearCrise(71, rngFixo(0.19))).toBe(true);
    expect(sortearCrise(71, rngFixo(0.2))).toBe(false);
    expect(sortearCrise(50, rngFixo(0))).toBe(false);
  });
});
