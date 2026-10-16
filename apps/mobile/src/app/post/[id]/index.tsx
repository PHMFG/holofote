import type { Post } from '@holofote/shared';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { tratarErroDeAcao } from '../../../acoes/erros';
import { ErroDaApi } from '../../../api/cliente';
import {
  useConsequencia,
  useCurtir,
  useDesfazer,
  useMundo,
  usePost,
  useRelacoes,
  useResponder,
  useThread,
} from '../../../api/consultas';
import { useDigitando } from '../../../api/tempoReal';
import { voltarOuInicio } from '../../../navegacao';
import { useAgora } from '../../../tempo';
import { CartaoConsequencia, CUSTO_DESFAZER } from '../../../telas/post/CartaoConsequencia';
import { PostPrincipal } from '../../../telas/post/PostPrincipal';
import { PreviaRespostas } from '../../../telas/post/PreviaRespostas';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Compositor } from '../../../ui/Compositor';
import { EstadoTela } from '../../../ui/EstadoTela';
import { Tela } from '../../../ui/Tela';

/**
 * 03 · Post e consequências (Figma 17:146 e 30:790). Com `?acao=<eventoId>` (vindo do
 * compositor), mostra o cartão de consequência daquela ação e o desfazer enquanto valer.
 */
export default function PostDetalhe() {
  const { id, acao } = useLocalSearchParams<{ id: string; acao?: string }>();
  const mundo = useMundo();
  const post = usePost(id);
  const thread = useThread(id);
  const consequencia = useConsequencia(acao);
  const relacoes = useRelacoes();
  const { mutate: curtir } = useCurtir();
  const desfazer = useDesfazer();
  const responder = useResponder(id);
  const digitandoAoVivo = useDigitando((s) => s.porAlvo[id]);
  const agora = useAgora(15_000);
  const [desfeito, setDesfeito] = useState(false);

  // Respostas entregues na hora marcada entram na prévia sozinhas: o evento "post" do tempo real
  // invalida a thread (api/tempoReal), sem um ouvinte a mais aqui.

  // A thread recebe a curtida otimista; o post avulso aparece primeiro depois de publicar.
  const atual = thread.data?.post ?? post.data;

  const nomePorId = useMemo(() => {
    const nomes = new Map<string, string>();
    relacoes.data?.nos.forEach((no) => nomes.set(no.personagem.id, no.personagem.nome));
    atual?.marcados.forEach((p) => nomes.set(p.id, p.nome));
    return nomes;
  }, [relacoes.data, atual?.marcados]);

  const digitando = useMemo(() => {
    const todos = [...(thread.data?.digitando ?? []), ...(digitandoAoVivo ?? [])];
    return todos.filter((p, i) => todos.findIndex((q) => q.id === p.id) === i);
  }, [thread.data?.digitando, digitandoAoVivo]);

  const aoCurtir = (alvo: Post) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    curtir(alvo.id, { onError: tratarErroDeAcao });
  };

  const c = consequencia.data;
  const podeDesfazer =
    !!acao && !desfeito && !!c?.desfazivelAte && Date.parse(c.desfazivelAte) > agora;

  const pedirDesfazer = () => {
    if (!acao) return;
    Alert.alert(
      'Desfazer este post?',
      `Custa ${CUSTO_DESFAZER} de energia. As reações que ainda não chegaram são canceladas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desfazer',
          style: 'destructive',
          onPress: () =>
            desfazer.mutate(acao, {
              onSuccess: () => {
                setDesfeito(true);
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                voltarOuInicio();
              },
              onError: (erro) => {
                if (erro instanceof ErroDaApi && erro.codigo === 'desfazer_expirado') {
                  setDesfeito(true);
                }
                tratarErroDeAcao(erro);
              },
            }),
        },
      ],
    );
  };

  const cabecalho = <Cabecalho titulo="Post" />;

  if (!atual) {
    const sumiu = post.error instanceof ErroDaApi && post.error.codigo === 'nao_encontrado';
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        {post.isError ? (
          <EstadoTela
            tipo="erro"
            frase={sumiu ? 'Este post não está mais aqui.' : 'Não deu para abrir o post.'}
            acao={
              sumiu
                ? { rotulo: 'Voltar', onPress: voltarOuInicio }
                : {
                    rotulo: 'Tentar de novo',
                    onPress: () => {
                      void post.refetch();
                      void thread.refetch();
                    },
                  }
            }
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Abrindo o post…" />
        )}
      </Tela>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={estilos.flex}>
      <Tela
        gap={12}
        cabecalho={cabecalho}
        rodape={
          <Compositor
            iniciais={mundo.data?.jogador.iniciais ?? ''}
            placeholder={`Responder como ${mundo.data?.jogador.nome.split(' ')[0] ?? 'você'}…`}
            custo={1}
            enviando={responder.isPending}
            onEnviar={(texto) =>
              responder.mutateAsync(texto).then(
                () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
                (erro: unknown) => {
                  tratarErroDeAcao(erro);
                  throw erro;
                },
              )
            }
          />
        }
      >
        <PostPrincipal post={atual} agora={agora} onCurtir={() => aoCurtir(atual)} />
        {c && (
          <CartaoConsequencia
            consequencia={c}
            desde={atual.criadoEm}
            agora={agora}
            nomePorId={nomePorId}
            podeDesfazer={podeDesfazer}
            onDesfazer={pedirDesfazer}
          />
        )}
        <PreviaRespostas
          postId={id}
          respostas={thread.data?.respostas}
          digitando={digitando}
          carregando={thread.isPending}
          erro={thread.isError}
          agora={agora}
          diaAtual={mundo.data?.dia}
          onCurtir={aoCurtir}
        />
      </Tela>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({ flex: { flex: 1 } });
