import type { ReactNode } from 'react';
import {
  Pressable,
  View,
  type AccessibilityRole,
  type PressableProps,
  type PressableStateCallbackType,
} from 'react-native';

export interface TocavelProps extends Omit<PressableProps, 'children'> {
  children: ReactNode;
  /** Papel quando não há onPress; o padrão lê o conteúdo como texto. */
  papelSemToque?: AccessibilityRole;
}

/**
 * Pressable só quando há ação. Um Pressable desabilitado e sem ação faz o VoiceOver ler o
 * conteúdo como "esmaecido" e anunciar um botão que não faz nada.
 */
export function Tocavel({
  onPress,
  style,
  children,
  accessibilityRole,
  accessibilityState,
  papelSemToque = 'text',
  ...props
}: TocavelProps) {
  if (!onPress) {
    const estado = { pressed: false } as PressableStateCallbackType;
    return (
      <View
        accessible
        accessibilityLabel={props.accessibilityLabel}
        accessibilityRole={papelSemToque}
        style={typeof style === 'function' ? style(estado) : style}
      >
        {children}
      </View>
    );
  }
  return (
    <Pressable
      {...props}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      style={style}
    >
      {children}
    </Pressable>
  );
}
