import type { LucideIcon } from 'lucide-react-native';
import { Pressable, type PressableProps } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { Icone } from './Icone';

export interface BotaoSuaveProps extends Omit<PressableProps, 'children'> {
  icone: LucideIcon;
  /** Lido pelo VoiceOver; o botão só tem ícone. */
  rotulo: string;
  /** Suave (chapado, padrão) ou elevado, para usar sobre capas e imagens. */
  variante?: 'suave' | 'elevado';
}

/** Botão redondo de 40 com ícone de 18 (voltar, mais, editar). */
export function BotaoSuave({
  icone,
  rotulo,
  variante = 'suave',
  style,
  disabled,
  ...props
}: BotaoSuaveProps) {
  const { medidas } = useTema();
  const tamanho = medidas.botaoSuave;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={4}
      {...props}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      style={(estado) => [
        // Desabilitado fica esmaecido: o toque não faz nada e o botão diz isso.
        { opacity: disabled ? 0.4 : estado.pressed ? 0.7 : 1 },
        typeof style === 'function' ? style(estado) : style,
      ]}
    >
      <Camada
        cor={variante === 'suave' ? 'superficie2' : 'superficie'}
        sombra={variante === 'elevado' ? 'elevacao' : undefined}
        raio={tamanho / 2}
        style={{ width: tamanho, height: tamanho, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icone icone={icone} tamanho={18} cor="texto" />
      </Camada>
    </Pressable>
  );
}
