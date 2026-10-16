import type { ComponentType } from 'react';

/** Exemplo de um componente para a tela /dev/catalogo. */
export interface Historia {
  titulo: string;
  /** Nó do Figma onde o componente aparece, para comparar. */
  figma: string;
  Exemplo: ComponentType;
}
