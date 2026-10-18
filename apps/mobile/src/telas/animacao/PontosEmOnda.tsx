import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { useMovimento } from '../../ui/movimento';

const CICLO_MS = 1200;
/** Defasagem entre os pontos, em fração do ciclo: a onda anda da esquerda para a direita. */
const DEFASAGEM = 0.16;
/** Quanto do ciclo cada ponto passa em movimento; o resto é pausa. */
const JANELA = 0.55;
const SUBIDA = 4;

export interface PontosEmOndaProps {
  /** Diâmetro de cada ponto. */
  tamanho?: number;
  /** Espaço entre os pontos. */
  espaco?: number;
}

/**
 * Os três pontinhos de "está digitando" em onda: cada um sobe e escurece um pouco depois do
 * anterior. Um só valor compartilhado em loop na thread de UI. Com movimento reduzido ficam
 * parados, como o PontosDigitando de src/ui. Decorativos para o VoiceOver.
 */
export function PontosEmOnda({ tamanho = 6, espaco = 4 }: PontosEmOndaProps) {
  const { reduzido } = useMovimento();
  const ciclo = useSharedValue(0);

  useEffect(() => {
    if (reduzido) return;
    ciclo.value = 0;
    ciclo.value = withRepeat(
      withTiming(1, { duration: CICLO_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(ciclo);
  }, [reduzido, ciclo]);

  return (
    <View style={[estilos.linha, { gap: espaco }]} importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((i) => (
        <Ponto key={i} indice={i} tamanho={tamanho} ciclo={ciclo} reduzido={reduzido} />
      ))}
    </View>
  );
}

function Ponto({
  indice,
  tamanho,
  ciclo,
  reduzido,
}: {
  indice: number;
  tamanho: number;
  ciclo: { value: number };
  reduzido: boolean;
}) {
  const { cores } = useTema();
  const estilo = useAnimatedStyle(() => {
    if (reduzido) return { opacity: indice === 0 ? 1 : 0.55 };
    const fase = (((ciclo.value - indice * DEFASAGEM) % 1) + 1) % 1;
    const salto = fase < JANELA ? Math.sin((fase / JANELA) * Math.PI) : 0;
    return {
      opacity: 0.45 + 0.55 * salto,
      transform: [{ translateY: -SUBIDA * salto }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho / 2,
          backgroundColor: cores.textoSuave,
        },
        estilo,
      ]}
    />
  );
}

const estilos = StyleSheet.create({ linha: { flexDirection: 'row', alignItems: 'center' } });
