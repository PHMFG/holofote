import { useMemo, useState } from 'react';
import { Animated, PanResponder } from 'react-native';

/** Distância, em pontos, que fecha a história ao soltar. */
const LIMITE = 120;

/**
 * Arrastar para baixo fecha a história (o fullScreenModal do iOS não tem esse gesto). Com
 * animações reduzidas, o conteúdo não acompanha o dedo, mas o gesto continua fechando.
 * `onFechar` deve ser estável (função de módulo ou useCallback).
 */
export function useArrastarParaFechar(onFechar: () => void, reduzir: boolean) {
  const [deslocamento] = useState(() => new Animated.Value(0));

  const gesto = useMemo(() => {
    const voltar = () => {
      if (reduzir) {
        deslocamento.setValue(0);
        return;
      }
      Animated.spring(deslocamento, { toValue: 0, bounciness: 0, useNativeDriver: true }).start();
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_e, g) => {
        if (!reduzir) deslocamento.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > LIMITE || g.vy > 1.2) onFechar();
        else voltar();
      },
      onPanResponderTerminate: voltar,
    });
  }, [deslocamento, onFechar, reduzir]);

  return { deslocamento, arrastar: gesto.panHandlers };
}
