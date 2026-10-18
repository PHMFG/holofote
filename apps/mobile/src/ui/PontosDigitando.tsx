import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { useMovimento } from './movimento';

export interface PontosDigitandoProps {
  /** Diâmetro de cada ponto. */
  tamanho?: number;
  /** Espaço entre os pontos. */
  espaco?: number;
}

/** Ciclo da onda dos pontos e defasagem de um ponto para o seguinte (fração do ciclo). */
const CICLO_MS = 1100;
const DEFASAGEM = 0.18;

/**
 * Os três pontinhos de "está digitando" (Figma 18:272 e 13 · Respostas): o primeiro mais
 * forte, os outros dois no tom fraco (decorativos: o texto de quem digita vem do pai). Cada
 * ponto sobe e desce em onda, defasado do anterior, num laço no thread de UI. Com movimento
 * reduzido ficam parados.
 */
export function PontosDigitando({ tamanho = 6, espaco = 4 }: PontosDigitandoProps) {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const fase = useSharedValue(0);

  useEffect(() => {
    if (reduzido) return;
    fase.value = 0;
    fase.value = withRepeat(withTiming(1, { duration: CICLO_MS, easing: Easing.linear }), -1);
    return () => cancelAnimation(fase);
  }, [reduzido, fase]);

  return (
    <View style={[estilos.linha, { gap: espaco }]} importantForAccessibility="no-hide-descendants">
      {(['textoSuave', 'textoFraco', 'textoFraco'] as const).map((cor, i) => (
        <Ponto
          key={i}
          indice={i}
          fase={fase}
          parado={reduzido}
          tamanho={tamanho}
          cor={cores[cor]}
        />
      ))}
    </View>
  );
}

function Ponto({
  indice,
  fase,
  parado,
  tamanho,
  cor,
}: {
  indice: number;
  fase: SharedValue<number>;
  parado: boolean;
  tamanho: number;
  cor: string;
}) {
  const estilo = useAnimatedStyle(() => {
    if (parado) return { transform: [{ translateY: 0 }] };
    // 0 em repouso, 1 no alto da onda: meia-lua de cosseno no começo do ciclo do ponto.
    const t = (((fase.value - indice * DEFASAGEM) % 1) + 1) % 1;
    const onda = t < 0.5 ? 0.5 - 0.5 * Math.cos(t * 2 * Math.PI * 2) : 0;
    return { transform: [{ translateY: -onda * tamanho * 0.6 }] };
  });
  return (
    <Animated.View
      style={[
        { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cor },
        estilo,
      ]}
    />
  );
}

const estilos = StyleSheet.create({ linha: { flexDirection: 'row', alignItems: 'center' } });
