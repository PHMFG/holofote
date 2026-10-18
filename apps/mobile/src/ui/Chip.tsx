import type { NomeCor, NomeGradiente, NomeSombra } from '@holofote/tokens';
import { Check, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { toqueDeSelecao } from './haptico';
import { Icone } from './Icone';
import { CURVA, DURACAO, useMovimento } from './movimento';
import { Texto, type CorDeTexto } from './Texto';
import { PressableAnimado, useFeedbackDoToque } from './Tocavel';

export type VarianteChip =
  'linha' | 'tracejado' | 'afundado' | 'destaque' | 'suave' | 'primario' | 'elevado';

interface Aparencia {
  cor?: NomeCor;
  gradiente?: NomeGradiente;
  sombra?: NomeSombra;
  borda?: NomeCor;
  tracejado?: boolean;
  texto: CorDeTexto;
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
  /** Rótulo lido pelo VoiceOver quando o texto visível não basta (ex.: "Ver" vira "Ver respostas"). */
  rotuloAcessivel?: string;
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
  rotuloAcessivel,
  onPress,
}: ChipProps) {
  const { cores } = useTema();
  const ehEscolha = selecionado !== undefined;
  const efetiva: VarianteChip = ehEscolha ? (selecionado ? 'primario' : 'linha') : variante;
  const ap = APARENCIAS[efetiva];
  const medida = TAMANHOS[tamanho];
  const feedback = useFeedbackDoToque({}, { desabilitado: false, brilho: 0.8 });

  // Toda variante tem borda de 1 px (transparente quando o Figma não tem) para o chip
  // não mudar de altura ao ser selecionado.
  const borda: ViewStyle = {
    borderWidth: 1,
    borderColor: ap.borda ? cores[ap.borda] : 'transparent',
    borderStyle: ap.tracejado ? 'dashed' : 'solid',
  };

  const conteudo = ehEscolha ? (
    <ChipDeEscolha
      rotulo={rotulo}
      selecionado={!!selecionado}
      medida={medida}
      icone={icone}
      iconeDepois={iconeDepois}
      sobreFundo={sobreFundo}
    />
  ) : (
    <Camada
      cor={efetiva === 'linha' && sobreFundo ? 'fundo' : ap.cor}
      gradiente={ap.gradiente}
      sombra={ap.sombra}
      raio={999}
      style={[
        estilos.estatico,
        borda,
        { paddingHorizontal: medida.paddingHorizontal, paddingVertical: medida.paddingVertical },
      ]}
    >
      {icone && <Icone icone={icone} tamanho={medida.icone} cor={ap.texto} traco={2} />}
      <Texto estilo="legenda" cor={ap.texto}>
        {rotulo}
      </Texto>
      {iconeDepois && <Icone icone={iconeDepois} tamanho={12} cor={ap.texto} traco={2} />}
    </Camada>
  );

  if (!onPress)
    return (
      <View accessible accessibilityLabel={rotuloAcessivel ?? rotulo}>
        {conteudo}
      </View>
    );
  return (
    <PressableAnimado
      onPress={() => {
        if (ehEscolha) toqueDeSelecao();
        onPress();
      }}
      onPressIn={feedback.onPressIn}
      onPressOut={feedback.onPressOut}
      accessibilityRole={ehEscolha ? 'checkbox' : 'button'}
      accessibilityLabel={rotuloAcessivel ?? rotulo}
      accessibilityState={ehEscolha ? { checked: !!selecionado } : undefined}
      style={feedback.style}
    >
      {conteudo}
    </PressableAnimado>
  );
}

/**
 * Chip de escolha: duas camadas de fundo empilhadas (linha e pílula preta) trocam de opacidade;
 * o check abre espaço crescendo na largura (o chip cresce junto, sem pulo) e o texto troca de cor
 * em transição. Com movimento reduzido a troca é imediata.
 */
function ChipDeEscolha({
  rotulo,
  selecionado,
  medida,
  icone,
  iconeDepois,
  sobreFundo,
}: {
  rotulo: string;
  selecionado: boolean;
  medida: (typeof TAMANHOS)[keyof typeof TAMANHOS];
  icone?: LucideIcon;
  iconeDepois?: LucideIcon;
  sobreFundo?: boolean;
}) {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const mistura = useSharedValue(selecionado ? 1 : 0);
  useEffect(() => {
    const alvo = selecionado ? 1 : 0;
    mistura.value = reduzido
      ? alvo
      : withTiming(alvo, { duration: DURACAO.rapida, easing: CURVA.saida });
  }, [selecionado, reduzido, mistura]);

  const camadaLinha = useAnimatedStyle(() => ({ opacity: 1 - mistura.value }));
  const camadaPrimaria = useAnimatedStyle(() => ({ opacity: mistura.value }));
  const verificar = useAnimatedStyle(() => ({ opacity: mistura.value }));
  // Sem ícone próprio, o check ocupa uma casa que abre (largura 0 até ícone + espaço).
  const casa = useAnimatedStyle(() => ({
    width: (medida.icone + 6) * mistura.value,
    opacity: mistura.value,
  }));
  const original = useAnimatedStyle(() => ({ opacity: 1 - mistura.value }));

  return (
    <View style={estilos.chip}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, camadaLinha]}>
        <Camada
          cor={sobreFundo ? 'fundo' : 'superficie'}
          raio={999}
          style={[
            StyleSheet.absoluteFill,
            { borderWidth: 1, borderColor: cores.linha, borderStyle: 'solid' },
          ]}
        />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, camadaPrimaria]}>
        <Camada
          gradiente="pilulaPreta"
          sombra="esfera"
          raio={999}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View
        style={[
          estilos.linha,
          {
            borderWidth: 1,
            borderColor: 'transparent',
            paddingHorizontal: medida.paddingHorizontal,
            paddingVertical: medida.paddingVertical,
          },
        ]}
      >
        {icone ? (
          <View style={[estilos.casaFixa, { width: medida.icone, height: medida.icone }]}>
            <Animated.View style={[StyleSheet.absoluteFill, original]}>
              <Icone icone={icone} tamanho={medida.icone} cor="texto" traco={2} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, verificar]}>
              <Icone icone={Check} tamanho={medida.icone} cor="primarioTexto" traco={2} />
            </Animated.View>
          </View>
        ) : (
          <Animated.View style={[estilos.casa, casa]}>
            <Icone icone={Check} tamanho={medida.icone} cor="primarioTexto" traco={2} />
          </Animated.View>
        )}
        <Texto estilo="legenda" cor={selecionado ? 'primarioTexto' : 'texto'} transicao>
          {rotulo}
        </Texto>
        {iconeDepois && (
          <View style={estilos.depois}>
            <Icone
              icone={iconeDepois}
              tamanho={12}
              cor={selecionado ? 'primarioTexto' : 'texto'}
              traco={2}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  chip: { alignSelf: 'flex-start' },
  estatico: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6 },
  linha: { flexDirection: 'row', alignItems: 'center' },
  casa: { overflow: 'hidden' },
  casaFixa: { marginRight: 6 },
  depois: { marginLeft: 6 },
});
