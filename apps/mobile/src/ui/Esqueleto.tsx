import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { useMovimento } from './movimento';

/** Tempo de uma passada do brilho e quanto da largura a faixa de brilho ocupa. */
const PASSADA_MS = 1400;
const FAIXA = 0.6;

export interface EsqueletoProps {
  largura?: DimensionValue;
  altura?: number;
  raio?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bloco de carregamento: fundo afundado (superficie-2) com uma faixa de brilho (superficie) que
 * passa da esquerda para a direita em laço, no thread de UI. Só tokens do tema. Com movimento
 * reduzido fica parado, sem brilho. Decorativo: quem usa dá o rótulo "Carregando" ao conjunto.
 */
export function Esqueleto({ largura = '100%', altura = 14, raio = 7, style }: EsqueletoProps) {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const fase = useSharedValue(0);
  const medida = useSharedValue(0);

  useEffect(() => {
    if (reduzido) return;
    fase.value = 0;
    fase.value = withRepeat(withTiming(1, { duration: PASSADA_MS, easing: Easing.linear }), -1);
    return () => cancelAnimation(fase);
  }, [reduzido, fase]);

  const faixa = useAnimatedStyle(() => ({
    width: medida.value * FAIXA,
    transform: [{ translateX: -medida.value * FAIXA + fase.value * medida.value * (1 + FAIXA) }],
  }));

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        medida.value = e.nativeEvent.layout.width;
      }}
      style={[
        estilos.base,
        { width: largura, height: altura, borderRadius: raio, backgroundColor: cores.superficie2 },
        style,
      ]}
    >
      {!reduzido && (
        <Animated.View pointerEvents="none" style={[estilos.faixa, faixa]}>
          <LinearGradient
            colors={[cores.superficie2, cores.superficie, cores.superficie2]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  base: { overflow: 'hidden' },
  faixa: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
