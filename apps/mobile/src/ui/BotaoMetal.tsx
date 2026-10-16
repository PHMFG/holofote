import { Pressable, type PressableProps } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { Texto } from './Texto';

export interface BotaoMetalProps extends Omit<PressableProps, 'children'> {
  rotulo: string;
}

/**
 * Ação principal da tela; use um por tela (descrição no Figma, 12:79). O aro é o gradiente
 * "Aro metal" e o brilho embaixo segue o destaque escolhido pelo jogador.
 */
export function BotaoMetal({ rotulo, disabled, style, ...props }: BotaoMetalProps) {
  const { medidas } = useTema();
  const altura = medidas.botaoMetalAltura;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...props}
      style={(estado) => [
        { opacity: disabled ? 0.5 : estado.pressed ? 0.92 : 1 },
        typeof style === 'function' ? style(estado) : style,
      ]}
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
        </Camada>
      </Camada>
    </Pressable>
  );
}
