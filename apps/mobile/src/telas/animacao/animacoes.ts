// Animações de entrada, saída e layout das telas sociais, no vocabulário de src/ui/movimento.ts.
// Cada função devolve um construtor novo do Reanimated para a prop `entering`, `exiting` ou
// `layout` de um Animated.View. Com movimento reduzido (ajuste do app ou do iOS) não há
// deslocamento nem escala: as entradas viram um fade curto e os layouts, troca imediata.
import {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  FadeOutUp,
  Keyframe,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';
import { CURVA, DURACAO, MOLA, atrasoDaCascata, useMovimento } from '../../ui/movimento';

export type Lado = 'direita' | 'esquerda';

function montar(reduzido: boolean) {
  const sempre = reduzido ? ReduceMotion.Always : ReduceMotion.Never;
  // Fade não é movimento: com movimento reduzido ele continua, só mais curto.
  const fadeCurto = (atraso = 0) =>
    FadeIn.duration(DURACAO.instante).delay(atraso).reduceMotion(ReduceMotion.Never);

  return {
    reduzido,

    /** Entrada padrão de bloco (a mesma de Aparecer): fade com leve subida, em cascata por índice. */
    entrada: (indice = 0, atraso = 0) =>
      reduzido
        ? fadeCurto()
        : FadeInDown.duration(DURACAO.media)
            .delay(atrasoDaCascata(indice) + atraso)
            .easing(CURVA.saida)
            .withInitialValues({ transform: [{ translateY: 12 }] }),

    /** Só aparece. */
    fade: (atraso = 0) =>
      FadeIn.duration(DURACAO.rapida)
        .delay(reduzido ? 0 : atraso)
        .reduceMotion(ReduceMotion.Never),

    /** Saída curta de qualquer bloco. */
    saida: FadeOut.duration(DURACAO.instante).reduceMotion(ReduceMotion.Never),

    /** Saída um pouco mais calma, para blocos que cedem lugar a outros. */
    saidaSuave: FadeOut.duration(DURACAO.rapida).reduceMotion(ReduceMotion.Never),

    /** Item novo que chega no topo: desce de cima com mola suave. */
    doTopo: (atraso = 0) =>
      reduzido
        ? fadeCurto()
        : FadeInUp.springify()
            .damping(MOLA.suave.damping)
            .stiffness(MOLA.suave.stiffness)
            .mass(MOLA.suave.mass)
            .delay(atraso)
            .withInitialValues({ transform: [{ translateY: -28 }] }),

    /** Item novo no meio ou no fim de uma conversa: sobe com mola suave. */
    deSubida: (atraso = 0) =>
      reduzido
        ? fadeCurto()
        : FadeInDown.springify()
            .damping(MOLA.suave.damping)
            .stiffness(MOLA.suave.stiffness)
            .mass(MOLA.suave.mass)
            .delay(atraso)
            .withInitialValues({ transform: [{ translateY: 20 }] }),

    /** Aparece crescendo com uma passada do tamanho (chips, selos, avisos). */
    pop: (atraso = 0) =>
      reduzido
        ? fadeCurto()
        : new Keyframe({
            0: { opacity: 0, transform: [{ scale: 0.6 }] },
            60: { opacity: 1, transform: [{ scale: 1.08 }], easing: CURVA.saida },
            100: { opacity: 1, transform: [{ scale: 1 }], easing: CURVA.entradaSaida },
          })
            .duration(DURACAO.media)
            .delay(atraso)
            .reduceMotion(ReduceMotion.Never),

    /** Sai encolhendo. */
    popSaida: reduzido
      ? FadeOut.duration(DURACAO.instante).reduceMotion(ReduceMotion.Never)
      : new Keyframe({
          0: { opacity: 1, transform: [{ scale: 1 }] },
          100: { opacity: 0, transform: [{ scale: 0.6 }], easing: CURVA.saida },
        })
          .duration(DURACAO.rapida)
          .reduceMotion(ReduceMotion.Never),

    /** Troca de passo: entra deslizando do lado de onde o jogador vem. */
    doLado: (lado: Lado, atraso = 0) =>
      reduzido
        ? fadeCurto()
        : (lado === 'direita' ? FadeInRight : FadeInLeft)
            .duration(DURACAO.media)
            .delay(atraso)
            .easing(CURVA.saida)
            .withInitialValues({ transform: [{ translateX: lado === 'direita' ? 28 : -28 }] }),

    /** Troca de passo: sai deslizando para o lado oposto ao da entrada. */
    paraOLado: (lado: Lado) =>
      reduzido
        ? FadeOut.duration(DURACAO.instante).reduceMotion(ReduceMotion.Never)
        : (lado === 'direita' ? FadeOutRight : FadeOutLeft)
            .duration(DURACAO.rapida)
            .easing(CURVA.saida)
            .withTargetValues({ transform: [{ translateX: lado === 'direita' ? 28 : -28 }] }),

    /** Valor que troca (números, títulos): o novo desce de leve enquanto o antigo sobe e some. */
    trocaEntra: reduzido
      ? fadeCurto()
      : FadeInDown.duration(DURACAO.rapida)
          .easing(CURVA.saida)
          .withInitialValues({ transform: [{ translateY: 6 }] }),
    trocaSai: reduzido
      ? FadeOut.duration(DURACAO.instante).reduceMotion(ReduceMotion.Never)
      : FadeOutUp.duration(DURACAO.instante).withTargetValues({ transform: [{ translateY: -6 }] }),

    /**
     * Balão de mensagem: sobe do compositor e cresce a partir do lado de quem enviou
     * (o `transformOrigin` do balão fica no estilo de quem usa).
     */
    balao: (minha: boolean) =>
      reduzido
        ? fadeCurto()
        : new Keyframe({
            0: {
              opacity: 0,
              transform: [{ translateY: minha ? 44 : 14 }, { scale: minha ? 0.82 : 0.7 }],
            },
            100: {
              opacity: 1,
              transform: [{ translateY: 0 }, { scale: 1 }],
              easing: CURVA.enfase,
            },
          })
            .duration(DURACAO.media)
            .reduceMotion(ReduceMotion.Never),

    /** Quando o conteúdo de um bloco muda de tamanho ou de lugar, os vizinhos acomodam com mola. */
    layout: reduzido
      ? undefined
      : LinearTransition.springify()
          .damping(MOLA.suave.damping)
          .stiffness(MOLA.suave.stiffness)
          .mass(MOLA.suave.mass),

    /** Para `reduceMotion` das animações dirigidas por valor compartilhado. */
    reduceMotion: sempre,
  };
}

const NORMAL = montar(false);
const REDUZIDA = montar(true);

export type Animacoes = ReturnType<typeof montar>;

/** As animações de layout das telas, já na versão certa para a preferência de movimento. */
export function useAnimacoes(): Animacoes {
  const { reduzido } = useMovimento();
  return reduzido ? REDUZIDA : NORMAL;
}
