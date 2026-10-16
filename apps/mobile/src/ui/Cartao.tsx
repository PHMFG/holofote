import type { ViewProps } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';

export type VarianteCartao = 'elevado' | 'afundado' | 'contornado';

export interface CartaoProps extends ViewProps {
  /**
   * elevado: superfície com Elevação (padrão, raio 24, padding 16);
   * afundado: post citado e campos (raio 20, padding 12);
   * contornado: opções de folha (fundo com borda, raio 20).
   */
  variante?: VarianteCartao;
  /** Cartões que agrupam linhas de lista usam padding vertical 4 em vez de 16. */
  lista?: boolean;
}

export function Cartao({ variante = 'elevado', lista, style, ...props }: CartaoProps) {
  const { medidas } = useTema();
  if (variante === 'elevado') {
    return (
      <Camada
        {...props}
        cor="superficie"
        sombra="elevacao"
        raio={medidas.cartaoRaio}
        style={[
          lista
            ? { paddingHorizontal: medidas.cartaoPadding, paddingVertical: 4 }
            : { padding: medidas.cartaoPadding },
          style,
        ]}
      />
    );
  }
  if (variante === 'afundado') {
    return (
      <Camada
        {...props}
        cor="superficie2"
        sombra="afundado"
        raio={20}
        style={[{ padding: 12 }, style]}
      />
    );
  }
  return (
    <Camada
      {...props}
      cor="fundo"
      borda={{ cor: 'linha', largura: 1 }}
      raio={20}
      style={[{ paddingHorizontal: 14, paddingVertical: 12 }, style]}
    />
  );
}
