// Efeitos de movimento compartilhados pelas telas de progresso, eventos e conta (05 a 21).
// Tudo roda na thread de UI (valores compartilhados e estilos animados): nenhum setState por
// quadro. Todo efeito respeita useMovimento(): com "Reduzir animações" ou Reduzir Movimento do
// iOS ligado, laços e celebrações não rodam e o resto vira troca imediata ou fade curto.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type AnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import type { NomeCor, NomeSombra } from '@holofote/tokens';
import { useTema } from '../../tema/ProvedorTema';
import { Aparecer, type AparecerProps } from '../../ui/Aparecer';
import { Camada } from '../../ui/Camada';
import { CURVA, DURACAO, MOLA, useMovimento } from '../../ui/movimento';

/**
 * Pulso de escala (e, se quiser, de opacidade) em laço, para o elemento que pede atenção: o marco
 * atual, a esfera do raio sem energia, o chip AO VIVO. Para sozinho e volta ao repouso quando
 * `ativo` desliga ou o movimento é reduzido.
 */
export function usePulso(
  ativo: boolean,
  {
    ate = 1.06,
    duracao = 1100,
    opacidade = 1,
  }: { ate?: number; duracao?: number; opacidade?: number } = {},
) {
  const { reduzido } = useMovimento();
  const t = useSharedValue(0);
  const ligado = ativo && !reduzido;
  useEffect(() => {
    if (ligado) {
      t.value = withRepeat(
        withTiming(1, { duration: duracao, easing: CURVA.entradaSaida }),
        -1,
        true,
      );
    } else {
      cancelAnimation(t);
      t.value = withTiming(0, { duration: DURACAO.rapida });
    }
    return () => cancelAnimation(t);
  }, [ligado, duracao, t]);
  return useAnimatedStyle(() => ({
    opacity: 1 - (1 - opacidade) * t.value,
    transform: [{ scale: 1 + (ate - 1) * t.value }],
  }));
}

export interface HaloProps {
  ativo?: boolean;
  /** Escala final do anel, em relação ao pai (que deve ser quadrado ou redondo). */
  escala?: number;
  duracao?: number;
  atraso?: number;
  cor?: NomeCor;
  /** Uma onda só (celebração) em vez de um laço. */
  unico?: boolean;
}

/** Anel que se expande e some, em laço (ou uma vez), por trás do elemento pai. Decorativo. */
export function Halo({
  ativo = true,
  escala = 1.7,
  duracao = 2000,
  atraso = 0,
  cor = 'destaqueBrilho',
  unico = false,
}: HaloProps) {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const t = useSharedValue(0);
  const ligado = ativo && !reduzido;
  useEffect(() => {
    if (!ligado) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = 0;
    const onda = withTiming(1, { duration: duracao, easing: CURVA.saida });
    t.value = withDelay(atraso, unico ? onda : withRepeat(onda, -1, false));
    return () => cancelAnimation(t);
  }, [ligado, unico, duracao, atraso, t]);
  const estilo = useAnimatedStyle(() => ({
    opacity: t.value <= 0 ? 0 : 1 - t.value,
    transform: [{ scale: 1 + (escala - 1) * t.value }],
  }));
  if (!ligado) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { borderRadius: 999, backgroundColor: cores[cor] }, estilo]}
    />
  );
}

export interface PopProps {
  children: ReactNode;
  /** Atraso em ms antes de entrar. */
  atraso?: number;
  /** Entra quando vira true; volta a sumir quando vira false. */
  ativo?: boolean;
  /** Escala de partida (0 a 1). */
  de?: number;
  /** Deslocamento vertical de partida em pt (positivo vem de baixo). */
  deslocamento?: number;
  mola?: (typeof MOLA)[keyof typeof MOLA];
  style?: StyleProp<ViewStyle>;
}

