import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Camada } from '../../ui/Camada';
import { Esfera } from '../../ui/Esfera';
import { MOLA, useMovimento } from '../../ui/movimento';
import { useTema } from '../../tema/ProvedorTema';

const BOLA = 26;
const TRILHO = 8;

export interface ControleDeslizanteProps {
  /** De 0 a 100. */
  valor: number;
  onMudar: (valor: number) => void;
  /** Lido pelo VoiceOver, ex.: "Tom do mundo". */
  rotulo: string;
  /** Valor falado, ex.: "70% caótico". */
  textoDoValor: string;
  /** Quanto cada gesto de ajuste do VoiceOver (deslizar para cima ou baixo) muda. */
  passo?: number;
}

const limitar = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** Escala da bola enquanto o dedo está nela. */
const ESCALA_ARRASTANDO = 1.18;

/**
 * Controle deslizante de 0 a 100 do tom do mundo (Figma 14:67): trilho afundado de 8, parte
 * preenchida em destaque-gráfico e bola em esfera clara de 26. Para o VoiceOver é um
 * `adjustable` com incremento e decremento. Arrastando, a bola e o preenchimento seguem o dedo
 * sem atraso e a bola cresce um pouco; mudanças discretas (VoiceOver) correm com mola.
 */
export function ControleDeslizante({
  valor,
  onMudar,
  rotulo,
  textoDoValor,
  passo = 10,
}: ControleDeslizanteProps) {
  const { cores } = useTema();
  const { reduzido, reduceMotion } = useMovimento();
  const [largura, setLargura] = useState(0);
  const curso = Math.max(1, largura - BOLA);
  const proporcao = limitar(valor) / 100;

  // Posição (0 a 1) e escala da bola na thread de UI: o dedo escreve direto, o resto vai com mola.
  const posicao = useSharedValue(proporcao);
  const escala = useSharedValue(1);
  const arrastando = useRef(false);
  const cursoUI = useSharedValue(curso);

  useEffect(() => {
    cursoUI.value = curso;
  }, [curso, cursoUI]);

  useEffect(() => {
    if (arrastando.current || reduzido) posicao.value = proporcao;
    else posicao.value = withSpring(proporcao, { ...MOLA.firme, reduceMotion });
  }, [proporcao, reduzido, reduceMotion, posicao]);

  const estiloDaBola = useAnimatedStyle(() => ({
    transform: [{ translateX: posicao.value * cursoUI.value }, { scale: escala.value }],
  }));
  const estiloDoPreenchimento = useAnimatedStyle(() => ({
    width: BOLA / 2 + posicao.value * cursoUI.value,
  }));

  const segurar = (segurando: boolean) => {
    arrastando.current = segurando;
    if (reduzido) return;
    escala.set(withSpring(segurando ? ESCALA_ARRASTANDO : 1, { ...MOLA.viva, reduceMotion }));
  };

  // Os filhos não recebem toque (pointerEvents none): locationX é sempre relativo ao controle.
  const mover = (evento: GestureResponderEvent) => {
    if (largura === 0) return;
    const novo = limitar(((evento.nativeEvent.locationX - BOLA / 2) / curso) * 100);
    // A bola não espera o React: o dedo escreve direto no valor da thread de UI.
    posicao.set(novo / 100);
    if (novo !== valor) onMudar(novo);
  };

  const ajustar = (evento: AccessibilityActionEvent) => {
    if (evento.nativeEvent.actionName === 'increment') onMudar(limitar(valor + passo));
    if (evento.nativeEvent.actionName === 'decrement') onMudar(limitar(valor - passo));
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={rotulo}
      accessibilityValue={{ min: 0, max: 100, now: limitar(valor), text: textoDoValor }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={ajustar}
      onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // Arrastar na horizontal não deve virar rolagem da tela.
      onResponderTerminationRequest={() => false}
      onResponderGrant={(evento) => {
        segurar(true);
        mover(evento);
      }}
      onResponderMove={mover}
      onResponderRelease={() => segurar(false)}
      onResponderTerminate={() => segurar(false)}
      hitSlop={{ top: 10, bottom: 10 }}
      style={estilos.controle}
    >
      <Camada
        pointerEvents="none"
        cor="superficie2"
        sombra="afundado"
        raio={TRILHO / 2}
        style={estilos.trilho}
      >
        <Animated.View
          style={[
            estilos.preenchido,
            { backgroundColor: cores.destaqueGrafico },
            estiloDoPreenchimento,
          ]}
        />
      </Camada>
      <Animated.View pointerEvents="none" style={[estilos.bola, estiloDaBola]}>
        <Esfera tom="claro" tamanho={BOLA} />
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  controle: { height: BOLA, justifyContent: 'center' },
  trilho: { height: TRILHO, overflow: 'hidden' },
  preenchido: { height: TRILHO, borderRadius: TRILHO / 2 },
  bola: { position: 'absolute', top: 0, left: 0 },
});
