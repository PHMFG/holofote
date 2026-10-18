import { BarraAnimada } from '../perfil/efeitos';

export interface BarraChanceProps {
  /** De 0 a 1. */
  valor: number;
  rotulo: string;
  altura: 8 | 6;
  /** A barra do jogador (ou do seu voto) vai em destaque; as outras ficam em cinza. */
  destaque: boolean;
  /** Atraso em ms da primeira subida, para as barras encherem em cascata. */
  atraso?: number;
}

/**
 * Barra de comparação dos indicados (16 · Evento) e da enquete (15 · História). No Figma o
 * trilho é chapado e só a barra do jogador usa o destaque; as outras usam texto-fraco, uma
 * variante que o BarraProgresso não tem. Enche do zero ao abrir e anda até o valor novo quando
 * a chance muda (depois de uma ação de campanha).
 */
export function BarraChance({ valor, rotulo, altura, destaque, atraso = 0 }: BarraChanceProps) {
  return (
    <BarraAnimada
      valor={valor}
      rotulo={rotulo}
      altura={altura}
      atraso={atraso}
      variante="chapada"
      preenchimento={destaque ? 'destaque' : 'textoFraco'}
    />
  );
}
