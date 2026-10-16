import { useTema } from '../tema/ProvedorTema';
import { Esfera, corSobreEsfera, type TomEsfera } from './Esfera';
import { Texto } from './Texto';

export interface AvatarProps {
  iniciais: string;
  /** Escuro = jogador; Claro e Médio = personagens da IA (descrição do componente no Figma). */
  tom?: TomEsfera;
  tamanho?: number;
  /** Nome lido pelo VoiceOver; sem ele, lê as iniciais. */
  nome?: string;
}

export function Avatar({ iniciais, tom = 'claro', tamanho = 40, nome }: AvatarProps) {
  const { tipografia, medidas } = useTema();
  // Cromo/Iniciais vale para o avatar padrão; nos outros tamanhos a letra acompanha a esfera,
  // como nos avatares de 28 de 13 · Respostas.
  const escala = tamanho / medidas.avatar;
  const letra =
    escala === 1
      ? undefined
      : {
          fontSize: tipografia.iniciais.fontSize * escala,
          lineHeight: tipografia.iniciais.lineHeight * escala,
        };
  return (
    <Esfera
      tom={tom}
      tamanho={tamanho}
      accessible
      accessibilityRole="image"
      accessibilityLabel={nome ?? iniciais}
    >
      <Texto estilo="iniciais" cor={corSobreEsfera(tom)} style={letra}>
        {iniciais.slice(0, 2).toUpperCase()}
      </Texto>
    </Esfera>
  );
}
