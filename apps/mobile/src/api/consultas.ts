// Hooks do TanStack Query, um por rota de docs/CONTRATOS.md. As chaves ficam em `chaves` para o
// tempo real (api/tempoReal.ts) atualizar o cache sem repetir strings.
import {
  Alerta,
  Conta,
  Conversa,
  EstadoEnergia,
  EventoAgendado,
  ItemRegistro,
  Jornada,
  Mensagem,
  Mundo,
  Personagem,
  Post,
  RespostaAcaoComPost,
  RespostaEventoComConsequencia,
  RespostaFeed,
  RespostaMensagem,
  RespostaPrevia,
  RespostaRecarga,
  RespostaRelacoes,
  RespostaThread,
  ResumoDia,
  Consequencia,
  type PedidoCriarMundo,
  type PedidoPost,
} from '@holofote/shared';
import { useCallback } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';
import { comCartaoRecebido, useCartoes } from './cartoes';
import { ErroDaApi, requisitar } from './cliente';

export const chaves = {
  conta: ['conta'] as const,
  mundo: ['mundo'] as const,
  feed: ['feed'] as const,
  post: (id: string) => ['post', id] as const,
  thread: (id: string) => ['thread', id] as const,
  conversas: ['conversas'] as const,
  mensagens: (conversaId: string) => ['mensagens', conversaId] as const,
  alertas: ['alertas'] as const,
  jornada: ['jornada'] as const,
  personagem: (id: string) => ['personagem', id] as const,
  relacoes: ['relacoes'] as const,
  registro: ['registro'] as const,
  evento: (id: string) => ['evento', id] as const,
  resumo: ['resumo'] as const,
  energia: ['energia'] as const,
  /** Consequência de uma ação do jogador; o cartão da IA chega depois pelo tempo real. */
  consequencia: (acaoId: string) => ['consequencia', acaoId] as const,
};

// ---------- Leituras ----------

export const useConta = () =>
  useQuery({ queryKey: chaves.conta, queryFn: () => requisitar('/conta', { schema: Conta }) });

export const useMundo = () =>
  useQuery({
    queryKey: chaves.mundo,
    queryFn: () => requisitar('/mundos/atual', { schema: Mundo }),
    retry: false,
  });

