import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Camada } from './Camada';
import { Esfera } from './Esfera';
import { toqueDeSelecao } from './haptico';
import { MOLA, useMovimento } from './movimento';
import { PressableAnimado, useFeedbackDoToque } from './Tocavel';

export interface InterruptorProps {
  valor: boolean;
  onMudar: (valor: boolean) => void;
  /** Lido pelo VoiceOver, ex.: "Personagens puxam conversa". */
  rotulo: string;
  desabilitado?: boolean;
}

const LARGURA = 44;
const ALTURA = 26;
const BOLA = 20;
const FOLGA = 3;
const CURSO = LARGURA - BOLA - FOLGA * 2;

/**
 * Interruptor 44 x 26 (10 · Aparência). Ligado: trilho em Pílula preta; desligado: afundado.
 * A bola é uma esfera clara (no escuro, a Esfera clara escura do Figma). A bola desliza na mola
 * "firme" e cresce um pouco sob o dedo; o trilho troca de afundado para pílula em crossfade e a
 * troca dá um háptico de seleção. Com movimento reduzido, tudo troca na hora.
 */
export function Interruptor({ valor, onMudar, rotulo, desabilitado }: InterruptorProps) {
  const { reduzido } = useMovimento();
  // 0 desligado, 1 ligado (a mola passa um pouco do alvo).
  const posicao = useSharedValue(valor ? 1 : 0);
  const feedback = useFeedbackDoToque({}, { escala: 1, brilho: 1, desabilitado: !!desabilitado });
  const { pressao } = feedback;

  useEffect(() => {
    const alvo = valor ? 1 : 0;
    posicao.value = reduzido ? alvo : withSpring(alvo, MOLA.firme);
  }, [valor, reduzido, posicao]);

  const bola = useAnimatedStyle(() => ({
    transform: [
      { translateX: posicao.value * CURSO },
      { scale: reduzido ? 1 : 1 + 0.12 * Math.max(0, pressao.value) },
    ],
  }));
  const ligado = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, posicao.value)),
  }));

  return (
    <PressableAnimado
      onPress={() => {
        toqueDeSelecao();
        onMudar(!valor);
      }}
      onPressIn={feedback.onPressIn}
      onPressOut={feedback.onPressOut}
      disabled={desabilitado}
      accessibilityRole="switch"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: valor, disabled: !!desabilitado }}
      hitSlop={8}
      style={feedback.style}
    >
      {/* O trilho corta a sombra da bola, como no Figma. */}
      <View style={estilos.trilho}>
        <Camada
          cor="superficie2"
          sombra="afundado"
          raio={ALTURA / 2}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, ligado]}>
          <Camada gradiente="pilulaPreta" raio={ALTURA / 2} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[estilos.bola, bola]}>
          <Esfera tom="claro" tamanho={BOLA} />
        </Animated.View>
      </View>
    </PressableAnimado>
  );
}

const estilos = StyleSheet.create({
  trilho: { width: LARGURA, height: ALTURA, borderRadius: ALTURA / 2, overflow: 'hidden' },
  bola: { position: 'absolute', top: FOLGA, left: FOLGA },
});
