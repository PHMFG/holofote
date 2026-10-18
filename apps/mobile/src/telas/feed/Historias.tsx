import type { HistoriaResumo } from '@holofote/shared';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { Aparecer } from '../../ui/Aparecer';
import { CURVA, DURACAO, useMovimento } from '../../ui/movimento';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { primeiroNome } from '../../formatar';

const AVATAR = 56;

export interface HistoriasProps {
  historias: HistoriaResumo[];
  /** Iniciais do jogador para o primeiro item ("Você"). */
  iniciaisJogador: string;
}

/**
 * Fileira de histórias do feed (Figma 16:57). O primeiro item é "Você", sem anel de destaque,
 * com o + que abre o compositor; os outros ganham anel de destaque enquanto não foram vistos.
 * Os itens entram em cascata, o anel das não vistas respira (um loop só para a fileira inteira)
 * e, quando uma história é vista, o anel de destaque se desfaz.
 */
export function Historias({ historias, iniciaisJogador }: HistoriasProps) {
  const { medidas } = useTema();
  const { reduzido } = useMovimento();
  const pulso = useSharedValue(0);
  const temNova = historias.some((h) => !h.vista);

  useEffect(() => {
    if (reduzido || !temNova) {
      pulso.value = 0;
      return;
    }
    pulso.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(pulso);
  }, [reduzido, temNova, pulso]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // A fileira vai de ponta a ponta: desfaz a margem da tela e devolve no conteúdo.
      style={{ marginHorizontal: -medidas.margemLateral }}
      contentContainerStyle={[estilos.fileira, { paddingHorizontal: medidas.margemLateral }]}
    >
      <Aparecer indice={0}>
        <Item
          rotulo="Você"
          rotuloAcessivel="Você, escrever um post"
          onPress={() => router.push('/novo-post')}
          anel="linha"
          pulso={pulso}
          selo
        >
          <Avatar iniciais={iniciaisJogador} tom="escuro" tamanho={AVATAR} nome="Você" />
        </Item>
      </Aparecer>
      {historias.map((h, i) => (
        <Aparecer key={h.id} indice={i + 1}>
          <Item
            rotulo={primeiroNome(h.autor.nome)}
            rotuloAcessivel={`História de ${h.autor.nome}${h.vista ? '' : ', nova'}`}
            onPress={() => router.push(`/historia/${h.id}`)}
            anel={h.vista ? 'linha' : 'destaque'}
            pulso={pulso}
            comDestaque
          >
            <Avatar
              iniciais={h.autor.iniciais}
              tom={h.autor.tomAvatar}
              tamanho={AVATAR}
              nome={h.autor.nome}
            />
          </Item>
        </Aparecer>
      ))}
    </ScrollView>
  );
}

function Item(p: {
  rotulo: string;
  rotuloAcessivel: string;
  onPress: () => void;
  anel: 'linha' | 'destaque';
  pulso: SharedValue<number>;
  /** Item de história (não o "Você"): o anel de destaque se desfaz quando ela é vista. */
  comDestaque?: boolean;
  selo?: boolean;
  children: ReactNode;
}) {
  const { cores } = useTema();
  const { reduceMotion } = useMovimento();
  const destaque = p.anel === 'destaque';
  const aceso = useSharedValue(destaque ? 1 : 0);
  const { pulso } = p;

  useEffect(() => {
    aceso.value = withTiming(destaque ? 1 : 0, {
      duration: DURACAO.lenta,
      easing: CURVA.saida,
      reduceMotion,
    });
  }, [destaque, reduceMotion, aceso]);

  // O anel de destaque fica por cima do anel de linha, com a mesma medida, e só muda de opacidade.
  const anelDeDestaque = useAnimatedStyle(() => ({
    opacity: aceso.value,
    transform: [{ scale: 0.9 + 0.1 * aceso.value }],
  }));
  // Halo que respira em volta das histórias não vistas.
  const halo = useAnimatedStyle(() => ({
    opacity: aceso.value * (0.1 + 0.4 * pulso.value),
    transform: [{ scale: 1 + 0.09 * pulso.value }],
  }));

  return (
    <Tocavel
      onPress={p.onPress}
      accessibilityRole="button"
      accessibilityLabel={p.rotuloAcessivel}
      style={estilos.item}
    >
      <View
        // 1,5 de borda + 3,5 de folga = 2 de borda + 3 de folga do destaque: o anel tem o mesmo
        // tamanho nos dois estados.
        style={[estilos.anel, { borderWidth: 1.5, borderColor: cores.linha, padding: 3.5 }]}
      >
        {p.comDestaque && (
          <>
            <Animated.View
              pointerEvents="none"
              style={[estilos.sobreposto, { borderWidth: 3, borderColor: cores.destaque }, halo]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                estilos.sobreposto,
                { borderWidth: 2, borderColor: cores.destaque },
                anelDeDestaque,
              ]}
            />
          </>
        )}
        {p.children}
        {p.selo && (
          <Esfera tom="escuro" tamanho={22} style={estilos.selo}>
            <Icone icone={Plus} tamanho={12} cor={corSobreEsfera('escuro')} traco={2} />
          </Esfera>
        )}
      </View>
      <Texto estilo="legenda" cor="textoSuave" numberOfLines={1} style={estilos.rotulo}>
        {p.rotulo}
      </Texto>
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  fileira: { gap: 12, paddingTop: 8, paddingBottom: 16 },
  item: { alignItems: 'center', gap: 7, width: 66 },
  anel: { borderRadius: 999 },
  // Cobre a caixa inteira do anel (borda incluída).
  sobreposto: {
    position: 'absolute',
    top: -1.5,
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    borderRadius: 999,
  },
  selo: { position: 'absolute', left: 42.5, top: 42.5 },
  rotulo: { maxWidth: 66 },
});
