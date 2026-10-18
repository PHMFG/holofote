// Curtidas chegam aos poucos: o número gravado no post é o total que ele vai ter, e a contagem
// mostrada sobe até ele com a idade do post (rápido no começo, devagar no fim).

/** Tempo característico da subida: com essa idade o post tem cerca de 63 % das curtidas. */
export const SUBIDA_CURTIDAS_MS = 12 * 60_000;

/** A partir dessa idade (cerca de 1 h 12 min) o post já tem todas as curtidas. */
export const FIM_SUBIDA_CURTIDAS_MS = 6 * SUBIDA_CURTIDAS_MS;

/**
 * Curtidas que um post com `total` curtidas tem com `idadeMs` de vida: curva de saturação
 * 1 - e^(-t/τ), arredondada para baixo, nunca acima do total. Post recém-chegado tem 0.
 */
export function curtidasNoInstante(total: number, idadeMs: number): number {
  const finais = Math.max(0, Math.floor(total));
  if (finais === 0 || idadeMs <= 0) return 0;
  if (idadeMs >= FIM_SUBIDA_CURTIDAS_MS) return finais;
  return Math.min(finais, Math.floor(finais * (1 - Math.exp(-idadeMs / SUBIDA_CURTIDAS_MS))));
}
