// Números dos posts que os personagens publicam (feed inicial, lote diário e reações).
import { alcanceBase } from './acoes';
import { limitarAtributo } from './atributos';
import { entre } from './rng';
import type { Rng } from './tipos';

export interface EngajamentoPersonagem {
  curtidas: number;
  reposts: number;
}

/**
 * Curtidas e reposts de um post de personagem: alcance pela base de seguidores (o mesmo do
 * jogador), 3 % a 9 % de curtidas, e reposts de 1 % a 5 % das curtidas, puxados pela polêmica.
 */
export function engajamentoDePersonagem(entrada: {
  seguidores: number;
  polemica: number;
  rng: Rng;
}): EngajamentoPersonagem {
  const alcance = alcanceBase(entrada.seguidores);
  const curtidas = Math.round(alcance * entre(entrada.rng, 0.03, 0.09));
  const puxao = 1 + limitarAtributo(entrada.polemica) / 100;
  const reposts = Math.round(curtidas * entre(entrada.rng, 0.01, 0.05) * puxao);
  return { curtidas, reposts };
}

/**
 * Instantes de entrega espalhados numa janela: `quantidade` pontos em ordem crescente entre
 * `inicio` e `inicio + janelaMs`, com variação de até metade do passo.
 */
export function espalharEntregas(
  inicio: Date,
  janelaMs: number,
  quantidade: number,
  rng: Rng,
): Date[] {
  const n = Math.max(0, Math.floor(quantidade));
  if (n === 0) return [];
  const passo = Math.max(0, janelaMs) / n;
  return Array.from(
    { length: n },
    (_, i) => new Date(inicio.getTime() + Math.round(passo * i + entre(rng, 0, passo / 2))),
  );
}
