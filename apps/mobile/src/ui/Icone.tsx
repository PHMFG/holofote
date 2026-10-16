import type { NomeCor } from '@holofote/tokens';
import type { LucideIcon } from 'lucide-react-native';
import { useTema } from '../tema/ProvedorTema';

export interface IconeProps {
  icone: LucideIcon;
  tamanho?: number;
  cor?: NomeCor;
  /** Espessura do traço em px; o Figma usa 1,8 na maioria dos ícones. */
  traco?: number;
}

/** Ícone do lucide com o traço do Figma: 1,8 px absoluto e cor por token. */
export function Icone({
  icone: Componente,
  tamanho = 22,
  cor = 'textoSuave',
  traco = 1.8,
}: IconeProps) {
  const tema = useTema();
  return (
    <Componente
      size={tamanho}
      color={tema.cores[cor]}
      strokeWidth={traco}
      absoluteStrokeWidth
      accessible={false}
    />
  );
}
