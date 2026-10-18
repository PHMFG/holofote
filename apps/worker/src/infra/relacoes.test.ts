import { describe, expect, it } from 'vitest';
import { FAIXA_EXTREMA, TETO_SUGESTAO, sugestaoEfetiva } from './relacoes';

describe('sugestaoEfetiva', () => {
  it('limita a sugestão da IA a ±TETO_SUGESTAO, arredondada', () => {
    expect(sugestaoEfetiva(50, 7)).toBe(TETO_SUGESTAO);
    expect(sugestaoEfetiva(50, -5)).toBe(-TETO_SUGESTAO);
    expect(sugestaoEfetiva(50, 1.4)).toBe(1);
    expect(sugestaoEfetiva(50, 0.2)).toBe(0);
  });

  it('não empurra para o extremo quem já está na faixa extrema', () => {
    expect(sugestaoEfetiva(FAIXA_EXTREMA.alta, 2)).toBe(0);
    expect(sugestaoEfetiva(FAIXA_EXTREMA.baixa, -2)).toBe(0);
  });

  it('deixa a relação extrema voltar para o meio', () => {
    expect(sugestaoEfetiva(95, -2)).toBe(-2);
    expect(sugestaoEfetiva(5, 2)).toBe(2);
  });
});
