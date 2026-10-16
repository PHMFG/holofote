import { describe, expect, it } from 'vitest';
import { LISTA_TONS, TONS } from './tom';

describe('tabela de tons', () => {
  it('reproduz a tabela do plano', () => {
    expect(TONS.fofo).toMatchObject({ alcance: 0.9, polemica: [-2, 0], relacao: [1, 4] });
    expect(TONS.sincero).toMatchObject({ alcance: 1.0, polemica: [0, 2], relacao: [0, 3] });
    expect(TONS.misterioso).toMatchObject({ alcance: 1.1, polemica: [1, 3], relacao: [-1, 2] });
    expect(TONS.provocativo).toMatchObject({ alcance: 1.3, polemica: [4, 8], relacao: [-5, -2] });
  });

  it('carisma: fofo 0..+1, provocativo −1..0, os outros não mexem', () => {
    expect(TONS.fofo.carisma).toEqual([0, 1]);
    expect(TONS.sincero.carisma).toEqual([0, 0]);
    expect(TONS.misterioso.carisma).toEqual([0, 0]);
    expect(TONS.provocativo.carisma).toEqual([-1, 0]);
  });

  it('lista os quatro tons na ordem da tela', () => {
    expect(LISTA_TONS).toEqual(['fofo', 'sincero', 'misterioso', 'provocativo']);
    expect(Object.keys(TONS).sort()).toEqual([...LISTA_TONS].sort());
  });
});
