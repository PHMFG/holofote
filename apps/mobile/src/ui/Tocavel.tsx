import type { ReactNode } from 'react';
import {
  Pressable,
  View,
  type AccessibilityRole,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useToque, type OpcoesToque } from './movimento';

/** Pressable com estilo animado (escala e brilho do toque); os componentes do sistema partem dele. */
export const PressableAnimado = Animated.createAnimatedComponent(Pressable);

export interface TocavelProps extends Omit<PressableProps, 'children'>, OpcoesToque {
  children: ReactNode;
  /** Papel quando não há onPress; o padrão lê o conteúdo como texto. */
  papelSemToque?: AccessibilityRole;
}

const SOLTO = { pressed: false } as PressableStateCallbackType;

/**
 * Liga o feedback do toque (useToque) a um PressableAnimado: devolve onPressIn/onPressOut e o
 * estilo já combinados com os do chamador (o `style` em função é avaliado solto). Para botões que
 * precisam de Pressable mesmo sem ação (BotaoSuave, BotaoMetal) e para quem anima algo a mais
 * com `pressao`.
 */
export function useFeedbackDoToque(
  { onPressIn, onPressOut, style }: Pick<PressableProps, 'onPressIn' | 'onPressOut' | 'style'>,
  opcoes: OpcoesToque,
) {
  const toque = useToque(opcoes);
  const estatico = typeof style === 'function' ? style(SOLTO) : style;
  return {
    pressao: toque.pressao,
    onPressIn: (e: GestureResponderEvent) => {
      toque.aoPressionar();
      onPressIn?.(e);
    },
    onPressOut: (e: GestureResponderEvent) => {
      toque.aoSoltar();
      onPressOut?.(e);
    },
    style: [estatico, toque.estilo],
  };
}

/**
 * Pressable só quando há ação. Um Pressable desabilitado e sem ação faz o VoiceOver ler o
 * conteúdo como "esmaecido" e anunciar um botão que não faz nada. Com ação, o dedo encolhe o
 * conteúdo e baixa o brilho na mola "firme" (useToque). O estilo é estático: o estado pressionado
 * não chega mais ao `style` em função, porque o feedback roda no thread de UI.
 */
export function Tocavel({
  onPress,
  onPressIn,
  onPressOut,
  style,
  children,
  accessibilityRole,
  accessibilityState,
  papelSemToque = 'text',
  escala,
  brilho,
  opacidadeDesabilitado,
  ...props
}: TocavelProps) {
  const feedback = useFeedbackDoToque(
    { onPressIn, onPressOut, style },
    { escala, brilho, opacidadeDesabilitado, desabilitado: !!props.disabled },
  );
  const estatico = typeof style === 'function' ? style(SOLTO) : style;

  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={props.accessibilityLabel}
        accessibilityRole={papelSemToque}
        style={estatico}
      >
        {children}
      </View>
    );
  }
  return (
    <PressableAnimado
      {...props}
      onPress={onPress}
      onPressIn={feedback.onPressIn}
      onPressOut={feedback.onPressOut}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      style={feedback.style}
    >
      {children}
    </PressableAnimado>
  );
}
