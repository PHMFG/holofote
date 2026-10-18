// Vocabulário de movimento do app: durações, curvas, molas e cascata, num lugar só.
// Toda animação respeita "Reduzir animações" (ajuste do app) e o Reduzir Movimento do iOS:
// com qualquer um ligado, a animação vira troca imediata ou um fade curto, nunca deslocamento.
import { useEffect, useMemo, useRef } from 'react';
import {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';
import { useReduzirMovimento } from '../telas/aparencia/ajustes';

/** Durações em ms. "instante" para toque, "rapida" para estados, "media" para entradas. */
export const DURACAO = {
  instante: 120,
  rapida: 200,
  media: 320,
  lenta: 520,
} as const;

/** Curvas: saída desacelera (entradas na tela), ênfase tem um final mais longo (destaques). */
export const CURVA = {
  saida: Easing.out(Easing.cubic),
  entradaSaida: Easing.inOut(Easing.cubic),
  enfase: Easing.bezier(0.2, 0.9, 0.2, 1),
} as const;

/**
 * Molas: "firme" para toque e trocas de estado, "suave" para entradas, "viva" para celebração
 * (pop) e "deslizante" para indicadores que correm num trilho.
 */
export const MOLA = {
  firme: { damping: 22, stiffness: 320, mass: 1 },
  suave: { damping: 18, stiffness: 180, mass: 1 },
  viva: { damping: 11, stiffness: 220, mass: 1 },
  /** Indicadores que deslizam dentro de um trilho (segmentado, abas): sem passar do fim. */
  deslizante: { damping: 22, stiffness: 320, mass: 1, overshootClamping: true },
} as const satisfies Record<string, WithSpringConfig>;

/** Escala de um elemento tocável enquanto o dedo está em cima. */
export const ESCALA_TOQUE = 0.96;

/** Escala de toque para elementos largos (linhas, opções de folha, trechos de post): 0,96 num bloco de 358 pt balança demais. */
export const ESCALA_TOQUE_LEVE = 0.985;

/** Opacidade de um tocável com o dedo em cima (o "brilho" cai um pouco junto com a escala). */
export const BRILHO_TOQUE = 0.85;

/** Quanto um ícone cresce no pop (curtir, selecionar) e quanto uma pílula pulsa quando o número muda. */
export const ESCALA_POP = 1.3;
export const ESCALA_PULSO = 1.08;

/** Cascata de listas: atraso entre itens e quantos itens animam (o resto entra junto). */
export const CASCATA = { atrasoMs: 40, maxItens: 8 } as const;

/** Atraso de entrada do item `indice` numa lista em cascata. */
export function atrasoDaCascata(indice: number): number {
  return Math.min(indice, CASCATA.maxItens) * CASCATA.atrasoMs;
}

export interface Movimento {
  /** Reduzir animações (app) ou Reduzir Movimento (iOS) ligado. */
  reduzido: boolean;
  /** Valor para `reduceMotion` das animações do Reanimated, já decidido pelo app. */
  reduceMotion: ReduceMotion;
  /** Duração ajustada: 0 com movimento reduzido. */
  tempo: (ms: number) => number;
}

/** Use em todo componente animado para respeitar a preferência de movimento do jogador. */
export function useMovimento(): Movimento {
  const reduzido = useReduzirMovimento();
  // Estável enquanto a preferência não muda: serve de dependência de efeitos.
  return useMemo(
    () => ({
      reduzido,
      reduceMotion: reduzido ? ReduceMotion.Always : ReduceMotion.Never,
      tempo: (ms: number) => (reduzido ? 0 : ms),
    }),
    [reduzido],
  );
}

export interface OpcoesToque {
  /** Escala com o dedo em cima (ESCALA_TOQUE por padrão; ESCALA_TOQUE_LEVE em blocos largos). */
  escala?: number;
  /** Opacidade com o dedo em cima. */
  brilho?: number;
  /** Desabilitado não responde ao dedo e fica com `opacidadeDesabilitado`. */
  desabilitado?: boolean;
  opacidadeDesabilitado?: number;
}

/**
 * Resposta ao dedo de todo tocável: encolhe até `escala` e perde um pouco de brilho na mola
 * "firme" e volta do mesmo jeito. Roda no thread de UI; os eventos de toque só movem o valor.
 * Use `aoPressionar`/`aoSoltar` em onPressIn/onPressOut e `estilo` no componente animado.
 * Com movimento reduzido não há escala: só o brilho muda, num fade curto.
 */
export function useToque({
  escala = ESCALA_TOQUE,
  brilho = BRILHO_TOQUE,
  desabilitado = false,
  opacidadeDesabilitado = 0.5,
}: OpcoesToque = {}) {
  const { reduzido } = useMovimento();
  /** 0 solto, 1 pressionado (a mola pode passar um pouco). */
  const pressao = useSharedValue(0);
  const habilitado = useSharedValue(desabilitado ? 0 : 1);

  useEffect(() => {
    habilitado.value = withTiming(desabilitado ? 0 : 1, {
      duration: reduzido ? 0 : DURACAO.rapida,
    });
  }, [desabilitado, reduzido, habilitado]);

  const estilo = useAnimatedStyle(() => {
    const base = opacidadeDesabilitado + (1 - opacidadeDesabilitado) * habilitado.value;
    const p = Math.max(0, pressao.value);
    return {
      opacity: base * (1 - (1 - brilho) * p),
      transform: [{ scale: reduzido ? 1 : 1 - (1 - escala) * pressao.value }],
    };
  });

  const mover = (alvo: number) => {
    pressao.value = reduzido
      ? withTiming(alvo, { duration: DURACAO.instante })
      : withSpring(alvo, MOLA.firme);
  };

  return {
    pressao,
    estilo,
    aoPressionar: () => {
      if (!desabilitado) mover(1);
    },
    aoSoltar: () => mover(0),
  };
}

/**
 * Pop de um ícone quando `ativo` passa de falso a verdadeiro (curtir, salvar): cresce na mola
 * "viva" e assenta. Não anima na primeira exibição nem com movimento reduzido.
 */
export function usePop(ativo: boolean) {
  const { reduzido } = useMovimento();
  const escala = useSharedValue(1);
  const anterior = useRef(ativo);
  useEffect(() => {
    if (ativo && !anterior.current && !reduzido) {
      escala.value = withSequence(withSpring(ESCALA_POP, MOLA.viva), withSpring(1, MOLA.suave));
    }
    anterior.current = ativo;
  }, [ativo, reduzido, escala]);
  return useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));
}

/**
 * Pulso da pílula quando um número muda (energia, gemas). Ignora a chegada do primeiro valor
 * (de indefinido para definido) e não anima com movimento reduzido.
 */
export function usePulso(valor: number | string | undefined) {
  const { reduzido } = useMovimento();
  const escala = useSharedValue(1);
  const anterior = useRef(valor);
  useEffect(() => {
    if (anterior.current !== undefined && valor !== undefined && valor !== anterior.current) {
      if (!reduzido) {
        escala.value = withSequence(withSpring(ESCALA_PULSO, MOLA.viva), withSpring(1, MOLA.suave));
      }
    }
    anterior.current = valor;
  }, [valor, reduzido, escala]);
  return useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));
}
