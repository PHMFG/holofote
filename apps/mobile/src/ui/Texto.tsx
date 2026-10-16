import { MAX_ESCALA_FONTE, type NomeCor, type NomeTipografia } from '@holofote/tokens';
import { Text, type TextProps } from 'react-native';
import { useTema } from '../tema/ProvedorTema';

export interface TextoProps extends TextProps {
  /** Estilo de texto do Figma (Cromo/...). */
  estilo?: NomeTipografia;
  cor?: NomeCor;
}

/** Todo texto do app passa por aqui: tipografia Cromo, cor por token e Dynamic Type limitado. */
export function Texto({ estilo = 'corpo', cor = 'texto', style, ...props }: TextoProps) {
  const tema = useTema();
  return (
    <Text
      maxFontSizeMultiplier={MAX_ESCALA_FONTE}
      {...props}
      style={[
        tema.tipografia[estilo],
        // Mini é sempre em maiúsculas (docs/PLANO.md, tipografia).
        estilo === 'mini' && { textTransform: 'uppercase' },
        { color: tema.cores[cor] },
        style,
      ]}
    />
  );
}
