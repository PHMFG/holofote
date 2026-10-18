import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../../tema/ProvedorTema';
import { Camada } from '../../ui/Camada';
import { MOLA, useMovimento } from '../../ui/movimento';
import { Pop } from './efeitos';
import { useRolagemDaCapa } from './TelaComCapa';

// No Figma (05 · 19:234, 08 · 26:355) a capa tem 148 com a barra de status de 50; o avatar de 94
// (anel de 5 no fundo) começa em 100 e sobrepõe 48 da capa.
const ALTURA_SEM_STATUS = 98;
const SOBREPOSICAO = 48;
/** Quanto da rolagem a capa acompanha: 0,45 significa que ela anda a 55% do conteúdo. */
const PARALLAX = 0.45;

export interface CapaProps {
  /** Linha de cima: botões elevados, indicadores, cabeçalho. */
  acoes: ReactNode;
  /** Avatar grande sobre a borda de baixo da capa. */
  avatar: ReactNode;
  /** Ao lado do avatar, à direita (ex.: um chip). */
  aoLadoDoAvatar?: ReactNode;
}

/**
 * Capa dos perfis (05 e 08): gradiente Cromo/Capa de borda a borda, por baixo da barra de
 * status. Vai como primeiro filho de uma TelaComCapa; desfaz o recuo do topo e as margens.
 * Ao rolar, o gradiente anda mais devagar que o conteúdo (parallax) e o avatar encolhe e fica
 * para trás; ao puxar além do topo, o avatar cresce e a cor da capa continua por cima.
 */
export function Capa({ acoes, avatar, aoLadoDoAvatar }: CapaProps) {
  const insets = useSafeAreaInsets();
  const { medidas, gradientes } = useTema();
  const { reduzido } = useMovimento();
  const rolagemDaTela = useRolagemDaCapa();
  const semRolagem = useSharedValue(0);
  const rolagem = rolagemDaTela ?? semRolagem;
  const topo = insets.top + 8;
  const altura = insets.top + ALTURA_SEM_STATUS;

  const fundo = useAnimatedStyle(() => ({
    transform: [{ translateY: reduzido ? 0 : Math.max(0, rolagem.value) * PARALLAX }],
  }));
  const avatarAnimado = useAnimatedStyle(() => {
    if (reduzido) return {};
    return {
      transform: [
        { translateY: interpolate(rolagem.value, [0, 120], [0, 22], Extrapolation.CLAMP) },
        {
          scale: interpolate(rolagem.value, [-120, 0, 120], [1.12, 1, 0.78], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <View style={{ marginTop: -topo, marginHorizontal: -medidas.margemLateral }}>
      {/* Puxando além do topo, a cor de cima da capa continua sobre o vazio. */}
      <View
        pointerEvents="none"
        style={[estilos.alemDoTopo, { backgroundColor: gradientes.capa.cores[0] }]}
      />
      <View style={{ height: altura, overflow: 'hidden' }}>
        <Animated.View style={[StyleSheet.absoluteFill, fundo]}>
          <Camada gradiente="capa" style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <View
        pointerEvents="box-none"
        style={[
          estilos.acoes,
          { height: altura, paddingTop: topo, paddingHorizontal: medidas.margemLateral },
        ]}
      >
        {acoes}
      </View>
      <View style={[estilos.linhaAvatar, { paddingHorizontal: medidas.margemLateral }]}>
        <Animated.View style={[estilos.origem, avatarAnimado]}>
          <Pop de={0.6} atraso={120} mola={MOLA.viva}>
            <Camada cor="fundo" raio={999} style={estilos.anel}>
              {avatar}
            </Camada>
          </Pop>
        </Animated.View>
        {aoLadoDoAvatar}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  alemDoTopo: { position: 'absolute', left: 0, right: 0, top: -800, height: 800 },
  // Os botões ficam por cima do gradiente e rolam junto com o conteúdo, sem o parallax.
  acoes: { position: 'absolute', left: 0, right: 0, top: 0 },
  linhaAvatar: {
    // A altura da capa vem do bloco de cima; aqui só o avatar, subindo sobre ela.
    marginTop: -SOBREPOSICAO,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  origem: { transformOrigin: 'left bottom' },
  anel: { padding: 5 },
});