export const useFeed = (mundoId: string | undefined) =>
  useInfiniteQuery({
    queryKey: chaves.feed,
    enabled: !!mundoId,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      requisitar(
        `/mundos/${mundoId}/feed${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
        {
          schema: RespostaFeed,
        },
      ),
    getNextPageParam: (pagina) => pagina.proximoCursor,
  });

export const usePost = (id: string) =>
  useQuery({
    queryKey: chaves.post(id),
    queryFn: () => requisitar(`/posts/${id}`, { schema: Post }),
  });

export const useThread = (id: string) =>
  useQuery({
    queryKey: chaves.thread(id),
    queryFn: () => requisitar(`/posts/${id}/respostas`, { schema: RespostaThread }),
  });

export const useConversas = () =>
  useQuery({
    queryKey: chaves.conversas,
    queryFn: () => requisitar('/conversas', { schema: z.array(Conversa) }),
  });

export const useMensagens = (conversaId: string) =>
  useQuery({
    queryKey: chaves.mensagens(conversaId),
    queryFn: () => requisitar(`/conversas/${conversaId}/mensagens`, { schema: z.array(Mensagem) }),
  });

export const useAlertas = () =>
  useQuery({
    queryKey: chaves.alertas,
    queryFn: () => requisitar('/alertas', { schema: z.array(Alerta) }),
  });

export const useJornada = () =>
  useQuery({
    queryKey: chaves.jornada,
    queryFn: () => requisitar('/jornada', { schema: Jornada }),
  });

export const usePersonagem = (id: string) =>
  useQuery({
    queryKey: chaves.personagem(id),
    queryFn: () => requisitar(`/personagens/${id}`, { schema: Personagem }),
  });

export const useRelacoes = () =>
  useQuery({
    queryKey: chaves.relacoes,
    queryFn: () => requisitar('/relacoes', { schema: RespostaRelacoes }),
  });

export const useRegistro = () =>
  useQuery({
    queryKey: chaves.registro,
    queryFn: () => requisitar('/registro', { schema: z.array(ItemRegistro) }),
  });

export const useEvento = (id: string) =>
  useQuery({
    queryKey: chaves.evento(id),
    queryFn: () => requisitar(`/eventos/${id}`, { schema: EventoAgendado }),
  });

export const useResumoDia = (habilitado = true) =>
  useQuery({
    queryKey: chaves.resumo,
    enabled: habilitado,
    queryFn: () => requisitar('/resumo-do-dia', { schema: ResumoDia }),
    retry: false,
  });

/** Margem depois da hora da recarga, para o servidor já ter somado a unidade quando a tela pergunta. */
const FOLGA_RECARGA_MS = 1_000;
/** Nunca pergunta mais de uma vez a cada 5 s, mesmo com a recarga atrasada. */
const MIN_INTERVALO_ENERGIA_MS = 5_000;

/**
 * Energia atual. Com a barra incompleta, a consulta se refaz sozinha quando a próxima unidade da
 * recarga natural chega (`proximaEm`), sem depender de um evento do tempo real.
 */
export const useEnergia = () =>
  useQuery({
    queryKey: chaves.energia,
    queryFn: () => requisitar('/energia', { schema: EstadoEnergia }),
    refetchInterval: (consulta) => {
      const proximaEm = consulta.state.data?.proximaEm;
      if (!proximaEm) return false;
      return Math.max(
        MIN_INTERVALO_ENERGIA_MS,
        Date.parse(proximaEm) - Date.now() + FOLGA_RECARGA_MS,
      );
    },
  });

/**
 * Consequência guardada no cache pela ação que a gerou (publicar, responder, DM...), já com o
 * cartão da IA quando ele chegou pelo tempo real, mesmo antes da resposta do POST.
 */
export function useConsequencia(acaoId: string | undefined) {
  const cartao = useCartoes((s) => (acaoId ? s.porEvento[acaoId] : undefined));
  const select = useCallback(
    (c: z.infer<typeof Consequencia> | null) => (c ? comCartaoRecebido(c, cartao) : c),
    [cartao],
  );
  return useQuery({
    queryKey: chaves.consequencia(acaoId ?? ''),
    enabled: false,
    queryFn: () => null as z.infer<typeof Consequencia> | null,
    select,
  });
}

// ---------- Escritas ----------

/**
 * Depois de qualquer ação que gasta energia: guarda a consequência (com o cartão da IA, se ele
 * já chegou pelo tempo real) e atualiza energia e as listas que os números do motor movem.
 */
export function aposAcao(cliente: QueryClient, consequencia: z.infer<typeof Consequencia>) {
  const cartao = useCartoes.getState().porEvento[consequencia.eventoId];
  cliente.setQueryData(
    chaves.consequencia(consequencia.eventoId),
    comCartaoRecebido(consequencia, cartao),
  );
  cliente.setQueryData(chaves.energia, consequencia.energia);
  // Os números do motor mexem em relações, personagens e registro; as DMs e o feed ganham itens.
  for (const chave of [
    chaves.conta,
    chaves.registro,
    chaves.jornada,
    chaves.mundo,
    chaves.feed,
    chaves.relacoes,
    chaves.conversas,
    ['personagem'],
    ['mensagens'],
  ]) {
    void cliente.invalidateQueries({ queryKey: chave });
  }
}

/** Acrescenta a mensagem à conversa já carregada, sem duplicar (o WS e o POST podem trazer a mesma). */
export function adicionarMensagem(cliente: QueryClient, mensagem: z.infer<typeof Mensagem>) {
  cliente.setQueryData(
    chaves.mensagens(mensagem.conversaId),
    (lista: z.infer<typeof Mensagem>[] | undefined) =>
      lista && !lista.some((m) => m.id === mensagem.id) ? [...lista, mensagem] : lista,
  );
}

export function useCriarMundo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (pedido: PedidoCriarMundo) =>
      requisitar('/mundos', { metodo: 'POST', corpo: pedido, schema: Mundo }),
    onSuccess: (mundo) => {
      cliente.setQueryData(chaves.mundo, mundo);
      void cliente.invalidateQueries({ queryKey: chaves.conta });
    },
  });
}

export const usePrevia = () =>
  useMutation({
    mutationFn: (pedido: PedidoPost) =>
      requisitar('/posts/previa', { metodo: 'POST', corpo: pedido, schema: RespostaPrevia }),
  });

export function usePublicar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (pedido: PedidoPost) =>
      requisitar('/posts', { metodo: 'POST', corpo: pedido, schema: RespostaAcaoComPost }),
    onSuccess: ({ post, consequencia }) => {
      cliente.setQueryData(chaves.post(post.id), post);
      aposAcao(cliente, consequencia);
      void cliente.invalidateQueries({ queryKey: chaves.feed });
    },
  });
}

export function useResponder(postId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (texto: string) =>
      requisitar(`/posts/${postId}/respostas`, {
        metodo: 'POST',
        corpo: { texto },
        schema: RespostaAcaoComPost,
      }),
    onSuccess: ({ consequencia }) => {
      aposAcao(cliente, consequencia);
      void cliente.invalidateQueries({ queryKey: ['thread'] });
    },
    onError: (erro) => {
      // O prazo passou (ou a ação já foi desfeita): o registro relido não oferece mais o desfazer.
      if (erro instanceof ErroDaApi && erro.codigo === 'desfazer_expirado') {
        void cliente.invalidateQueries({ queryKey: chaves.registro });
      }
    },
  });
}

type PostDados = z.infer<typeof Post>;

/** Aplica `f` ao post em todos os caches que o guardam: feed, threads e a chave do próprio post. */
function mapearPost(cliente: QueryClient, postId: string, f: (p: PostDados) => PostDados) {
  const trocar = (p: PostDados) => (p.id === postId ? f(p) : p);
  cliente.setQueryData(
    chaves.feed,
    (feed: InfiniteData<z.infer<typeof RespostaFeed>> | undefined) =>
      feed
        ? { ...feed, pages: feed.pages.map((pg) => ({ ...pg, itens: pg.itens.map(trocar) })) }
        : feed,
  );
  cliente.setQueriesData(
    { queryKey: ['thread'] },
    (t: z.infer<typeof RespostaThread> | undefined) =>
      t ? { ...t, post: trocar(t.post), respostas: t.respostas.map(trocar) } : t,
  );
  cliente.setQueryData(chaves.post(postId), (p: PostDados | undefined) => (p ? f(p) : p));
}

const alternarCurtida = (p: PostDados): PostDados => ({
  ...p,
  curtidoPorMim: !p.curtidoPorMim,
  curtidas: Math.max(0, p.curtidas + (p.curtidoPorMim ? -1 : 1)),
});

const MUTACAO_CURTIR = ['curtir'] as const;

/**
 * Curtir é otimista: muda na hora no feed, nas threads e no post aberto, grava o Post que a API
 * devolve e desfaz tudo se ela falhar. Consultas em voo são canceladas antes para uma resposta
 * velha não passar por cima da curtida.
 */
export function useCurtir() {
  const cliente = useQueryClient();
  const outrasEmAndamento = () => cliente.isMutating({ mutationKey: MUTACAO_CURTIR }) > 1;
  return useMutation({
    mutationKey: MUTACAO_CURTIR,
    mutationFn: (postId: string) =>
      requisitar(`/posts/${postId}/curtir`, { metodo: 'POST', schema: Post }),
    onMutate: async (postId) => {
      await Promise.all([
        cliente.cancelQueries({ queryKey: chaves.feed }),
        cliente.cancelQueries({ queryKey: ['thread'] }),
        cliente.cancelQueries({ queryKey: chaves.post(postId) }),
      ]);
      const anterior = {
        feed: cliente.getQueryData(chaves.feed),
        threads: cliente.getQueriesData({ queryKey: ['thread'] }),
        post: cliente.getQueryData(chaves.post(postId)),
      };
      mapearPost(cliente, postId, alternarCurtida);
      return anterior;
    },
    onError: (_erro, postId, anterior) => {
      // Com outra curtida em andamento, voltar ao retrato antigo desfaria a dela também: só relê.
      if (anterior && !outrasEmAndamento()) {
        cliente.setQueryData(chaves.feed, anterior.feed);
        for (const [chave, dados] of anterior.threads) cliente.setQueryData(chave, dados);
        cliente.setQueryData(chaves.post(postId), anterior.post);
      }
      void cliente.invalidateQueries({ queryKey: chaves.feed });
      void cliente.invalidateQueries({ queryKey: ['thread'] });
      void cliente.invalidateQueries({ queryKey: chaves.post(postId) });
    },
    onSuccess: (post) => {
      if (outrasEmAndamento()) return;
      mapearPost(cliente, post.id, () => post);
      cliente.setQueryData(chaves.post(post.id), post);
    },
  });
}

export function useAbrirConversa() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (personagemId: string) =>
      requisitar(`/personagens/${personagemId}/conversa`, { metodo: 'POST', schema: Conversa }),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: chaves.conversas }),
  });
}

/**
 * Silenciar (ou deixar de silenciar) um personagem. Grava o Personagem que a API devolve e relê o
 * que muda de lugar: o feed (posts e histórias), as conversas (a lista esconde as silenciadas) e
 * as relações.
 */
export function useSilenciar(personagemId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (silenciado: boolean) =>
      requisitar(`/personagens/${personagemId}/silenciar`, {
        metodo: 'POST',
        corpo: { silenciado },
        schema: Personagem,
      }),
    onSuccess: (personagem) => {
      cliente.setQueryData(chaves.personagem(personagemId), personagem);
      for (const chave of [
        chaves.feed,
        chaves.personagem(personagemId),
        chaves.relacoes,
        chaves.conversas,
      ]) {
        void cliente.invalidateQueries({ queryKey: chave });
      }
    },
  });
}

export function useEnviarMensagem(conversaId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (texto: string) =>
      requisitar(`/conversas/${conversaId}/mensagens`, {
        metodo: 'POST',
        corpo: { texto },
        schema: RespostaMensagem,
      }),
    onSuccess: ({ mensagem, consequencia }) => {
      adicionarMensagem(cliente, mensagem);
      aposAcao(cliente, consequencia);
    },
  });
}

export function useVotar(historiaId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (opcao: string) =>
      requisitar(`/historias/${historiaId}/voto`, {
        metodo: 'POST',
        corpo: { opcao },
        schema: Post,
      }),
    onSuccess: (post) => cliente.setQueryData(chaves.post(post.id), post),
  });
}

export function useResponderHistoria(historiaId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (texto: string) =>
      requisitar(`/historias/${historiaId}/resposta`, {
        metodo: 'POST',
        corpo: { texto },
        schema: RespostaMensagem,
      }),
    onSuccess: ({ mensagem, consequencia }) => {
      // A resposta à história vira DM: a conversa (se já estava carregada) e a lista se atualizam.
      adicionarMensagem(cliente, mensagem);
      void cliente.invalidateQueries({ queryKey: chaves.mensagens(mensagem.conversaId) });
      aposAcao(cliente, consequencia);
    },
  });
}

export function useDesfazer() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (acaoId: string) =>
      requisitar(`/acoes/${acaoId}/desfazer`, { metodo: 'POST', schema: Consequencia }),
    onSuccess: (consequencia) => {
      aposAcao(cliente, consequencia);
      void cliente.invalidateQueries({ queryKey: ['thread'] });
    },
    onError: (erro) => {
      // O prazo passou (ou a ação já foi desfeita): o registro relido não oferece mais o desfazer.
      if (erro instanceof ErroDaApi && erro.codigo === 'desfazer_expirado') {
        void cliente.invalidateQueries({ queryKey: chaves.registro });
      }
    },
  });
}

export function useResgatarMarco() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (marcoId: string) =>
      requisitar(`/marcos/${marcoId}/resgatar`, { metodo: 'POST', schema: Conta }),
    onSuccess: (conta) => {
      cliente.setQueryData(chaves.conta, conta);
      cliente.setQueryData(chaves.energia, conta.energia);
      void cliente.invalidateQueries({ queryKey: chaves.jornada });
      // Marco novo pode trazer personagem novo: o mapa de relações muda.
      void cliente.invalidateQueries({ queryKey: chaves.relacoes });
    },
    onError: (erro) => {
      // Já resgatado em outro toque ou aparelho: relê a jornada e a conta, que mostram o resgate.
      if (erro instanceof ErroDaApi && erro.codigo === 'marco_resgatado') {
        void cliente.invalidateQueries({ queryKey: chaves.jornada });
        void cliente.invalidateQueries({ queryKey: chaves.conta });
      }
    },
  });
}

export function useCampanha(eventoId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (acaoId: string) =>
      requisitar(`/eventos/${eventoId}/campanha`, {
        metodo: 'POST',
        corpo: { acaoId },
        schema: RespostaEventoComConsequencia,
      }),
    onSuccess: ({ evento, consequencia }) => {
      cliente.setQueryData(chaves.evento(eventoId), evento);
      aposAcao(cliente, consequencia);
    },
  });
}

export function useDiscurso(eventoId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (opcao: 'seguro' | 'ousado' | 'especial') =>
      requisitar(`/eventos/${eventoId}/discurso`, {
        metodo: 'POST',
        corpo: { opcao },
        schema: RespostaEventoComConsequencia,
      }),
    onSuccess: ({ evento, consequencia }) => {
      cliente.setQueryData(chaves.evento(eventoId), evento);
      aposAcao(cliente, consequencia);
    },
  });
}

export function useRecarga() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (via: 'gemas' | 'anuncio' | 'debug') =>
      requisitar('/energia/recarga', { metodo: 'POST', corpo: { via }, schema: RespostaRecarga }),
    onSuccess: ({ energia }) => {
      cliente.setQueryData(chaves.energia, energia);
      void cliente.invalidateQueries({ queryKey: chaves.conta });
    },
  });
}

export function usePlus() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (ativo: boolean) =>
      requisitar('/conta/plus', { metodo: 'POST', corpo: { ativo }, schema: Conta }),
    onSuccess: (conta) => {
      cliente.setQueryData(chaves.conta, conta);
      cliente.setQueryData(chaves.energia, conta.energia);
    },
  });
}

export function useSalvarAparencia() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (aparencia: { tema: 'sistema' | 'claro' | 'escuro'; destaque: string }) =>
      requisitar('/conta/aparencia', { metodo: 'PATCH', corpo: aparencia, schema: Conta }),
    onSuccess: (conta) => cliente.setQueryData(chaves.conta, conta),
  });
}

export function useMarcarAlertasLidos() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () => requisitar('/alertas/lidos', { metodo: 'POST' }),
    onSuccess: () => void cliente.invalidateQueries({ queryKey: chaves.alertas }),
  });
}
