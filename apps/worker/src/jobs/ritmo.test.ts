import { describe, expect, it } from 'vitest';
import { atrasoDaReacao, PRIMEIRA_REACAO_SEG, ULTIMA_REACAO_ATE_SEG } from './diretor';

describe('atrasoDaReacao', () => {
  it('a primeira chega logo e as seguintes guardam a ordem, mais próximas', () => {
    const atrasos = [45, 86, 131].map((s) => atrasoDaReacao(s, 45));
    expect(atrasos[0]).toBe(PRIMEIRA_REACAO_SEG * 1000);
    expect(atrasos).toEqual([...atrasos].sort((a, b) => a - b));
    expect(atrasos[2]! - atrasos[0]!).toBeLessThan((131 - 45) * 1000);
  });

  it('nenhuma passa do teto, nem quando a IA marca 15 minutos', () => {
    expect(atrasoDaReacao(900, 20)).toBe(ULTIMA_REACAO_ATE_SEG * 1000);
  });
});
