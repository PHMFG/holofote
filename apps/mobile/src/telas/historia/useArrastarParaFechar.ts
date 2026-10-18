import { useMemo } from 'react';
import { PanResponder, useWindowDimensions } from 'react-native';
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { CURVA, DURACAO, MOLA } from '../../ui/movimento';

/** Distância, em pontos, que fecha a história ao soltar. */
const LIMITE = 120;
/** Distância em que o conteúdo já encolheu e esmaeceu por inteiro. */
const ALCANCE = 360;

/**
 * Arrastar para baixo fecha a história (o fullScreenModal do iOS não tem esse gesto). O conteúdo
 * acompanha o dedo e, quanto mais desce, mais encolhe e esmaece; solto antes do limite, volta com
 * mola; solto depois, segue para baixo enquanto o modal fecha. O deslocamento é um valor
 * compartilhado do Reanimated: o estilo roda na thread de UI, sem renderização por quadro.
 * Com animações reduzidas, o conteúdo não acompanha o dedo, mas o gesto continua fechando.
 * `onFechar` deve ser estável (função de módulo ou useCallback).
 */
export function useArrastarParaFechar(onFechar: () => void, reduzir: boolean) {
  const { height: alturaDaTela } = useWindowDimensions();
  const deslocamento = useSharedValue(0);

  const estilo = useAnimatedStyle(() => {
    const progresso = interpolate(deslocamento.value, [0, ALCANCE], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: 1 - 0.5 * progresso,
      transform: [{ translateY: deslocamento.value }, { scale: 1 - 0.08 * progresso }],
    };
  });

  const gesto = useMemo(() => {
    const voltar = () => {
      deslocamento.set(reduzir ? 0 : withSpring(0, MOLA.firme));
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_e, g) => {
        if (!reduzir) deslocamento.set(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > LIMITE || g.vy > 1.2) {
          if (!reduzir) {
            deslocamento.set(
              withTiming(alturaDaTela, { duration: DURACAO.media, easing: CURVA.entradaSaida }),
            );
          }
          onFechar();
        } else voltar();
      },
      onPanResponderTerminate: voltar,
    });
  }, [deslocamento, alturaDaTela, onFechar, reduzir]);

  return { estilo, arrastar: gesto.panHandlers };
}
