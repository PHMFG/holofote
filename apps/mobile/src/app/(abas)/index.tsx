import type { Post } from '@holofote/shared';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ArrowUp, Plus } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tratarErroDeAcao } from '../../acoes/erros';
import { useCurtir, useFeed, useJornada, useMundo } from '../../api/consultas';
import { useTempoReal } from '../../api/tempoReal';
import { BannerEvento } from '../../telas/feed/BannerEvento';
import { BarraDoMundo } from '../../telas/feed/BarraDoMundo';
import { Historias } from '../../telas/feed/Historias';
import { ehPostNovoDoFeed, rotuloNovosPosts } from '../../telas/feed/novosPosts';
import { PostDoFeed } from '../../telas/feed/PostDoFeed';
import { useAgora } from '../../tempo';
import { useTema } from '../../tema/ProvedorTema';
import { useAnimacoes } from '../../telas/animacao/animacoes';
import { ItemAnimado, useRegistroDeEntradas } from '../../telas/animacao/entradas';
import { Pop } from '../../telas/animacao/Pop';
import { useEscalaDeToque } from '../../telas/animacao/toque';
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { ESCALA_TOQUE } from '../../ui/movimento';
import { ESPACO_BARRA_DE_ABAS, Tela } from '../../ui/Tela';

// Medidas da barra de abas flutuante ((abas)/_layout.tsx): pílula de 64, presa a
// max(inset - 8, 8) da base. O botão de novo post fica 16 acima dela, como no Figma (16:224).
const ALTURA_BARRA = 64;
const BOTAO_NOVO_POST = 56;
// Pílula do topo (BarraDoMundo): esfera de 48 + 6 de folga em cima e embaixo + borda de 1,5.
const ALTURA_PILULA = 63;
/** Quanto o fim da pílula fica acima do primeiro item da lista. */
const RESPIRO_SOB_A_PILULA = 8;

/** A cor do fundo com opacidade 0, para o gradiente não passar por um cinza no meio. */
function fundoTransparente(cor: string): string {
  return /^#[0-9a-f]{6}$/i.test(cor) ? `${cor}00` : 'transparent';
}
/** Quantos posts da primeira carga entram em cascata: os que cabem na tela. */
const POSTS_EM_CASCATA = 5;

