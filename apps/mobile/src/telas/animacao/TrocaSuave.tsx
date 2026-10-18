import { useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAnimacoes } from './animacoes';

export interface TrocaSuaveProps {
  /** Quando muda, o conteúdo antigo sai e o novo entra. */
  chave: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Troca de valor com transição: o novo desce de leve e aparece enquanto o antigo sobe e some.
 * A primeira exibição não anima (o bloco de fora é quem entra).
 */
export function TrocaSuave({ chave, children, style }: TrocaSuaveProps) {
  const animacoes = useAnimacoes();
  // Só anima quando a chave muda depois da primeira exibição (A, B e de volta a A também anima).
  const [chaveInicial] = useState(chave);
  const [trocou, setTrocou] = useState(false);
  if (!trocou && chave !== chaveInicial) setTrocou(true);
  const pronto = trocou || chave !== chaveInicial;
  return (
    <Animated.View
      key={chave}
      entering={pronto ? animacoes.trocaEntra : undefined}
      exiting={animacoes.trocaSai}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