/** Entrada com mola: cresce de `de` até 1 com um leve estouro. Movimento reduzido: só um fade. */
export function Pop({
  children,
  atraso = 0,
  ativo = true,
  de = 0.4,
  deslocamento = 0,
  mola = MOLA.viva,
  style,
}: PopProps) {
  const { reduzido } = useMovimento();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!ativo) {
      p.value = withTiming(0, { duration: DURACAO.instante });
    } else if (reduzido) {
      p.value = withDelay(atraso, withTiming(1, { duration: DURACAO.rapida }));
    } else {
      p.value = withDelay(atraso, withSpring(1, mola));
    }
    return () => cancelAnimation(p);
  }, [ativo, reduzido, atraso, mola, p]);
  const estilo = useAnimatedStyle(() =>
    reduzido
      ? { opacity: p.value }
      : {
          opacity: Math.min(1, p.value * 3),
          transform: [
            { translateY: deslocamento * (1 - p.value) },
            { scale: de + (1 - de) * p.value },
          ],
        },
  );
  return <Animated.View style={[style, estilo]}>{children}</Animated.View>;
}

export interface ReluzirProps {
  children: ReactNode;
  /** Raio do elemento, para o brilho não passar dos cantos. */
  raio: number;
  ativo?: boolean;
  style?: StyleProp<ViewStyle>;
}

const LARGURA_DA_BANDA = 72;

/** Faixa de brilho que atravessa o elemento de tempos em tempos, chamando a atenção para ele. */
export function Reluzir({ children, raio, ativo = true, style }: ReluzirProps) {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const [largura, setLargura] = useState(0);
  const t = useSharedValue(0);
  const ligado = ativo && !reduzido && largura > 0;
  useEffect(() => {
    if (!ligado) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: CURVA.entradaSaida }),
        withTiming(1, { duration: 1800 }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [ligado, t]);
  const faixa = useAnimatedStyle(() => ({
    transform: [
      { translateX: -LARGURA_DA_BANDA + (largura + LARGURA_DA_BANDA * 2) * t.value },
      { skewX: '-18deg' },
    ],
  }));
  return (
    <View style={style} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
      {children}
      {ligado && (
        <View
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, { borderRadius: raio, overflow: 'hidden' }]}
        >
          <Animated.View style={[{ width: LARGURA_DA_BANDA, height: '100%' }, faixa]}>
            <LinearGradient
              colors={['transparent', cores.destaqueBrilho, 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

export interface BrilhoRespirandoProps {
  children: ReactNode;
  /** Raio do cartão, para o brilho acompanhar os cantos. */
  raio: number;
  /** Liga e desliga o brilho (some com um fade). */
  ativo?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Brilho do destaque que respira ao redor de um cartão, por trás dele: chama a atenção para o
 * que pede uma ação (um marco para resgatar) ou está prestes a acontecer. Movimento reduzido:
 * brilho parado.
 */
export function BrilhoRespirando({ children, raio, ativo = true, style }: BrilhoRespirandoProps) {
  const { reduzido } = useMovimento();
  const respiro = useSharedValue(0);
  useEffect(() => {
    if (!ativo) {
      cancelAnimation(respiro);
      respiro.value = withTiming(0, { duration: DURACAO.media });
      return;
    }
    if (reduzido) {
      respiro.value = 0.6;
      return;
    }
    respiro.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1300, easing: CURVA.entradaSaida }),
        withTiming(0.25, { duration: 1300, easing: CURVA.entradaSaida }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(respiro);
  }, [ativo, reduzido, respiro]);
  const brilho = useAnimatedStyle(() => ({ opacity: respiro.value }));
  return (
    <View style={style}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, brilho]}>
        <Camada sombra="brilhoDestaque" raio={raio} style={StyleSheet.absoluteFill} />
      </Animated.View>
      {children}
    </View>
  );
}

const PARTICULAS: { cor: NomeCor; tamanho: number }[] = [
  { cor: 'destaque', tamanho: 8 },
  { cor: 'destaqueGrafico', tamanho: 6 },
  { cor: 'destaqueTinta', tamanho: 5 },
  { cor: 'destaqueSuave', tamanho: 9 },
  { cor: 'textoSuave', tamanho: 5 },
];

export interface ConfeteProps {
  /** Dispara quando vira true; volta ao repouso quando vira false. */
  disparar: boolean;
  /** Alcance das partículas em pt. */
  raio?: number;
  quantidade?: number;
}

/** Explosão curta de partículas nas cores do destaque, saindo do centro do pai. Decorativa. */
export function Confete({ disparar, raio = 110, quantidade = 14 }: ConfeteProps) {
  const { reduzido } = useMovimento();
  const p = useSharedValue(0);
  useEffect(() => {
    if (disparar && !reduzido) {
      p.value = 0;
      p.value = withTiming(1, { duration: 1100, easing: CURVA.saida });
    } else {
      cancelAnimation(p);
      p.value = 0;
    }
  }, [disparar, reduzido, p]);
  if (!disparar || reduzido) return null;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, estilos.centro]}
    >
      {Array.from({ length: quantidade }, (_, i) => (
        <Particula key={i} indice={i} total={quantidade} raio={raio} progresso={p} />
      ))}
    </View>
  );
}

