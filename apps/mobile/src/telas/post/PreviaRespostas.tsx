import type { PersonagemResumo, Post } from '@holofote/shared';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { primeiroNome } from '../../formatar';
import { tempoRelativo } from '../../tempo';
import { useTema } from '../../tema/ProvedorTema';
import { Comentario, SeparadorComentario } from '../../ui/Comentario';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { useAnimacoes } from '../animacao/animacoes';
import { CartaoAnimado } from '../animacao/Animados';
import { ItemAnimado, useRegistroDeEntradas } from '../animacao/entradas';
import { LinhaDigitando } from '../animacao/LinhaDigitando';
import { filtrarThread, montarArvore } from '../respostas/arvore';

const MAXIMO = 3;

export interface PreviaRespostasProps {
  postId: string;
  respostas: Post[] | undefined;
  digitando: PersonagemResumo[];
  carregando: boolean;
  erro: boolean;
  agora: number;
  /** Dia atual do mundo, para "Dia 5" nas respostas com mais de um dia. */
  diaAtual?: number;
  onCurtir: (resposta: Post) => void;
}

/**
 * As 3 respostas diretas mais recentes ao post (Comentario, como em 13 · Respostas) e o atalho
 * "Ver todas". Respostas a respostas ficam só na tela de respostas. A primeira carga entra em
 * cascata, a resposta que chega depois entra deslizando e quem está digitando aparece com os
 * pontinhos em onda; o cartão acomoda a altura.
 */
export function PreviaRespostas({
  postId,
  respostas,
  digitando,
  carregando,
  erro,
  agora,
  diaAtual,
  onCurtir,
}: PreviaRespostasProps) {
  const { cores } = useTema();
  const animacoes = useAnimacoes();
  const abrirTodas = () => router.push(`/post/${postId}/respostas`);
  const primeiras = filtrarThread(montarArvore(postId, respostas ?? []), 'recentes')
    .slice(0, MAXIMO)
    .map((no) => no.resposta);
  const entradas = useRegistroDeEntradas(
    primeiras.map((r) => r.id),
    { novos: 'qualquer', cascataInicial: MAXIMO },
  );

  let corpo;
  if (carregando) {
    corpo = (
      <ActivityIndicator color={cores.textoSuave} accessibilityLabel="Carregando respostas" />
    );
  } else if (erro) {
    corpo = (
      <Animated.View entering={animacoes.fade()}>
        <Texto cor="textoSuave" style={estilos.centro}>
          Não deu para carregar as respostas.
        </Texto>
      </Animated.View>
    );
  } else if (primeiras.length === 0 && digitando.length === 0) {
    corpo = (
      <Animated.View entering={animacoes.fade()} exiting={animacoes.saida}>
        <Texto cor="textoSuave" style={estilos.centro}>
          Ainda sem respostas. Quem estiver online reage primeiro.
        </Texto>
      </Animated.View>
    );
  } else {
    corpo = (
      <>
        {primeiras.map((r, i) => (
          <ItemAnimado key={r.id} registro={entradas} id={r.id} style={estilos.item} fadePadrao>
            {i > 0 && <SeparadorComentario />}
            <Comentario
              nome={r.autor.nome}
              iniciais={r.autor.iniciais}
              tomAvatar={r.autor.tomAvatar}
              verificado={r.autor.verificado}
              tempo={tempoRelativo(r.criadoEm, agora, diaAtual)}
              texto={r.texto}
              curtidas={r.curtidas}
              respostas={r.respostas}
              reposts={r.reposts}
              curtido={r.curtidoPorMim}
              onCurtir={() => onCurtir(r)}
              onResponder={abrirTodas}
            />
          </ItemAnimado>
        ))}
        {digitando.map((p) => (
          <LinhaDigitando key={p.id} nome={primeiroNome(p.nome)} iniciais={p.iniciais} />
        ))}
      </>
    );
  }

  return (
    <View style={estilos.secao}>
      <View style={estilos.titulo}>
        <Texto estilo="secao" accessibilityRole="header">
          Respostas
        </Texto>
        <Tocavel onPress={abrirTodas} accessibilityRole="button" hitSlop={10}>
          <Texto estilo="legenda" cor="destaqueTinta">
            Ver todas
          </Texto>
        </Tocavel>
      </View>
      <CartaoAnimado layout={animacoes.layout} style={estilos.cartao}>
        {corpo}
      </CartaoAnimado>
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: 12 },
  titulo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  cartao: { gap: 12, padding: 14 },
  centro: { textAlign: 'center' },
  item: { gap: 12 },
});
