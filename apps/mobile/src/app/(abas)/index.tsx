import type { Post } from '@holofote/shared';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ArrowUp, Plus } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
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
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { ESPACO_BARRA_DE_ABAS, Tela } from '../../ui/Tela';

// Medidas da barra de abas flutuante ((abas)/_layout.tsx): pílula de 64, presa a
// max(inset - 8, 8) da base. O botão de novo post fica 16 acima dela, como no Figma (16:224).
const ALTURA_BARRA = 64;
const BOTAO_NOVO_POST = 56;

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

  useTempoReal((evento) => {
    if (ehPostNovoDoFeed(evento)) setNovos((n) => n + 1);
  });

  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.itens) ?? [], [feed.data]);
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
        renderItem={({ item }) => <PostDoFeed post={item} agora={agora} onCurtir={aoCurtir} />}
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
        style={{ marginHorizontal: -medidas.margemLateral, marginBottom: -baseDaLista }}
        contentContainerStyle={{
          paddingHorizontal: medidas.margemLateral,
          paddingBottom: baseDaLista + BOTAO_NOVO_POST,
        }}
      />
    );
  }

  return (
    <View style={estilos.raiz}>
      <Tela comAbas rolavel={false} gap={0} cabecalho={<BarraDoMundo mundo={mundo.data} />}>
        {conteudo}
        {novos > 0 && (
          <View pointerEvents="box-none" style={estilos.avisoNovos}>
            <Chip
              rotulo={rotuloNovosPosts(novos)}
              variante="destaque"
              icone={ArrowUp}
              onPress={verNovos}
            />
          </View>
        )}
      </Tela>
      <Pressable
        onPress={() => router.push('/novo-post')}
        accessibilityRole="button"
        accessibilityLabel="Novo post"
        style={({ pressed }) => [
          estilos.botaoNovoPost,
          { bottom: baseDoBotao, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Esfera tom="escuro" tamanho={BOTAO_NOVO_POST}>
          <Icone icone={Plus} tamanho={25} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
      </Pressable>
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
  avisoNovos: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' },
  botaoNovoPost: { position: 'absolute', right: 20 },
});