function Particula({
  indice,
  total,
  raio,
  progresso,
}: {
  indice: number;
  total: number;
  raio: number;
  progresso: SharedValue<number>;
}) {
  const { cores } = useTema();
  const { cor, tamanho } = PARTICULAS[indice % PARTICULAS.length]!;
  // Ângulo e alcance determinísticos (sem Math.random): a mesma explosão em todo aparelho.
  const angulo = (indice / total) * Math.PI * 2 + (indice % 3) * 0.17;
  const alcance = raio * (0.65 + ((indice * 37) % 10) / 25);
  const estilo = useAnimatedStyle(() => {
    const t = progresso.value;
    return {
      opacity: t <= 0 ? 0 : 1 - t * t,
      transform: [
        { translateX: Math.cos(angulo) * alcance * t },
        { translateY: Math.sin(angulo) * alcance * t + 24 * t * t },
        { scale: 1 - 0.5 * t },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        estilos.particula,
        { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cores[cor] },
        estilo,
      ]}
    />
  );
}

/**
 * Item de lista que entra em cascata (Aparecer), sai com fade e desliza quando os vizinhos
 * entram ou saem. Use só em listas que mudam; nas estáticas, Aparecer basta.
 */
export function ItemFluido({
  children,
  style,
  ...entrada
}: AparecerProps & { children: ReactNode }) {
  const { reduzido, reduceMotion } = useMovimento();
  return (
    <Animated.View
      layout={
        reduzido
          ? undefined
          : LinearTransition.duration(DURACAO.media).easing(CURVA.saida).reduceMotion(reduceMotion)
      }
      exiting={FadeOut.duration(DURACAO.rapida).reduceMotion(reduceMotion)}
      style={style}
    >
      <Aparecer {...entrada}>{children}</Aparecer>
    </Animated.View>
  );
}

/** Troca suave de conteúdo: ao mudar `chave`, o antigo some e o novo aparece por cima. */
export function Troca({
  chave,
  children,
  style,
}: {
  chave: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { reduceMotion } = useMovimento();
  return (
    <Animated.View
      key={chave}
      entering={FadeIn.duration(DURACAO.rapida).reduceMotion(reduceMotion)}
      exiting={FadeOut.duration(DURACAO.instante).reduceMotion(reduceMotion)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

export interface BarraLivreProps {
  /** De 0 a 1, dirigido por quem usa (timing linear, mola...). */
  progresso: SharedValue<number>;
  altura: number;
  rotulo: string;
  /** Valor lido pelo VoiceOver, de 0 a 100. */
  valorAcessivel: number;
  preenchimento?: NomeCor;
  trilho?: NomeCor;
  sombra?: NomeSombra;
  /** Só visual: fora do VoiceOver (o valor muda sem renderizar, então não há o que ler). */
  decorativa?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Estilo animado extra do preenchimento (ex.: opacidade pulsando). */
  estiloPreenchimento?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
}

/** Barra de progresso cujo preenchimento anda na thread de UI, sem renderizar a cada quadro. */
export function BarraLivre({
  progresso,
  altura,
  rotulo,
  valorAcessivel,
  preenchimento = 'destaque',
  trilho = 'superficie2',
  sombra,
  decorativa,
  style,
  estiloPreenchimento,
}: BarraLivreProps) {
  const { cores } = useTema();
  const largura = useAnimatedStyle(() => ({
    width: `${Math.min(1, Math.max(0, progresso.value)) * 100}%`,
  }));
  return (
    <Camada
      cor={trilho}
      sombra={sombra}
      raio={altura / 2}
      accessible={!decorativa}
      accessibilityRole={decorativa ? undefined : 'progressbar'}
      accessibilityLabel={decorativa ? undefined : rotulo}
      accessibilityValue={
        decorativa ? undefined : { min: 0, max: 100, now: Math.round(valorAcessivel) }
      }
      importantForAccessibility={decorativa ? 'no-hide-descendants' : undefined}
      style={[{ height: altura, overflow: 'hidden' }, style]}
    >
      <Animated.View
        style={[
          { height: altura, borderRadius: altura / 2, backgroundColor: cores[preenchimento] },
          largura,
          estiloPreenchimento,
        ]}
      />
    </Camada>
  );
}

export interface BarraAnimadaProps {
  /** De 0 a 1. */
  valor: number;
  /** Lido pelo VoiceOver, ex.: "Objetivo do ato". */
  rotulo: string;
  altura?: 8 | 6 | 5 | 4 | 3;
  /** padrao: trilho afundado, preenchimento destaque-grafico. chapada: trilho sem sombra, destaque. */
  variante?: 'padrao' | 'chapada';
  /** Atraso em ms da primeira subida (cascata). */
  atraso?: number;
  /** Cores diferentes das da variante (ex.: a barra cinza dos outros indicados). */
  preenchimento?: NomeCor;
  trilho?: NomeCor;
}

/**
 * BarraProgresso (mesmo desenho) que enche do zero na entrada da tela, no seu atraso, e anda
 * até o valor novo quando ele muda. O VoiceOver lê sempre o valor final, não o do quadro.
 */
export function BarraAnimada({
  valor,
  rotulo,
  altura = 8,
  variante = 'padrao',
  atraso = 0,
  preenchimento,
  trilho,
}: BarraAnimadaProps) {
  const { reduzido } = useMovimento();
  const proporcao = Math.min(1, Math.max(0, valor));
  const p = useSharedValue(reduzido ? proporcao : 0);
  const primeira = useRef(true);
  useEffect(() => {
    const inicial = primeira.current;
    primeira.current = false;
    if (reduzido) {
      p.value = proporcao;
      return;
    }
    p.value = withDelay(
      inicial ? atraso : 0,
      withTiming(proporcao, {
        duration: inicial ? DURACAO.lenta : DURACAO.media,
        easing: CURVA.enfase,
      }),
    );
  }, [proporcao, reduzido, atraso, p]);
  return (
    <BarraLivre
      progresso={p}
      altura={altura}
      rotulo={rotulo}
      valorAcessivel={proporcao * 100}
      preenchimento={preenchimento ?? (variante === 'padrao' ? 'destaqueGrafico' : 'destaque')}
      trilho={trilho}
      sombra={variante === 'padrao' ? 'afundado' : undefined}
    />
  );
}

/** Easing linear para barras que acompanham o relógio (anúncio, cronômetro). */
export const LINEAR = Easing.linear;

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center' },
  particula: { position: 'absolute' },
});
