import { StyleSheet, View } from 'react-native';
import { useTema } from '../tema/ProvedorTema';

export interface PontosDigitandoProps {
  /** Diâmetro de cada ponto. */
  tamanho?: number;
  /** Espaço entre os pontos. */
  espaco?: number;
}

/**
 * Os três pontinhos de "está digitando" (Figma 18:272 e 13 · Respostas): o primeiro mais
 * forte, os outros dois no tom fraco (decorativos: o texto de quem digita vem do pai).
 */
export function PontosDigitando({ tamanho = 6, espaco = 4 }: PontosDigitandoProps) {
  const { cores } = useTema();
  return (
    <View style={[estilos.linha, { gap: espaco }]} importantForAccessibility="no-hide-descendants">
      {(['textoSuave', 'textoFraco', 'textoFraco'] as const).map((cor, i) => (
        <View
          key={i}
          style={{
            width: tamanho,
            height: tamanho,
            borderRadius: tamanho / 2,
            backgroundColor: cores[cor],
          }}
        />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({ linha: { flexDirection: 'row', alignItems: 'center' } });
