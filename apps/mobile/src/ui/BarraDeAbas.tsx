import type { LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { Esfera, corSobreEsfera } from './Esfera';
import { toqueDeSelecao } from './haptico';
import { Icone } from './Icone';
import { DURACAO, MOLA, useMovimento } from './movimento';
import { Tocavel } from './Tocavel';

export interface Aba<Chave extends string> {
  chave: Chave;
  rotulo: string;
  icone: LucideIcon;
  /** Ponto de novidade (ex.: alertas não lidos), na cor de destaque. */
  novidade?: boolean;
}

export interface BarraDeAbasProps<Chave extends string> {
  abas: readonly Aba<Chave>[];
  ativa: Chave;
  onSelecionar: (chave: Chave) => void;
}

const TAMANHO_ABA = 52;
// Margem lateral da pílula (30 de cada lado), borda de 1 e padding de 6: o miolo tem a largura
// da tela menos 74. Serve só para posicionar o indicador antes da primeira medida de verdade.
const SOBRA_HORIZONTAL = 60 + 2 + 12;

/**
 * Navegação flutuante em pílula (Figma 12:26). A aba ativa é uma esfera preta que desliza até a
 * aba tocada na mola "deslizante"; os ícones trocam de cor em crossfade com a passagem da
 * esfera e crescem um pouco na aba ativa; o ponto de novidade aparece com um pop. Tocar numa aba
 * dá um háptico de seleção. Com movimento reduzido a esfera salta e o ponto só faz fade.
 */
export function BarraDeAbas<Chave extends string>({
  abas,
  ativa,
  onSelecionar,
}: BarraDeAbasProps<Chave>) {
  const { reduzido } = useMovimento();
  const { width: larguraTela } = useWindowDimensions();
  const intervalos = Math.max(1, abas.length - 1);
  const indice = Math.max(
    0,
    abas.findIndex((a) => a.chave === ativa),
  );
  // Posição da esfera em unidades de aba (0, 1, 2...) e o passo em pt entre uma aba e a seguinte.
  const posicao = useSharedValue(indice);
  const passo = useSharedValue((larguraTela - SOBRA_HORIZONTAL - TAMANHO_ABA) / intervalos);

  useEffect(() => {
    posicao.value = reduzido ? indice : withSpring(indice, MOLA.deslizante);
  }, [indice, reduzido, posicao]);

  const esfera = useAnimatedStyle(() => ({
    transform: [{ translateX: posicao.value * passo.value }],
  }));

  return (
    <Camada
      cor="superficie"
      sombra="elevacao"
      raio={32}
      borda={{ cor: 'linha', largura: 1 }}
      // No iOS só "tabbar" vira trait; com ele o VoiceOver lê "aba, 1 de 5" nos botões.
      accessibilityRole="tabbar"
      style={estilos.pilula}
    >
      <View
        style={estilos.trilho}
        onLayout={(e) => {
          passo.value = (e.nativeEvent.layout.width - TAMANHO_ABA) / intervalos;
        }}
      >
        <Animated.View pointerEvents="none" style={[estilos.esfera, esfera]}>
          <Esfera tom="escuro" tamanho={TAMANHO_ABA} />
        </Animated.View>
        {abas.map((aba, i) => (
          <ItemDeAba
            key={aba.chave}
            aba={aba}
            indice={i}
            posicao={posicao}
            selecionada={aba.chave === ativa}
            onPress={() => {
              if (aba.chave !== ativa) toqueDeSelecao();
              onSelecionar(aba.chave);
            }}
          />
        ))}
      </View>
    </Camada>
  );
}

function ItemDeAba<Chave extends string>({
  aba,
  indice,
  posicao,
  selecionada,
  onPress,
}: {
  aba: Aba<Chave>;
  indice: number;
  posicao: SharedValue<number>;
  selecionada: boolean;
  onPress: () => void;
}) {
  const { reduzido } = useMovimento();
  // 1 com a esfera em cima desta aba, 0 a uma aba de distância ou mais.
  const proximidade = (p: number) => {
    'worklet';
    return Math.min(1, Math.max(0, 1 - Math.abs(p - indice)));
  };
  const repouso = useAnimatedStyle(() => ({ opacity: 1 - proximidade(posicao.value) }));
  const ativo = useAnimatedStyle(() => ({
    opacity: proximidade(posicao.value),
    transform: [{ scale: reduzido ? 1 : 1 + 0.1 * proximidade(posicao.value) }],
  }));
  return (
    <Tocavel
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={aba.novidade ? `${aba.rotulo}, com novidades` : aba.rotulo}
      accessibilityState={{ selected: selecionada }}
      brilho={1}
      style={estilos.aba}
    >
      <Animated.View style={[StyleSheet.absoluteFill, estilos.icone, repouso]}>
        <Icone icone={aba.icone} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, estilos.icone, ativo]}>
        <Icone icone={aba.icone} cor={corSobreEsfera('escuro')} />
      </Animated.View>
      {aba.novidade && <PontoNovidade />}
    </Tocavel>
  );
}

/** Ponto de 11 px com aro na cor da superfície (camada "novidade" do Figma); entra com pop. */
function PontoNovidade() {
  const { cores } = useTema();
  const { reduzido, reduceMotion } = useMovimento();
  const entrada = reduzido
    ? FadeIn.duration(DURACAO.rapida).reduceMotion(reduceMotion)
    : ZoomIn.springify()
        .damping(MOLA.viva.damping)
        .stiffness(MOLA.viva.stiffness)
        .reduceMotion(reduceMotion);
  const saida = reduzido
    ? FadeOut.duration(DURACAO.instante).reduceMotion(reduceMotion)
    : ZoomOut.duration(DURACAO.instante).reduceMotion(reduceMotion);
  return (
    <Animated.View
      entering={entrada}
      exiting={saida}
      pointerEvents="none"
      style={[estilos.ponto, { backgroundColor: cores.destaque, borderColor: cores.superficie }]}
    />
  );
}

const estilos = StyleSheet.create({
  pilula: {
    height: 64,
    padding: 6,
    marginHorizontal: 30,
  },
  trilho: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  esfera: { position: 'absolute', left: 0, top: 0 },
  aba: { width: TAMANHO_ABA, height: TAMANHO_ABA, alignItems: 'center', justifyContent: 'center' },
  icone: { alignItems: 'center', justifyContent: 'center' },
  ponto: {
    position: 'absolute',
    left: 30,
    top: 12,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
  },
});
