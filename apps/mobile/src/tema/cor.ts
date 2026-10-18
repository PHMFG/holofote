/** A cor com opacidade 0 (#rrggbb00), para um gradiente até o transparente não passar por cinza. */
export function semOpacidade(cor: string): string {
  return /^#[0-9a-f]{6}$/i.test(cor) ? `${cor}00` : 'transparent';
}
