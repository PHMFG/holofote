import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { CASCATA, CURVA, DURACAO, atrasoDaCascata, useMovimento } from './movimento';

export interface AparecerProps {
  children: ReactNode;
  /**
   * Posição numa lista: entra em cascata. Itens além de CASCATA.maxItens não animam (entram junto
   * do resto, já fora da tela) para a rolagem não disparar entradas atrasadas.
   */
  indice?: number;
  /**
   * Identifica o item de uma lista (id do post, da conversa). Depois da primeira entrada o item
   * não anima de novo quando a lista o desmonta e remonta ao rolar; um item novo (chave nunca vista)
   * anima. Sem chave, vale só a regra de `indice`.
   */
  chave?: string;
  /** Atraso extra em ms, somado ao da cascata. */
  atraso?: number;
  /** "subir" desliza 12 pt de baixo para cima; "fade" só aparece. */
  modo?: 'subir' | 'fade';
  style?: StyleProp<ViewStyle>;
}

/** Chaves que já entraram, com teto para a memória não crescer sem fim (as mais velhas saem). */
const JA_ENTROU = new Set<string>();
const MAX_CHAVES = 400;

/** Registra a chave depois da montagem (no render seria um efeito colateral, e o StrictMode renderiza duas vezes). */
function registrar(chave: string): void {
  JA_ENTROU.delete(chave);
  JA_ENTROU.add(chave);
  if (JA_ENTROU.size > MAX_CHAVES) {
    const primeira = JA_ENTROU.values().next().value;
    if (primeira !== undefined) JA_ENTROU.delete(primeira);
  }
}

/**
 * Entrada padrão de um bloco na tela: fade com um leve deslize para cima, em cascata nas listas.
 * Com movimento reduzido, aparece sem deslocamento.
 */
export function Aparecer({
  children,
  indice = 0,
  chave,
  atraso = 0,
  modo = 'subir',
  style,
}: AparecerProps) {
  const { reduzido, reduceMotion } = useMovimento();
  const espera = atrasoDaCascata(indice) + atraso;
  // Fora da cascata (rolagem de lista longa) ou já visto: sem entrada.
  const semEntrada = indice > CASCATA.maxItens || (chave !== undefined && JA_ENTROU.has(chave));
  useEffect(() => {
    if (chave !== undefined) registrar(chave);
  }, [chave]);
  const entrada = semEntrada
    ? undefined
    : modo === 'fade' || reduzido
      ? FadeIn.duration(DURACAO.rapida)
          .delay(reduzido ? 0 : espera)
          .reduceMotion(reduceMotion)
      : FadeInDown.duration(DURACAO.media)
          .delay(espera)
          .easing(CURVA.saida)
          .withInitialValues({ transform: [{ translateY: 12 }] })
          .reduceMotion(reduceMotion);
  return (
    <Animated.View
      entering={entrada}
      exiting={FadeOut.duration(DURACAO.instante).reduceMotion(reduceMotion)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
