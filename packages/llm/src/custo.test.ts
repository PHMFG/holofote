import { describe, expect, it } from 'vitest';
import { PRECOS, PRECO_DESCONHECIDO, estimarCusto, precoDoModelo } from './custo';

describe('estimarCusto', () => {
  it('cobra cache a 10 % da entrada no DeepSeek V4.1 Flash', () => {
    const preco = PRECOS['deepseek-v4.1-flash'];
    expect(preco).toMatchObject({ entrada: 0.3, saida: 1.2, cache: 0.03, estimativa: false });
  });

  it('chamada típica do diretor fica abaixo de US$ 0,001', () => {
    // Conta do plano: 2.000 de entrada (1.500 em cache) e 350 de saída.
    const custo = estimarCusto('deepseek-v4.1-flash', { entrada: 2000, cache: 1500, saida: 350 });
    expect(custo).toBeCloseTo((500 * 0.3 + 1500 * 0.03 + 350 * 1.2) / 1e6, 12);
    expect(custo).toBeLessThanOrEqual(0.001);
  });

  it('marca os preços não documentados como estimativa', () => {
    for (const modelo of ['deepseek-v4-pro', 'mimo-v2.6-flash', 'glm-5.3-flash']) {
      expect(precoDoModelo(modelo).estimativa).toBe(true);
    }
  });

  it('usa o preço mais caro para modelo desconhecido', () => {
    expect(precoDoModelo('modelo-novo')).toBe(PRECO_DESCONHECIDO);
    const maisCaro = Math.max(...Object.values(PRECOS).map((p) => p.saida));
    expect(PRECO_DESCONHECIDO.saida).toBeGreaterThanOrEqual(maisCaro);
  });

  it('não deixa o cache passar da entrada nem valores negativos', () => {
    const uso = { entrada: 100, cache: 500, saida: -10 };
    expect(estimarCusto('deepseek-v4.1-flash', uso)).toBeCloseTo((100 * 0.03) / 1e6, 12);
  });
});
