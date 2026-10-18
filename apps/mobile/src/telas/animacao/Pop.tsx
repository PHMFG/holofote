import { useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CURVA, DURACAO, MOLA, useMovimento } from '../../ui/movimento';

/** Estilo animado de um "pop": cresce além do tamanho e volta com mola quando o gatilho muda. */
export function usePop(gatilho: unknown, { soAoLigar = false, escala = 1.3 } = {}) {
  const { reduzido, reduceMotion } = useMovimento();
  const valor = useSharedValue(1);
  const anterior = useRef(gatilho);

  useEffect(() => {
    if (anterior.current === gatilho) return;
    anterior.current = gatilho;
    if (reduzido || (soAoLigar && !gatilho)) return;
    valor.value = withSequence(
      withTiming(escala, { duration: DURACAO.instante, easing: CURVA.saida, reduceMotion }),
      withSpring(1, { ...MOLA.viva, reduceMotion }),
    );
  }, [gatilho, soAoLigar, escala, reduzido, reduceMotion, valor]);

  return useAnimatedStyle(() => ({ transform: [{ scale: valor.value }] }));
}

export interface PopProps {
  /** O pop dispara quando este valor muda (a primeira exibição não conta). */
  gatilho: unknown;
  /** Só dispara quando o gatilho passa a ser verdadeiro (curtir sim, descurtir não). */
  soAoLigar?: boolean;
  escala?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Envolve um elemento que dá um "pop" quando algo muda (coração curtido, voto escolhido). */
export function Pop({ gatilho, soAoLigar, escala, children, style }: PopProps) {
  const estilo = usePop(gatilho, { soAoLigar, escala });
  return <Animated.View style={[style, estilo]}>{children}</Animated.View>;
}
