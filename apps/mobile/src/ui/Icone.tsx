import type { NomeCor } from '@holofote/tokens';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { CURVA, DURACAO, useMovimento } from './movimento';

export interface IconeProps {
  icone: LucideIcon;
  tamanho?: number;
  cor?: NomeCor;
  /** Espessura do traço em px; o Figma usa 1,8 na maioria dos ícones. */
  traco?: number;
}

/** Ícone do lucide com o traço do Figma: 1,8 px absoluto e cor por token. */
export function Icone({
  icone: Componente,
  tamanho = 22,
  cor = 'textoSuave',
  traco = 1.8,
}: IconeProps) {
  const tema = useTema();
  return (
    <Componente
      size={tamanho}
      color={tema.cores[cor]}
      strokeWidth={traco}
      absoluteStrokeWidth
      accessible={false}
    />
  );
}

export interface IconeAlternadoProps extends Omit<IconeProps, 'cor'> {
  /** Cor em repouso e cor quando `ativo`. */
  cor: NomeCor;
  corAtiva: NomeCor;
  ativo: boolean;
}

/**
 * Ícone que muda de cor com o estado (curtido, selecionado) em crossfade: dois ícones empilhados,
 * um em cada cor, e a opacidade do de cima segue `ativo`. O SVG não anima a cor sozinho.
 */
export function IconeAlternado({ cor, corAtiva, ativo, ...resto }: IconeAlternadoProps) {
  const { tempo } = useMovimento();
  const mistura = useSharedValue(ativo ? 1 : 0);
  useEffect(() => {
    mistura.value = withTiming(ativo ? 1 : 0, {
      duration: tempo(DURACAO.rapida),
      easing: CURVA.saida,
    });
  }, [ativo, mistura, tempo]);
  const sobre = useAnimatedStyle(() => ({ opacity: mistura.value }));
  return (
    <View>
      <Icone {...resto} cor={cor} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sobre]}>
        <Icone {...resto} cor={corAtiva} />
      </Animated.View>
    </View>
  );
}
