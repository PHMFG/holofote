import type { PersonagemResumo, Post } from '@holofote/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { useCurtir, useMundo, useResponder, useThread } from '../../api/consultas';
import { useDigitando } from '../../api/tempoReal';
import { primeiroNome } from '../../formatar';
import { horaCurta, tempoRelativo, useAgora } from '../../tempo';
import { Avatar } from '../../ui/Avatar';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Comentario, Digitando, SeparadorComentario, VerMaisRespostas } from '../../ui/Comentario';
import { Compositor } from '../../ui/Compositor';
import { EstadoTela } from '../../ui/EstadoTela';
import { Segmentado } from '../../ui/Segmentado';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { TecladoEvitavel } from '../dm/TecladoEvitavel';
import { filtrarThread, montarArvore, type FiltroThread, type NoThread } from './arvore';

const FILTROS = [
  { valor: 'relevantes', rotulo: 'Relevantes' },
  { valor: 'recentes', rotulo: 'Recentes' },
  { valor: 'elenco', rotulo: 'Elenco' },
] as const;

/** Tela do personagem; o jogador vai para a própria aba de perfil. */
const rotaDoPerfil = (autor: PersonagemResumo) =>
  autor.papel === 'jogador' ? '/perfil' : `/personagem/${autor.id}`;

interface Alvo {
  id: string;
  handle: string;
}

/** 13 · Respostas: a conversa embaixo de um post, com respostas que chegam aos poucos. */
export function TelaRespostas({ postId }: { postId: string }) {
  const thread = useThread(postId);
  const mundo = useMundo();
  const [filtro, setFiltro] = useState<FiltroThread>('relevantes');
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set());
  const responder = useResponder(alvo?.id ?? postId);
  const curtir = useCurtir();
  const digitandoPorAlvo = useDigitando((s) => s.porAlvo);
  const agora = useAgora(60_000);

  const respostas = thread.data?.respostas;
  const digitandoDoServidor = thread.data?.digitando;
  const idsDaThread = useMemo(
    () => new Set([postId, ...(respostas ?? []).map((r) => r.id)]),
    [postId, respostas],
  );
  const arvore = useMemo(() => montarArvore(postId, respostas ?? []), [postId, respostas]);
  const visiveis = useMemo(() => filtrarThread(arvore, filtro), [arvore, filtro]);

  // Quem está escrevendo no post ou numa resposta dele; o aviso do servidor some sozinho.
  const digitando = useMemo(() => {
    const porId = new Map<string, PersonagemResumo>();
    for (const p of digitandoDoServidor ?? []) porId.set(p.id, p);
    for (const id of idsDaThread) for (const p of digitandoPorAlvo[id] ?? []) porId.set(p.id, p);
    return [...porId.values()];
  }, [digitandoDoServidor, idsDaThread, digitandoPorAlvo]);

  // Respostas da IA chegam na hora marcada (entregarEm): o evento "post" do tempo real invalida a
  // thread (api/tempoReal) e a lista se atualiza sozinha, sem aviso de "novas respostas".

  const enviar = (texto: string) =>
    responder.mutateAsync(texto).then(
      () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAlvo(null);
      },
      (erro: unknown) => {
        tratarErroDeAcao(erro);
        throw erro;
      },
    );

  const jogador = mundo.data?.jogador;
  const diaAtual = mundo.data?.dia;
  const total = respostas?.length;

  const cabecalho = (
    <Cabecalho
      titulo="Respostas"
      direita={
        total !== undefined && (
          <Texto
            estilo="legenda"
            cor="textoSuave"
            accessibilityLabel={`${total} ${total === 1 ? 'resposta' : 'respostas'}`}
          >
            {total}
          </Texto>
        )
      }
    />
  );

  if (!thread.data) {
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        {thread.isError ? (
          <EstadoTela
            tipo="erro"
            frase="Não deu para abrir as respostas."
            acao={{ rotulo: 'Tentar de novo', onPress: () => void thread.refetch() }}
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Carregando respostas…" />
        )}
      </Tela>
    );
  }

  const { post } = thread.data;

  return (
    <TecladoEvitavel>
      <Tela
        cabecalho={cabecalho}
        gap={12}
        rodape={
          <Compositor
            iniciais={jogador?.iniciais ?? ''}
            placeholder={`Responder como ${jogador ? primeiroNome(jogador.nome) : 'você'}…`}
            custo={1}
            enviando={responder.isPending}
            onEnviar={enviar}
            contexto={
              alvo
                ? { texto: `Respondendo a ${alvo.handle}`, onCancelar: () => setAlvo(null) }
                : undefined
            }
          />
        }
      >
        <PostOriginal post={post} tempo={horaCurta(post.criadoEm, agora, diaAtual)} />
        <Segmentado
          opcoes={FILTROS}
          valor={filtro}
          onMudar={setFiltro}
          rotulo="Ordenar respostas"
        />
        <Cartao style={estilos.conversa}>
          {visiveis.length === 0 && (
            <Texto cor="textoSuave" style={estilos.vazio}>
              {filtro === 'elenco'
                ? 'Ninguém do elenco respondeu ainda.'
                : 'Ninguém respondeu ainda. As respostas chegam aos poucos.'}
            </Texto>
          )}
          {visiveis.map((no, i) => (
            <Fragment key={no.resposta.id}>
              {i > 0 && <SeparadorComentario />}
              <BlocoDeResposta
                no={no}
                aberto={abertos.has(no.resposta.id)}
                diaAtual={diaAtual}
                agora={agora}
                onAbrir={() => setAbertos((atual) => new Set(atual).add(no.resposta.id))}
                onCurtir={(id) => curtir.mutate(id, { onError: tratarErroDeAcao })}
                onResponder={(r) => setAlvo({ id: r.id, handle: r.autor.handle })}
              />
            </Fragment>
          ))}
          {digitando.map((p, i) => (
            <Fragment key={p.id}>
              {(visiveis.length > 0 || i > 0) && <SeparadorComentario />}
              <Digitando nome={p.nome} iniciais={p.iniciais} />
            </Fragment>
          ))}
        </Cartao>
      </Tela>
    </TecladoEvitavel>
  );
}