/** 02 · Feed (Figma 16:21 e 30:589). */
export default function Feed() {
  const { cores, medidas } = useTema();
  const insets = useSafeAreaInsets();
  const mundo = useMundo();
  const feed = useFeed(mundo.data?.id);
  const jornada = useJornada();
  const { mutate: curtir } = useCurtir();
  const agora = useAgora();
  const lista = useRef<FlashListRef<Post>>(null);
  const [novos, setNovos] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  // Só vira verdadeiro quando o conteúdo passa por baixo da pílula (muda poucas vezes, não por quadro).
  const [rolou, setRolou] = useState(false);

  useTempoReal((evento) => {
    if (ehPostNovoDoFeed(evento)) setNovos((n) => n + 1);
  });

  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.itens) ?? [], [feed.data]);
  // Primeira carga em cascata; post que chega no topo entra deslizando; o resto nunca anima de novo.
  const idsDosPosts = useMemo(() => posts.map((p) => p.id), [posts]);
  const entradas = useRegistroDeEntradas(idsDosPosts, {
    novos: 'topo',
    cascataInicial: POSTS_EM_CASCATA,
  });
  const animacoes = useAnimacoes();
  const botao = useEscalaDeToque(ESCALA_TOQUE - 0.04);
  const historias = feed.data?.pages[0]?.historias ?? [];
  const evento = jornada.data?.proximoEvento;

  const aoCurtir = useCallback(
    (post: Post) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      curtir(post.id, { onError: tratarErroDeAcao });
    },
    [curtir],
  );

  const atualizar = async () => {
    setAtualizando(true);
    setNovos(0);
    await Promise.all([feed.refetch(), jornada.refetch()]);
    setAtualizando(false);
  };

  const verNovos = () => {
    setNovos(0);
    const aoTopo = () => lista.current?.scrollToOffset({ offset: 0, animated: true });
    aoTopo();
    void feed.refetch().then(aoTopo);
  };

  const topoDaPilula = insets.top + 8;
  const baseDaPilula = topoDaPilula + ALTURA_PILULA;
  const baseDaLista = ESPACO_BARRA_DE_ABAS + insets.bottom;
  const baseDoBotao = Math.max(insets.bottom - 8, 8) + ALTURA_BARRA + 16;

  let conteudo;
  if (feed.isPending) {
    conteudo = <EstadoTela tipo="carregando" frase="Carregando o feed…" />;
  } else if (feed.isError && !feed.data) {
    conteudo = (
      <EstadoTela
        tipo="erro"
        frase="Não deu para carregar o feed."
        acao={{ rotulo: 'Tentar de novo', onPress: () => void feed.refetch() }}
      />
    );
  } else {
    conteudo = (
      <FlashList
        ref={lista}
        data={posts}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          // Sem layout nem saída: a posição de cada célula é da FlashList.
          <ItemAnimado
            registro={entradas}
            id={item.id}
            tipoDeNovo="topo"
            comLayout={false}
            comSaida={false}
          >
            <PostDoFeed post={item} agora={agora} onCurtir={aoCurtir} />
          </ItemAnimado>
        )}
        extraData={agora}
        ItemSeparatorComponent={Separador}
        ListHeaderComponent={
          <View style={estilos.topoDaLista}>
            <Historias historias={historias} iniciaisJogador={mundo.data?.jogador.iniciais ?? ''} />
            {evento && evento.estado !== 'encerrado' && mundo.data && (
              <BannerEvento evento={evento} diaDoMundo={mundo.data.dia} />
            )}
          </View>
        }
        ListEmptyComponent={
          <EstadoTela
            tipo="vazio"
            frase="Seu mundo ainda está quieto. Que tal começar a conversa?"
            acao={{ rotulo: 'Escrever um post', onPress: () => router.push('/novo-post') }}
          />
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator
              color={cores.textoSuave}
              accessibilityLabel="Carregando mais posts"
              style={estilos.carregandoMais}
            />
          ) : null
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        // Posts novos entram em cima sem tirar o lugar de quem está lendo; no topo, aparecem.
        maintainVisibleContentPosition={{ autoscrollToTopThreshold: 40 }}
        refreshing={atualizando}
        onRefresh={() => void atualizar()}
        showsVerticalScrollIndicator={false}
        // A lista passa por baixo da barra de abas flutuante e vai até as bordas (sombras dos
        // cartões não são cortadas); a margem volta no conteúdo.
        // Sobe até a borda de cima (desfaz o padding da Tela): os posts rolam por baixo da pílula
        // flutuante e o primeiro só começa abaixo dela.
        style={{
          marginHorizontal: -medidas.margemLateral,
          marginBottom: -baseDaLista,
          marginTop: -topoDaPilula,
        }}
        onScroll={(e) => setRolou(e.nativeEvent.contentOffset.y > 4)}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: medidas.margemLateral,
          paddingTop: baseDaPilula + RESPIRO_SOB_A_PILULA,
          paddingBottom: baseDaLista + BOTAO_NOVO_POST,
        }}
      />
    );
  }

  return (
    <View style={estilos.raiz}>
      <Tela comAbas rolavel={false} gap={0}>
        {conteudo}
        {novos > 0 && (
          // O aviso aparece com mola e some encolhendo; a cada post novo o chip dá um pop.
          <Animated.View
            pointerEvents="box-none"
            entering={animacoes.pop()}
            exiting={animacoes.popSaida}
            style={[estilos.avisoNovos, { top: baseDaPilula + RESPIRO_SOB_A_PILULA }]}
          >
            <Pop gatilho={novos} escala={1.1}>
              <Chip
                rotulo={rotuloNovosPosts(novos)}
                variante="destaque"
                icone={ArrowUp}
                onPress={verNovos}
              />
            </Pop>
          </Animated.View>
        )}
      </Tela>
      {/* Gradiente do fundo do tema para transparente: a barra de status continua legível sobre os posts. */}
      <LinearGradient
        pointerEvents="none"
        // Opaco sob a barra de status (o relógio fica legível) e some até o meio da pílula.
        colors={[cores.fundo, cores.fundo, fundoTransparente(cores.fundo)]}
        locations={[0, insets.top / (baseDaPilula - ALTURA_PILULA / 2), 1]}
        style={[estilos.veuDoTopo, { height: baseDaPilula - ALTURA_PILULA / 2 }]}
      />
      {/* Pílula flutuante, como a barra de abas: sem faixa de fundo, o feed rola por trás. */}
      <View
        pointerEvents="box-none"
        style={[
          estilos.pilula,
          { top: topoDaPilula, left: medidas.margemLateral, right: medidas.margemLateral },
        ]}
      >
        <BarraDoMundo mundo={mundo.data} destacada={rolou} />
      </View>
      <Animated.View
        entering={animacoes.pop(400)}
        style={[estilos.botaoNovoPost, { bottom: baseDoBotao }]}
      >
        <Animated.View style={botao.estilo}>
          <Pressable
            onPress={() => router.push('/novo-post')}
            onPressIn={botao.aoPressionar}
            onPressOut={botao.aoSoltar}
            accessibilityRole="button"
            accessibilityLabel="Novo post"
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Esfera tom="escuro" tamanho={BOTAO_NOVO_POST}>
              <Icone icone={Plus} tamanho={25} cor={corSobreEsfera('escuro')} traco={2} />
            </Esfera>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function Separador() {
  return <View style={estilos.separador} />;
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  topoDaLista: { paddingBottom: 12 },
  separador: { height: 10 },
  carregandoMais: { paddingVertical: 16 },
  avisoNovos: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  veuDoTopo: { position: 'absolute', top: 0, left: 0, right: 0 },
  pilula: { position: 'absolute' },
  botaoNovoPost: { position: 'absolute', right: 20 },
});
