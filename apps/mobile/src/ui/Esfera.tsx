import type { NomeGradiente, NomeSombra } from '@holofote/tokens';
import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import { Camada } from './Camada';
import type { CorDeTexto } from './Texto';

export type TomEsfera = 'escuro' | 'claro' | 'medio';

// Avatar 12:10 no Figma: Escuro usa Esfera preta + sombra Esfera; Claro e Médio usam sombra Esfera clara.
const ESTILOS: Record<
  TomEsfera,
  { gradiente: NomeGradiente; sombra: NomeSombra; conteudo: CorDeTexto }
> = {
  escuro: { gradiente: 'esferaPreta', sombra: 'esfera', conteudo: 'primarioTexto' },
  claro: { gradiente: 'esferaClara', sombra: 'esferaClara', conteudo: 'texto' },
  medio: { gradiente: 'esferaMedia', sombra: 'esferaClara', conteudo: 'texto' },
};

/** Cor de texto ou ícone por cima de uma esfera do tom dado. */
export function corSobreEsfera(tom: TomEsfera): CorDeTexto {
  return ESTILOS[tom].conteudo;
}

export interface EsferaProps extends ViewProps {
  tom?: TomEsfera;
  tamanho?: number;
  children?: ReactNode;
}

/** Esfera cromada por gradiente radial (no escuro os tons se invertem, como no Figma). */
export function Esfera({ tom = 'escuro', tamanho = 40, style, children, ...props }: EsferaProps) {
  const { gradiente, sombra } = ESTILOS[tom];
  return (
    <Camada
      {...props}
      gradiente={gradiente}
      sombra={sombra}
      raio={tamanho / 2}
      style={[
        { width: tamanho, height: tamanho, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      {children}
    </Camada>
  );
}
