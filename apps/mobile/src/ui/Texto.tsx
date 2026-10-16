import { MAX_ESCALA_FONTE, type NomeCor, type NomeTipografia } from '@holofote/tokens';
import { Text, type TextProps } from 'react-native';
import { useTema } from '../tema/ProvedorTema';

/**
 * Cores permitidas em texto. texto-fraco fica de fora: não passa de 4,5:1 sobre as superfícies
 * (docs/DECISOES.md) e serve só para elementos decorativos.
 */
export type CorDeTexto = Exclude<NomeCor, 'textoFraco'>;

export interface TextoProps extends TextProps {
  /** Estilo de texto do Figma (Cromo/...). */
  estilo?: NomeTipografia;
  cor?: CorDeTexto;
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
