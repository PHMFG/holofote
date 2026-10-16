/**
 * As memórias chegam como "Dia 6 · mandou indireta sobre feat" (o servidor grava assim). Separa o
 * dia para a pílula de data do Figma (26:425); sem o prefixo, fica só o texto.
 */
export function separarDia(fato: string): { dia: string | null; texto: string } {
  const partes = /^(Dia \d+)\s*·\s*(.+)$/.exec(fato.trim());
  return partes ? { dia: partes[1]!, texto: partes[2]! } : { dia: null, texto: fato.trim() };
}
