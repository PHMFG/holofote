import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { CURVA, DURACAO, useMovimento } from '../../ui/movimento';

export interface ColapsavelProps {
  aberto: boolean;
  children: ReactNode;
  /** Espaço (`gap`) que o pai põe entre os filhos: compensado para fechado não deixar vão. */
  gap?: number;
  /** Margem lateral do pai que o conteúdo precisa atravessar (listas que vão de ponta a ponta). */
  sangria?: number;
}

/**
 * Bloco que abre e fecha animando a altura (e o fade) na thread de UI. O conteúdo só existe
 * montado enquanto aberto ou abrindo/fechando; a altura vem da medida do próprio conteúdo.
 */
export function Colapsavel({ aberto, children, gap = 0, sangria = 0 }: ColapsavelProps) {
  const { reduzido, reduceMotion } = useMovimento();
  const [montado, setMontado] = useState(aberto);
  const progresso = useSharedValue(aberto ? 1 : 0);
  const medida = useSharedValue(0);

  // Abrir monta o conteúdo na mesma renderização (a medida vem depois, de aoMedir).
  if (aberto && !montado) setMontado(true);

  useEffect(() => {
    const config = { duration: DURACAO.media, easing: CURVA.entradaSaida, reduceMotion };
    if (aberto) {
      // Sem medida ainda, a abertura começa quando o conteúdo se mede (aoMedir).
      if (medida.get() > 0) progresso.set(withTiming(1, config));
    } else {
      const fechou = () => {
        setMontado(false);
        medida.set(0);
      };
      progresso.set(
        withTiming(0, config, (terminou) => {
          if (terminou) runOnJS(fechou)();
        }),
      );
    }
  }, [aberto, reduceMotion, medida, progresso]);

  const aoMedir = (evento: LayoutChangeEvent) => {
    const altura = evento.nativeEvent.layout.height;
    if (medida.get() === 0) {
      medida.set(altura);
      if (aberto && progresso.get() < 1) {
        progresso.set(
          withTiming(1, {
            duration: reduzido ? 0 : DURACAO.media,
            easing: CURVA.entradaSaida,
            reduceMotion,
          }),
        );
      }
    } else {
      medida.set(withTiming(altura, { duration: DURACAO.rapida, reduceMotion }));
    }
  };

  const estilo = useAnimatedStyle(() => ({
    height: medida.value * progresso.value,
    opacity: progresso.value,
    marginTop: -gap * (1 - progresso.value),
  }));

  if (!montado) return null;
  return (
    <Animated.View style={[estilos.janela, { marginHorizontal: -sangria }, estilo]}>
      <View onLayout={aoMedir} style={[estilos.conteudo, { paddingHorizontal: sangria }]}>
        {children}
      </View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  janela: { overflow: 'hidden' },
  conteudo: { position: 'absolute', left: 0, right: 0, top: 0 },
});
