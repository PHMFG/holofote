import { comSinal, formatarNumero } from '../../formatar';

/** Faixa da prévia do motor: "+4 a +8", "−5 a −2%" ou um valor só quando os extremos batem. */
export function faixaComSinal([de, ate]: readonly [number, number], sufixo = ''): string {
  if (de === ate) return comSinal(de, sufixo);
  return `${comSinal(de)} a ${comSinal(ate)}${sufixo}`;
}

/** Faixa de quantidade (alcance): "2,1 mil a 3,4 mil". */
export function faixaQuantidade([de, ate]: readonly [number, number]): string {
  if (de === ate) return formatarNumero(de);
  return `${formatarNumero(de)} a ${formatarNumero(ate)}`;
}

/** "+214 seguidores", "−3 seguidores", "1 seguidor". */
export function rotuloSeguidores(ganhos: number): string {
  return `${ganhos === 0 ? '0' : comSinal(ganhos)} ${Math.abs(ganhos) === 1 ? 'seguidor' : 'seguidores'}`;
}
