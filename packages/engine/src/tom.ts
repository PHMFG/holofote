// Tabela dos quatro tons de post (tela 12).
import type { Faixa, Tom } from './tipos';

export interface EfeitoTom {
  /** Multiplicador do alcance. */
  alcance: number;
  /** Delta de polêmica do jogador (inteiros, inclusivo). */
  polemica: Faixa;
  /** Delta de relação com cada marcado, antes do ajuste por carisma. */
  relacao: Faixa;
  /** Delta pequeno de carisma do jogador. */
  carisma: Faixa;
}

export const TONS: Readonly<Record<Tom, EfeitoTom>> = {
  fofo: { alcance: 0.9, polemica: [-2, 0], relacao: [1, 4], carisma: [0, 1] },
  sincero: { alcance: 1.0, polemica: [0, 2], relacao: [0, 3], carisma: [0, 0] },
  misterioso: { alcance: 1.1, polemica: [1, 3], relacao: [-1, 2], carisma: [0, 0] },
  provocativo: { alcance: 1.3, polemica: [4, 8], relacao: [-5, -2], carisma: [-1, 0] },
};

export const LISTA_TONS: readonly Tom[] = ['fofo', 'sincero', 'misterioso', 'provocativo'];
