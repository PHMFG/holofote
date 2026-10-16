/** Números do jogo no estilo das telas: 128, 7,1 mil, 1,2 mi. */
export function formatarNumero(n: number): string {
  const absoluto = Math.abs(n);
  const curto = (valor: number, sufixo: string) =>
    `${(Math.trunc(valor * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${sufixo}`;
  if (absoluto >= 1_000_000) return curto(n / 1_000_000, 'mi');
  if (absoluto >= 1_000) return curto(n / 1_000, 'mil');
  return String(n);
}
