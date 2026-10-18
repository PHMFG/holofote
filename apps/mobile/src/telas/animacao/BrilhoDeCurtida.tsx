import { Heart } from 'lucide-react-native';
import { useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { CURVA, useMovimento } from '../../ui/movimento';

const TAMANHO = 22;
/** Corações do brilho: deslocamento horizontal final, atraso (em fração do progresso) e giro. */
const CORACOES = [
  { dx: 0, atraso: 0, giro: 0, escala: 1 },
  { dx: -20, atraso: 0.08, giro: -14, escala: 0.7 },
  { dx: 22, atraso: 0.14, giro: 16, escala: 0.6 },
] as const;

export interface BrilhoDeCurtidaProps {
  /** Quando aumenta, o brilho sobe a partir do último toque (ou do canto de baixo, sem toque). */
  disparo: number;
  children: ReactNode;
}

/**
 * Corações que sobem e somem a partir do ponto onde o jogador curtiu. O Post de src/ui não
 * expõe a posição do coração, então o brilho nasce do toque (pageX/pageY) e sobe por cima do
 * cartão. Tudo na thread de UI; com movimento reduzido não aparece.
 */
export function BrilhoDeCurtida({ disparo, children }: BrilhoDeCurtidaProps) {
  const { reduzido } = useMovimento();
  const raiz = useRef<ComponentRef<typeof View>>(null);
  const toque = useRef<{ x: number; y: number } | null>(null);
  const anterior = useRef(disparo);
  const origemX = useSharedValue(0);
  const origemY = useSharedValue(0);
  const progresso = useSharedValue(0);

  useEffect(() => {
    if (anterior.current === disparo) return;
    anterior.current = disparo;
    if (reduzido) return;
    raiz.current?.measureInWindow((x, y, largura, altura) => {
      const t = toque.current;
      origemX.value = t ? t.x - x : largura * 0.25;
      origemY.value = t ? t.y - y : altura - 28;
      progresso.value = 0;
      progresso.value = withTiming(1, { duration: 900, easing: CURVA.saida });
    });
  }, [disparo, reduzido, origemX, origemY, progresso]);

  const guardarToque = (evento: GestureResponderEvent) => {
    toque.current = { x: evento.nativeEvent.pageX, y: evento.nativeEvent.pageY };
  };

  return (
    <View ref={raiz} onTouchStart={guardarToque}>
      {children}
      {!reduzido &&
        CORACOES.map((c, i) => (
          <CoracaoQueSobe
            key={i}
            {...c}
            progresso={progresso}
            origemX={origemX}
            origemY={origemY}
          />
        ))}
    </View>
  );
}

interface CoracaoQueSobeProps {
  dx: number;
  atraso: number;
  giro: number;
  escala: number;
  progresso: { value: number };
  origemX: { value: number };
  origemY: { value: number };
}

function CoracaoQueSobe({
  dx,
  atraso,
  giro,
  escala,
  progresso,
  origemX,
  origemY,
}: CoracaoQueSobeProps) {
  const { cores } = useTema();
  const estilo = useAnimatedStyle(() => {
    // Cada coração tem a sua janela dentro do progresso total.
    const p = Math.min(1, Math.max(0, (progresso.value - atraso) / (1 - atraso)));
    return {
      opacity: interpolate(p, [0, 0.12, 0.6, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: origemX.value - TAMANHO / 2 + dx * p },
        { translateY: origemY.value - TAMANHO / 2 - 64 * p },
        { rotate: `${giro * p}deg` },
        {
          scale:
            escala * interpolate(p, [0, 0.22, 0.45, 1], [0.3, 1.3, 1.05, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[estilos.coracao, estilo]}
    >
      <Heart size={TAMANHO} color={cores.destaque} fill={cores.destaque} strokeWidth={0} />
    </Animated.View>
  );
}

const estilos = StyleSheet.create({ coracao: { position: 'absolute', left: 0, top: 0 } });
