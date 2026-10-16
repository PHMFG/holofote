/** Milissegundos até a próxima unidade da recarga natural; null com a barra cheia. */
export function msAteRecarga(proximaEm: string | null, agora: number): number | null {
  if (!proximaEm) return null;
  return Date.parse(proximaEm) - agora;
}

/** "18 min", "1 min" (arredonda para cima: nunca promete antes da hora). */
export function textoMinutos(ms: number): string {
  return `${Math.max(1, Math.ceil(ms / 60_000))} min`;
}
