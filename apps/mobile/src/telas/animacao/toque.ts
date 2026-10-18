import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ESCALA_TOQUE, MOLA, useMovimento } from '../../ui/movimento';

/**
 * Escala de toque para um Pressable que não vem de src/ui: encolhe com o dedo em cima e volta
 * com mola. Ligue `aoPressionar` em onPressIn e `aoSoltar` em onPressOut.
 */
export function useEscalaDeToque(alvo: number = ESCALA_TOQUE) {
  const { reduzido, reduceMotion } = useMovimento();
  const escala = useSharedValue(1);
  const estilo = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));
  return {
    estilo,
    aoPressionar: () => {
      if (!reduzido) escala.set(withSpring(alvo, { ...MOLA.firme, reduceMotion }));
    },
    aoSoltar: () => {
      escala.set(withSpring(1, { ...MOLA.firme, reduceMotion }));
    },
  };
}
