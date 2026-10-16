import { describe, expect, it } from 'vitest';
import { FILAS } from './index';

describe('FILAS', () => {
  it('tem as cinco filas do plano, com nome igual à chave', () => {
    expect(Object.keys(FILAS)).toEqual(['diretor', 'dm', 'lote', 'memoria', 'entrega']);
    for (const [chave, nome] of Object.entries(FILAS)) {
      expect(nome).toBe(chave);
    }
  });
});
