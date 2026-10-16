import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Camada } from './Camada';
import { Icone } from './Icone';
import { Texto } from './Texto';

export interface OpcaoSegmentado<Valor extends string> {
  valor: Valor;
  rotulo: string;
  icone?: LucideIcon;
}

export interface SegmentadoProps<Valor extends string> {
  opcoes: readonly OpcaoSegmentado<Valor>[];
  valor: Valor;
  onMudar: (valor: Valor) => void;
  /** Lido pelo VoiceOver como nome do grupo. */
  rotulo: string;
}

/** Controle segmentado em trilho afundado (10 · Aparência, 13 · Respostas). */
export function Segmentado<Valor extends string>({
  opcoes,
  valor,
  onMudar,
  rotulo,
}: SegmentadoProps<Valor>) {
  return (
    <Camada
      cor="superficie2"
      sombra="afundado"
      raio={999}
      accessibilityRole="radiogroup"
      accessibilityLabel={rotulo}
      style={estilos.trilho}
    >
      {opcoes.map((opcao) => {
        const selecionada = opcao.valor === valor;
        const cor = selecionada ? 'texto' : 'textoSuave';
        return (
          <Pressable
            key={opcao.valor}
            onPress={() => onMudar(opcao.valor)}
            accessibilityRole="radio"
            accessibilityLabel={opcao.rotulo}
            accessibilityState={{ checked: selecionada }}
            style={estilos.opcao}
          >
            <Camada
              cor={selecionada ? 'superficie' : undefined}
              sombra={selecionada ? 'elevacao' : undefined}
              raio={999}
              style={[estilos.interno, { paddingVertical: opcao.icone ? 10 : 9 }]}
            >
              {opcao.icone && <Icone icone={opcao.icone} tamanho={15} cor={cor} traco={2} />}
              <Texto estilo="legenda" cor={cor}>
                {opcao.rotulo}
              </Texto>
            </Camada>
          </Pressable>
        );
      })}
    </Camada>
  );
}

const estilos = StyleSheet.create({
  trilho: { flexDirection: 'row', padding: 4, gap: 4 },
  opcao: { flex: 1 },
  interno: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
});
