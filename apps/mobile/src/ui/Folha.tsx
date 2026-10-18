import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { StyleSheet, View, useWindowDimensions, type ViewProps } from 'react-native';
import Animated, {
  FadeIn,
  SlideInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { Icone } from './Icone';
import { CURVA, DURACAO, ESCALA_TOQUE_LEVE, MOLA, useMovimento } from './movimento';
import { Texto } from './Texto';
import { Tocavel } from './Tocavel';

/** Arrastar além disto (pt) ou mais rápido que isto (pt/s) para baixo fecha a folha. */
const DISTANCIA_PARA_FECHAR = 90;
const VELOCIDADE_PARA_FECHAR = 800;

export interface FolhaProps extends ViewProps {
  /**
   * Arrastar a folha para baixo a fecha (padrão). Desligue onde a folha não é uma tela própria
   * (catálogo de componentes).
   */
  arrastavel?: boolean;
  /** O que fazer ao fechar por gesto; o padrão volta uma tela (router.back). */
  aoFechar?: () => void;
}

/**
 * Painel de baixo para cima (19 · Sem energia): cantos de cima com raio 32, alça e Elevação.
 * A apresentação (modal transparente do Expo Router) e o escurecer atrás ficam com a tela que a usa.
 * Sobe na mola "suave" ao aparecer (sem passar do fim, para não abrir fresta embaixo) e pode ser
 * arrastada para baixo: solta além da distância ou com velocidade, termina de descer e fecha;
 * senão volta na mola "firme". Com movimento reduzido entra em fade e volta sem mola.
 */
export function Folha({ children, style, arrastavel = true, aoFechar, ...props }: FolhaProps) {
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  const { reduzido, reduceMotion } = useMovimento();
  const { height: alturaTela } = useWindowDimensions();
  const arrasto = useSharedValue(0);

  const fechar = () => (aoFechar ?? (() => router.back()))();
  const gesto = usePanGesture({
    enabled: arrastavel,
    activeOffsetY: 10,
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      'worklet';
      arrasto.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > DISTANCIA_PARA_FECHAR || e.velocityY > VELOCIDADE_PARA_FECHAR) {
        arrasto.value = withTiming(
          alturaTela,
          { duration: DURACAO.rapida, easing: CURVA.entradaSaida },
          (terminou) => {
            if (terminou) runOnJS(fechar)();
          },
        );
      } else {
        arrasto.value = reduzido
          ? withTiming(0, { duration: DURACAO.instante })
          : withSpring(0, MOLA.firme);
      }
    },
  });
  const deslocamento = useAnimatedStyle(() => ({ transform: [{ translateY: arrasto.value }] }));

  const entrada = reduzido
    ? FadeIn.duration(DURACAO.rapida).reduceMotion(reduceMotion)
    : SlideInDown.springify()
        .damping(MOLA.suave.damping)
        .stiffness(MOLA.suave.stiffness)
        .overshootClamping(1)
        .reduceMotion(reduceMotion);

  const folha = (
    <Animated.View style={deslocamento}>
      <Camada
        {...props}
        cor="superficie"
        sombra="elevacao"
        raio={32}
        // 34 no Figma, que é a altura do indicador de início no 16e.
        style={[estilos.folha, { paddingBottom: Math.max(34, insets.bottom) }, style]}
      >
        <View style={[estilos.alca, { backgroundColor: cores.textoFraco }]} accessible={false} />
        {children}
      </Camada>
    </Animated.View>
  );

  return (
    <Animated.View entering={entrada}>
      {arrastavel ? <GestureDetector gesture={gesto}>{folha}</GestureDetector> : folha}
    </Animated.View>
  );
}

export interface OpcaoFolhaProps {
  icone: LucideIcon;
  titulo: string;
  subtitulo?: string;
  /** À direita, ex.: "10 gemas". */
  valor?: string;
  /** Opção recomendada (ex.: Holofote Plus): fundo destaque-suave sem borda. */
  destaque?: boolean;
  onPress?: () => void;
}

/** Opção de uma folha: linha em cartão contornado de raio 20. */
export function OpcaoFolha({
  icone,
  titulo,
  subtitulo,
  valor,
  destaque,
  onPress,
}: OpcaoFolhaProps) {
  const { cores } = useTema();
  const corTexto = destaque ? 'destaqueTinta' : 'texto';
  return (
    <Tocavel
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[titulo, subtitulo, valor].filter(Boolean).join(', ')}
      escala={ESCALA_TOQUE_LEVE}
      brilho={0.8}
      style={[
        estilos.opcao,
        {
          backgroundColor: destaque ? cores.destaqueSuave : cores.fundo,
          // Borda transparente no destaque para as opções terem a mesma altura.
          borderColor: destaque ? 'transparent' : cores.linha,
        },
      ]}
    >
      <Icone icone={icone} tamanho={20} cor={corTexto} />
      <View style={estilos.textos}>
        <Texto estilo="corpoForte" cor={corTexto}>
          {titulo}
        </Texto>
        {subtitulo && (
          <Texto estilo="legenda" cor={destaque ? 'destaqueTinta' : 'textoSuave'}>
            {subtitulo}
          </Texto>
        )}
      </View>
      {valor && !destaque && (
        <Texto estilo="legenda" cor="textoSuave">
          {valor}
        </Texto>
      )}
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  folha: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 14,
  },
  alca: { width: 40, height: 5, borderRadius: 3 },
  opcao: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textos: { flex: 1, gap: 1 },
});
