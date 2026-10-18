import type { LucideIcon } from 'lucide-react-native';
import type { PressableProps } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { Icone } from './Icone';
import { PressableAnimado, useFeedbackDoToque } from './Tocavel';

export interface BotaoSuaveProps extends Omit<PressableProps, 'children'> {
  icone: LucideIcon;
  /** Lido pelo VoiceOver; o botão só tem ícone. */
  rotulo: string;
  /** Suave (chapado, padrão) ou elevado, para usar sobre capas e imagens. */
  variante?: 'suave' | 'elevado';
}

/** Botão redondo de 40 com ícone de 18 (voltar, mais, editar). Encolhe e perde brilho ao toque. */
export function BotaoSuave({
  icone,
  rotulo,
  variante = 'suave',
  style,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: BotaoSuaveProps) {
  const { medidas } = useTema();
  const tamanho = medidas.botaoSuave;
  // Desabilitado fica esmaecido: o toque não faz nada e o botão diz isso.
  const feedback = useFeedbackDoToque(
    { onPressIn, onPressOut, style },
    { brilho: 0.8, desabilitado: !!disabled, opacidadeDesabilitado: 0.4 },
  );
  return (
    <PressableAnimado
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={4}
      {...props}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPressIn={feedback.onPressIn}
      onPressOut={feedback.onPressOut}
      style={feedback.style}
    >
      <Camada
        cor={variante === 'suave' ? 'superficie2' : 'superficie'}
        sombra={variante === 'elevado' ? 'elevacao' : undefined}
        raio={tamanho / 2}
        style={{ width: tamanho, height: tamanho, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icone icone={icone} tamanho={18} cor="texto" />
      </Camada>
    </PressableAnimado>
  );
}
