import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { curtidasNoInstante, FIM_SUBIDA_CURTIDAS_MS, SUBIDA_CURTIDAS_MS } from './curtidas';

describe('curtidasNoInstante', () => {
  it('começa em 0, passa da metade no tempo característico e chega ao total no fim', () => {
    expect(curtidasNoInstante(1000, 0)).toBe(0);
    expect(curtidasNoInstante(1000, 60_000)).toBe(79);
    expect(curtidasNoInstante(1000, SUBIDA_CURTIDAS_MS)).toBe(632);
    expect(curtidasNoInstante(1000, FIM_SUBIDA_CURTIDAS_MS)).toBe(1000);
  });

  it('nunca desce com o tempo nem passa do total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: -60_000, max: 3 * FIM_SUBIDA_CURTIDAS_MS }),
        fc.integer({ min: 0, max: 600_000 }),
        (total, idade, passo) => {
          const antes = curtidasNoInstante(total, idade);
          const depois = curtidasNoInstante(total, idade + passo);
          expect(antes).toBeGreaterThanOrEqual(0);
          expect(depois).toBeGreaterThanOrEqual(antes);
          expect(depois).toBeLessThanOrEqual(total);
        },
      ),
    );
  });
});
