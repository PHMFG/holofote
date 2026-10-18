import { ESCURECER } from '@holofote/tokens';
import { StyleSheet, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { Texto } from './Texto';
import { PressableAnimado, useFeedbackDoToque } from './Tocavel';

export interface BotaoMetalProps extends Omit<PressableProps, 'children'> {
  rotulo: string;
}

/** Quanto o véu escuro cobre o metal com o dedo em cima (o "brilho" cai sem mudar o tamanho da sombra). */
const VEU_PRESSIONADO = 0.22;

/**
 * Ação principal da tela; use um por tela (descrição no Figma, 12:79). O aro é o gradiente
 * "Aro metal" e o brilho embaixo segue o destaque escolhido pelo jogador. Ao toque encolhe e o
 * metal escurece um pouco, na mola "firme"; desabilitado esmaece em fade.
 */
export function BotaoMetal({
  rotulo,
  disabled,
  style,
  onPressIn,
  onPressOut,
  ...props
}: BotaoMetalProps) {
  const { medidas } = useTema();
  const altura = medidas.botaoMetalAltura;
  // O brilho sai do véu escuro; a opacidade só muda quando desabilitado.
  const feedback = useFeedbackDoToque(
    { onPressIn, onPressOut, style },
    { brilho: 1, desabilitado: !!disabled },
  );
  const { pressao } = feedback;
  const veu = useAnimatedStyle(() => ({
    opacity: Math.max(0, pressao.value) * VEU_PRESSIONADO,
  }));
  return (
    <PressableAnimado
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...props}
      onPressIn={feedback.onPressIn}
      onPressOut={feedback.onPressOut}
      style={feedback.style}
    >
      <Camada
        gradiente="aroMetal"
        sombra="botaoMetal"
        raio={altura / 2}
        style={{ height: altura, padding: 2 }}
      >
        <Camada
          gradiente="metal"
          raio={altura / 2 - 2}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Texto estilo="botao">{rotulo}</Texto>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: altura / 2 - 2, backgroundColor: ESCURECER },
              veu,
            ]}
          />
        </Camada>
      </Camada>
    </PressableAnimado>
  );
}
