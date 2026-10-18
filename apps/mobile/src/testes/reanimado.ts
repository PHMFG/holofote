// Só no Jest: um Reanimated simplificado. O Reanimated 4 precisa do runtime nativo (e a versão
// em JS depende do react-native-web), então nos testes toda animação termina na hora e o valor
// final vai direto para o estilo. Cobre as APIs que o app usa; acrescente aqui se usar outra.
import { useRef, useState, type ComponentType, type ReactNode } from 'react';
import { FlatList, Image, ScrollView, Text, View } from 'react-native';

const identidade = <T>(x: T) => x;

/** Construtor de animação de layout (FadeIn.duration(200).delay(40)...): qualquer método encadeia. */
function construtor(): unknown {
  const alvo = function () {};
  const proxy: unknown = new Proxy(alvo, {
    get: (_t, chave) =>
      chave === 'build' ? () => () => ({ animations: {}, initialValues: {} }) : () => proxy,
    apply: () => proxy,
    construct: () => proxy as object,
  });
  return proxy;
}

function useSharedValue<T>(inicial: T) {
  // Um objeto estável por componente, como o valor compartilhado do Reanimated.
  const [valor] = useState(() => {
    const caixa = {
      value: inicial,
      get: () => caixa.value,
      set: (v: T) => {
        caixa.value = v;
      },
      modify: (fn: (v: T) => T) => {
        caixa.value = fn(caixa.value);
      },
      addListener: () => {},
      removeListener: () => {},
    };
    return caixa;
  });
  return valor;
}

const finalizar = <T>(valor: T, aoTerminar?: (terminou: boolean) => void) => {
  aoTerminar?.(true);
  return valor;
};

function interpolate(x: number, entrada: number[], saida: number[]) {
  if (entrada.length < 2) return saida[0] ?? x;
  let i = 0;
  while (i < entrada.length - 2 && x > entrada[i + 1]!) i++;
  const [a, b] = [entrada[i]!, entrada[i + 1]!];
  const [c, d] = [saida[i]!, saida[i + 1]!];
  const t = b === a ? 0 : Math.min(1, Math.max(0, (x - a) / (b - a)));
  return c + (d - c) * t;
}

const curva = () => identidade;
const Easing = new Proxy(
  { bezier: () => identidade, in: identidade, out: identidade, inOut: identidade },
  { get: (t, k) => (k in t ? t[k as keyof typeof t] : curva()) },
);

// <LayoutAnimationConfig skipEntering>: sem animação no teste, só repassa os filhos.
const LayoutAnimationConfig = ({ children }: { children?: ReactNode }) => children;

const Animated = {
  View,
  Text,
  ScrollView,
  FlatList,
  Image,
  createAnimatedComponent: <P>(c: ComponentType<P>) => c,
};

const base: Record<string, unknown> = {
  __esModule: true,
  default: Animated,
  ...Animated,
  LayoutAnimationConfig,
  useSharedValue,
  makeMutable: (v: unknown) => ({ value: v }),
  useAnimatedStyle: (fn: () => object) => fn(),
  useAnimatedProps: (fn: () => object) => fn(),
  useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
  useAnimatedReaction: () => {},
  useAnimatedRef: () => useRef(null),
  useAnimatedScrollHandler: () => () => {},
  useScrollViewOffset: () => ({ value: 0 }),
  useReducedMotion: () => false,
  useFrameCallback: () => ({ setActive: () => {}, isActive: false }),
  withTiming: (v: unknown, _c?: unknown, cb?: (t: boolean) => void) => finalizar(v, cb),
  withSpring: (v: unknown, _c?: unknown, cb?: (t: boolean) => void) => finalizar(v, cb),
  withDecay: (_c?: unknown, cb?: (t: boolean) => void) => finalizar(0, cb),
  withDelay: (_d: number, v: unknown) => v,
  withSequence: (...v: unknown[]) => v[v.length - 1],
  withRepeat: (v: unknown) => v,
  withClamp: (_c: unknown, v: unknown) => v,
  cancelAnimation: () => {},
  runOnJS: identidade,
  runOnUI: identidade,
  measure: () => null,
  scrollTo: () => {},
  interpolate,
  // Cor do fim da faixa quando o valor chega lá; senão a do começo (sem misturar).
  interpolateColor: (x: number, e: number[], saida: string[]) =>
    x >= (e[e.length - 1] ?? Infinity) ? saida[saida.length - 1] : saida[0],
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  Easing,
  Keyframe: function Keyframe() {
    return construtor();
  },
};

// Animações de layout e de entrada/saída (FadeIn, SlideInDown, LinearTransition...) viram construtores neutros.
module.exports = new Proxy(base, {
  get: (t, chave) =>
    typeof chave === 'string' && !(chave in t) ? construtor() : t[chave as string],
});
