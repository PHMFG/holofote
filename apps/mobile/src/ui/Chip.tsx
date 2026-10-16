import type { NomeCor, NomeGradiente, NomeSombra } from '@holofote/tokens';
import { Check, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { Icone } from './Icone';
import { Texto } from './Texto';

export type VarianteChip =
  'linha' | 'tracejado' | 'afundado' | 'destaque' | 'suave' | 'primario' | 'elevado';

interface Aparencia {
  cor?: NomeCor;
  gradiente?: NomeGradiente;
  sombra?: NomeSombra;
  borda?: NomeCor;
  tracejado?: boolean;
  texto: NomeCor;
}

const APARENCIAS: Record<VarianteChip, Aparencia> = {
  linha: { cor: 'superficie', borda: 'linha', texto: 'texto' },
  tracejado: { cor: 'fundo', borda: 'textoFraco', tracejado: true, texto: 'textoSuave' },
  afundado: { cor: 'superficie2', sombra: 'afundado', texto: 'texto' },
  destaque: { cor: 'destaque', sombra: 'brilhoDestaque', texto: 'destaqueSobre' },
  suave: { cor: 'destaqueSuave', texto: 'destaqueTinta' },
  primario: { gradiente: 'pilulaPreta', sombra: 'esfera', texto: 'primarioTexto' },
  elevado: { cor: 'superficie', borda: 'linha', sombra: 'elevacao', texto: 'texto' },
};

// Alturas finais com a borda de 1 px: grande 38, médio 34, pequeno 30.
const TAMANHOS = {
  grande: { paddingHorizontal: 14, paddingVertical: 9, icone: 14 },
  medio: { paddingHorizontal: 12, paddingVertical: 7, icone: 14 },
  // O pequeno do Figma (28:460) não tem borda: 30 de altura com a borda de 1 px.
  pequeno: { paddingHorizontal: 9, paddingVertical: 5, icone: 14 },
} as const;

export interface ChipProps {
  rotulo: string;
  variante?: VarianteChip;
  tamanho?: keyof typeof TAMANHOS;
  icone?: LucideIcon;
  /** Ícone depois do texto (ex.: "Desfazer · 2" com o raio). */
  iconeDepois?: LucideIcon;
  /** Fundo da variante linha: superfície (padrão) ou o fundo da tela. */
  sobreFundo?: boolean;
  /**
   * Chip de escolha: selecionado vira primário com check, não selecionado vira linha.
   * Quando definido, ignora `variante`.
   */
  selecionado?: boolean;
  onPress?: () => void;
}

export function Chip({
  rotulo,
  variante = 'linha',
  tamanho = 'medio',
  icone,
  iconeDepois,
  sobreFundo,
  selecionado,
  onPress,
}: ChipProps) {
  const { cores } = useTema();
  const ehEscolha = selecionado !== undefined;
  const efetiva: VarianteChip = ehEscolha ? (selecionado ? 'primario' : 'linha') : variante;
  const ap = APARENCIAS[efetiva];
  const medida = TAMANHOS[tamanho];
  const iconeInicial = ehEscolha && selecionado ? Check : icone;

  // Toda variante tem borda de 1 px (transparente quando o Figma não tem) para o chip
  // não mudar de altura ao ser selecionado.
  const borda: ViewStyle = {
    borderWidth: 1,
    borderColor: ap.borda ? cores[ap.borda] : 'transparent',
    borderStyle: ap.tracejado ? 'dashed' : 'solid',
  };

  const conteudo = (
    <Camada
      cor={efetiva === 'linha' && sobreFundo ? 'fundo' : ap.cor}
      gradiente={ap.gradiente}
      sombra={ap.sombra}
      raio={999}
      style={[
        estilos.chip,
        borda,
        { paddingHorizontal: medida.paddingHorizontal, paddingVertical: medida.paddingVertical },
      ]}
    >
      {iconeInicial && (
        <Icone icone={iconeInicial} tamanho={medida.icone} cor={ap.texto} traco={2} />
      )}
      <Texto estilo="legenda" cor={ap.texto}>
        {rotulo}
      </Texto>
      {iconeDepois && <Icone icone={iconeDepois} tamanho={12} cor={ap.texto} traco={2} />}
    </Camada>
  );

  if (!onPress)
    return (
      <View accessible accessibilityLabel={rotulo}>
        {conteudo}
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={ehEscolha ? 'checkbox' : 'button'}
      accessibilityLabel={rotulo}
      accessibilityState={ehEscolha ? { checked: !!selecionado } : undefined}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      {conteudo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6 },
});
