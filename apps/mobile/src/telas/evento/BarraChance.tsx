import { View } from 'react-native';
import { useTema } from '../../tema/ProvedorTema';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { Camada } from '../../ui/Camada';

export interface BarraChanceProps {
  /** De 0 a 1. */
  valor: number;
  rotulo: string;
  altura: 8 | 6;
  /** A barra do jogador (ou do seu voto) vai em destaque; as outras ficam em cinza. */
  destaque: boolean;
}

/**
 * Barra de comparação dos indicados (16 · Evento) e da enquete (15 · História). No Figma o
 * trilho é chapado e só a barra do jogador usa o destaque; as outras usam texto-fraco, uma
 * variante que o BarraProgresso não tem.
 */
export function BarraChance({ valor, rotulo, altura, destaque }: BarraChanceProps) {
  const { cores } = useTema();
  if (destaque) {
    return <BarraProgresso valor={valor} rotulo={rotulo} altura={altura} variante="chapada" />;
  }
  const proporcao = Math.min(1, Math.max(0, valor));
  return (
    <Camada
      cor="superficie2"
      raio={altura / 2}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={rotulo}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(proporcao * 100) }}
      style={{ height: altura, overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${proporcao * 100}%`,
          height: altura,
          borderRadius: altura / 2,
          backgroundColor: cores.textoFraco,
        }}
      />
    </Camada>
  );
}
