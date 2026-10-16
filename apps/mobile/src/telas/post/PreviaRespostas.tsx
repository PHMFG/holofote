import type { PersonagemResumo, Post } from '@holofote/shared';
import { router } from 'expo-router';
import { Fragment } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { primeiroNome } from '../../formatar';
import { tempoRelativo } from '../../tempo';
import { useTema } from '../../tema/ProvedorTema';
import { Cartao } from '../../ui/Cartao';
import { Comentario, Digitando, SeparadorComentario } from '../../ui/Comentario';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
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
 * "Ver todas". Respostas a respostas ficam só na tela de respostas.
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
  const abrirTodas = () => router.push(`/post/${postId}/respostas`);
  const primeiras = filtrarThread(montarArvore(postId, respostas ?? []), 'recentes')
    .slice(0, MAXIMO)
    .map((no) => no.resposta);

  let corpo;
  if (carregando) {
    corpo = (
      <ActivityIndicator color={cores.textoSuave} accessibilityLabel="Carregando respostas" />
    );
  } else if (erro) {
    corpo = (
      <Texto cor="textoSuave" style={estilos.centro}>
        Não deu para carregar as respostas.
      </Texto>
    );
  } else if (primeiras.length === 0 && digitando.length === 0) {
    corpo = (
      <Texto cor="textoSuave" style={estilos.centro}>
        Ainda sem respostas. Quem estiver online reage primeiro.
      </Texto>
    );
  } else {
    corpo = (
      <>
        {primeiras.map((r, i) => (
          <Fragment key={r.id}>
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
          </Fragment>
        ))}
        {digitando.map((p) => (
          <Digitando key={p.id} nome={primeiroNome(p.nome)} iniciais={p.iniciais} />
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
      <Cartao style={estilos.cartao}>{corpo}</Cartao>
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
});
