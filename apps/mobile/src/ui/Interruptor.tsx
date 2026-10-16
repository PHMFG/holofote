import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Camada } from './Camada';
import { Esfera } from './Esfera';

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

/**
 * Interruptor 44 x 26 (10 · Aparência). Ligado: trilho em Pílula preta; desligado: afundado.
 * A bola é uma esfera clara (no escuro, a Esfera clara escura do Figma).
 */
export function Interruptor({ valor, onMudar, rotulo, desabilitado }: InterruptorProps) {
  // Valor animado criado uma vez; useState evita ler ref durante o render.
  const [posicao] = useState(() => new Animated.Value(valor ? 1 : 0));

  useEffect(() => {
    Animated.timing(posicao, {
      toValue: valor ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [valor, posicao]);

  const deslocamento = posicao.interpolate({
    inputRange: [0, 1],
    outputRange: [0, LARGURA - BOLA - FOLGA * 2],
  });

  return (
    <Pressable
      onPress={() => onMudar(!valor)}
      disabled={desabilitado}
      accessibilityRole="switch"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: valor, disabled: !!desabilitado }}
      hitSlop={8}
      style={{ opacity: desabilitado ? 0.5 : 1 }}
    >
      <Camada
        gradiente={valor ? 'pilulaPreta' : undefined}
        cor={valor ? undefined : 'superficie2'}
        sombra={valor ? undefined : 'afundado'}
        raio={ALTURA / 2}
        // O trilho corta a sombra da bola, como no Figma.
        style={estilos.trilho}
      >
        <Animated.View style={[estilos.bola, { transform: [{ translateX: deslocamento }] }]}>
          <Esfera tom="claro" tamanho={BOLA} />
        </Animated.View>
      </Camada>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  trilho: { width: LARGURA, height: ALTURA, overflow: 'hidden' },
  bola: { position: 'absolute', top: FOLGA, left: FOLGA },
});