function PostOriginal({ post, tempo }: { post: Post; tempo: string }) {
  return (
    <Cartao
      variante="afundado"
      style={estilos.original}
      accessible
      accessibilityLabel={`Post de ${post.autor.nome}, ${tempo}: ${post.texto}`}
    >
      <Avatar
        iniciais={post.autor.iniciais}
        tom={post.autor.tomAvatar}
        tamanho={32}
        nome={post.autor.nome}
      />
      <View style={estilos.originalTexto}>
        <Texto estilo="legenda" cor="textoSuave">
          {post.autor.nome} · {tempo}
        </Texto>
        <Texto>{post.texto}</Texto>
      </View>
    </Cartao>
  );
}

interface BlocoProps {
  no: NoThread;
  aberto: boolean;
  diaAtual: number | undefined;
  agora: number;
  onAbrir: () => void;
  onCurtir: (id: string) => void;
  onResponder: (resposta: Post) => void;
}

/** Comentário de primeiro nível, a primeira resposta a ele e "Ver mais N respostas". */
function BlocoDeResposta({
  no,
  aberto,
  diaAtual,
  agora,
  onAbrir,
  onCurtir,
  onResponder,
}: BlocoProps) {
  const filhas = aberto ? no.filhas : no.filhas.slice(0, 1);
  const escondidas = no.filhas.length - filhas.length;
  return (
    <>
      <ComentarioDaThread
        post={no.resposta}
        diaAtual={diaAtual}
        agora={agora}
        onCurtir={onCurtir}
        onResponder={() => onResponder(no.resposta)}
      />
      {filhas.length > 0 && (
        <View style={estilos.aninhados}>
          {filhas.map((filha) => (
            <ComentarioDaThread
              key={filha.id}
              post={filha}
              aninhado
              diaAtual={diaAtual}
              agora={agora}
              onCurtir={onCurtir}
            />
          ))}
          {escondidas > 0 && <VerMaisRespostas quantidade={escondidas} onPress={onAbrir} />}
        </View>
      )}
    </>
  );
}

interface ComentarioDaThreadProps {
  post: Post;
  aninhado?: boolean;
  diaAtual: number | undefined;
  agora: number;
  onCurtir: (id: string) => void;
  onResponder?: () => void;
}

/**
 * Comentario com o avatar tocável para abrir o perfil do autor. O componente não tem ação no
 * autor, então um botão transparente fica por cima do avatar (mesma posição e tamanho).
 */
function ComentarioDaThread({
  post,
  aninhado,
  diaAtual,
  agora,
  onCurtir,
  onResponder,
}: ComentarioDaThreadProps) {
  const { autor } = post;
  const tamanho = aninhado ? 28 : 36;
  return (
    <View>
      <Comentario
        nome={autor.nome}
        iniciais={autor.iniciais}
        tomAvatar={autor.tomAvatar}
        verificado={autor.verificado}
        tempo={tempoRelativo(post.criadoEm, agora, diaAtual)}
        texto={post.texto}
        curtidas={post.curtidas}
        respostas={post.respostas > 0 ? post.respostas : undefined}
        reposts={post.reposts > 0 ? post.reposts : undefined}
        curtido={post.curtidoPorMim}
        aninhado={aninhado}
        onCurtir={() => onCurtir(post.id)}
        onResponder={onResponder}
      />
      <Pressable
        onPress={() => router.push(rotaDoPerfil(autor))}
        accessibilityRole="button"
        accessibilityLabel={`Ver perfil de ${autor.nome}`}
        hitSlop={4}
        style={[
          estilos.autor,
          { left: aninhado ? 46 : 0, width: tamanho, height: tamanho, borderRadius: tamanho / 2 },
        ]}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  original: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  originalTexto: { flex: 1, gap: 2 },
  conversa: { padding: 14, gap: 12 },
  aninhados: { gap: 8 },
  vazio: { textAlign: 'center', paddingVertical: 8 },
  autor: { position: 'absolute', top: 0 },
});
