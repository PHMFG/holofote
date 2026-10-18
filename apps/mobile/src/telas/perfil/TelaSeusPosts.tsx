import type { Post } from '@holofote/shared';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { useCurtir, useFeedDoAutor, useMundo } from '../../api/consultas';
import { useTema } from '../../tema/ProvedorTema';
import { useAgora } from '../../tempo';
import { Cabecalho } from '../../ui/Cabecalho';
import { EstadoTela } from '../../ui/EstadoTela';
import { ComEspacosDaTela, Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { TrocaSuave } from '../animacao/TrocaSuave';
import { ItemAnimado, useRegistroDeEntradas } from '../animacao/entradas';
import { PostDoFeed } from '../feed/PostDoFeed';

/** Quantos posts da primeira carga entram em cascata: os que cabem na tela. */
const POSTS_EM_CASCATA = 5;

/** Seus posts: tudo o que o jogador publicou no mundo, mais novos primeiro, com rolagem infinita. */
export function TelaSeusPosts() {
  const { cores, medidas } = useTema();
  const mundo = useMundo();
  const feed = useFeedDoAutor(mundo.data?.id, mundo.data?.jogador.id);
  const { mutate: curtir } = useCurtir();
  const agora = useAgora();

  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.itens) ?? [], [feed.data]);
  const ids = useMemo(() => posts.map((p) => p.id), [posts]);
  const entradas = useRegistroDeEntradas(ids, { novos: 'topo', cascataInicial: POSTS_EM_CASCATA });

  const aoCurtir = useCallback(
    (post: Post) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      curtir(post.id, { onError: tratarErroDeAcao });
    },
    [curtir],
  );

  const total = feed.data && !feed.hasNextPage ? posts.length : undefined;
  const cabecalho = (
    <Cabecalho
      titulo="Seus posts"
      direita={
        total !== undefined && (
          <TrocaSuave chave={total}>
            <Texto
              estilo="legenda"
              cor="textoSuave"
              accessibilityLabel={`${total} ${total === 1 ? 'post' : 'posts'}`}
            >
              {total}
            </Texto>
          </TrocaSuave>
        )
      }
    />
  );

  if (feed.isPending || (feed.isError && !feed.data)) {
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        {feed.isError ? (
          <EstadoTela
            tipo="erro"
            frase="Não deu para carregar seus posts."
            acao={{ rotulo: 'Tentar de novo', onPress: () => void feed.refetch() }}
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Carregando seus posts…" />
        )}
      </Tela>
    );
  }

  return (
    <Tela cabecalho={cabecalho} rolagemPropria>
      <ComEspacosDaTela>
        {(espacos) => (
          <FlashList
            data={posts}
            keyExtractor={(post) => post.id}
            renderItem={({ item }) => (
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
            ListEmptyComponent={
              <EstadoTela
                tipo="vazio"
                frase="Você ainda não postou nada neste mundo."
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
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => void feed.refetch()}
            showsVerticalScrollIndicator={false}
            scrollIndicatorInsets={{ top: espacos.topo, bottom: espacos.base }}
            contentContainerStyle={{
              paddingHorizontal: medidas.margemLateral,
              paddingTop: espacos.topo,
              paddingBottom: espacos.base,
            }}
          />
        )}
      </ComEspacosDaTela>
    </Tela>
  );
}

function Separador() {
  return <View style={estilos.separador} />;
}

const estilos = StyleSheet.create({
  separador: { height: 10 },
  carregandoMais: { paddingVertical: 16 },
});
