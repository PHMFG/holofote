import { MAX_ESCALA_FONTE, type NomeCor, type NomeTipografia } from '@holofote/tokens';
import { StyleSheet, Text, type TextProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { DURACAO, useMovimento } from './movimento';

/**
 * Cores permitidas em texto. texto-fraco fica de fora: não passa de 4,5:1 sobre as superfícies
 * (docs/DECISOES.md) e serve só para elementos decorativos.
 */
export type CorDeTexto = Exclude<NomeCor, 'textoFraco'>;

export interface TextoProps extends TextProps {
  /** Estilo de texto do Figma (Cromo/...). */
  estilo?: NomeTipografia;
  cor?: CorDeTexto;
  /**
   * Anima a troca de `cor` (transição CSS do Reanimated, no thread de UI). Só liga onde o texto
   * muda de cor com o estado (chip selecionado, opção do segmentado, contador curtido): em listas
   * longas, o Texto comum continua sendo um Text puro.
   */
  transicao?: boolean;
}

/** Todo texto do app passa por aqui: tipografia Cromo, cor por token e Dynamic Type limitado. */
export function Texto({ estilo = 'corpo', cor = 'texto', style, transicao, ...props }: TextoProps) {
  const tema = useTema();
  const estiloFinal = [
    tema.tipografia[estilo],
    // Mini é sempre em maiúsculas (docs/PLANO.md, tipografia).
    estilo === 'mini' && { textTransform: 'uppercase' as const },
    { color: tema.cores[cor] },
    style,
  ];
  if (transicao) return <TextoComTransicao {...props} style={estiloFinal} />;
  return <Text maxFontSizeMultiplier={MAX_ESCALA_FONTE} {...props} style={estiloFinal} />;
}

function TextoComTransicao({ style, ...props }: TextProps) {
  const { tempo } = useMovimento();
  return (
    <Animated.Text
      maxFontSizeMultiplier={MAX_ESCALA_FONTE}
      {...props}
      // Achatado: a transição CSS lê as propriedades de um objeto só.
      style={[
        StyleSheet.flatten(style),
        {
          transitionProperty: 'color',
          transitionDuration: tempo(DURACAO.rapida),
          transitionTimingFunction: 'ease-out',
        },
      ]}
    />
  );
}
