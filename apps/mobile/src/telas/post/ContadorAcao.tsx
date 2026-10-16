import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { formatarNumero } from '../../formatar';
import { Camada } from '../../ui/Camada';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';

export interface ContadorAcaoProps {
  icone: LucideIcon;
  valor: number;
  /** Lido depois do número: "37 respostas". */
  rotulo: string;
  /** Curtida dada: chip destaque com brilho (docs/DECISOES.md, contador ativo). */
  ativo?: boolean;
  onPress?: () => void;
}

/**
 * Chip de contador do post aberto (Figma 17:188): linha sobre o fundo ou destaque quando ativo.
 * Igual ao Chip de src/ui, mas com rótulo acessível próprio ("37 respostas" em vez de "37"):
 * o Chip lê só o texto visível.
 */
export function ContadorAcao({ icone, valor, rotulo, ativo, onPress }: ContadorAcaoProps) {
  const numero = formatarNumero(valor);
  const cor = ativo ? 'destaqueSobre' : 'texto';
  return (
    <Tocavel
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`${numero} ${rotulo}`}
      accessibilityState={{ selected: !!ativo }}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <Camada
        cor={ativo ? 'destaque' : 'fundo'}
        sombra={ativo ? 'brilhoDestaque' : undefined}
        borda={{ cor: ativo ? 'destaque' : 'linha', largura: 1 }}
        raio={999}
        style={estilos.chip}
      >
        <Icone icone={icone} tamanho={14} cor={cor} traco={2} />
        <Texto estilo="legenda" cor={cor}>
          {numero}
        </Texto>
      </Camada>
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
