import type { Consequencia, Mensagem, Post, RespostaFeed, RespostaThread } from '@holofote/shared';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { chamadas, simularApi } from '../testes/api';
import { energia, post, uuid } from '../testes/dados';
import { useCartoes } from './cartoes';
import { ErroDaApi } from './cliente';
import {
  aposAcao,
  chaves,
  useConsequencia,
  useCurtir,
  useDesfazer,
  useEnergia,
  useEnviarMensagem,
  useResponderHistoria,
} from './consultas';

jest.mock('./cliente', () => require('../testes/api').moduloClienteSimulado());

const cliente = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: Infinity },
    mutations: { retry: false, gcTime: Infinity },
  },
});
const Provedor = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
);

const consequencia = (p: Partial<Consequencia> = {}): Consequencia => ({
  eventoId: uuid(),
  deltas: [],
  seguidoresGanhos: 0,
  curtidasSimuladas: 0,
  cartao: null,
  reacoesPendentes: 2,
  energia: energia(7),
  marcoLiberado: null,
  desfazivelAte: null,
  ...p,
});

/** Resposta de rota que só termina quando o teste manda (para ver o estado no meio do caminho). */
function resposta<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: unknown) => void;
  const promessa = new Promise<T>((ok, erro) => {
    resolver = ok;
    rejeitar = erro;
  });
  return { promessa, resolver, rejeitar };
}

beforeEach(() => {
  cliente.clear();
  useCartoes.setState({ porEvento: {} });
  jest.clearAllMocks();
});

describe('useCurtir', () => {
  const alvo = post({ id: uuid(), curtidas: 10, curtidoPorMim: false });
  const outro = post({ id: uuid(), curtidas: 5, curtidoPorMim: false });
  const feed = (): InfiniteData<RespostaFeed> => ({
    pageParams: [null],
    pages: [{ itens: [alvo, outro], proximoCursor: null, historias: [] }],
  });
  const thread = (): RespostaThread => ({ post: alvo, respostas: [outro], digitando: [] });

  const semear = () => {
    cliente.setQueryData(chaves.feed, feed());
    cliente.setQueryData(chaves.thread(alvo.id), thread());
    cliente.setQueryData(chaves.post(alvo.id), alvo);
  };
  const curtidasNoFeed = () =>
    cliente
      .getQueryData<InfiniteData<RespostaFeed>>(chaves.feed)!
      .pages[0]!.itens.map((p) => [p.curtidas, p.curtidoPorMim]);
  const curtidasNaThread = () => cliente.getQueryData<RespostaThread>(chaves.thread(alvo.id))!.post;
  const curtidasNoPost = () => cliente.getQueryData<Post>(chaves.post(alvo.id))!;

  it('muda o feed, a thread e o post na hora e grava o Post devolvido', async () => {
    semear();
    const rota = resposta<Post>();
    simularApi({ [`POST /posts/${alvo.id}/curtir`]: () => rota.promessa });
    const { result } = await renderHook(() => useCurtir(), { wrapper: Provedor });

    await act(async () => {
      result.current.mutate(alvo.id);
    });
    // Otimista nas três chaves; o outro post do feed não muda.
    expect(curtidasNoFeed()).toEqual([
      [11, true],
      [5, false],
    ]);
    expect(curtidasNaThread()).toMatchObject({ curtidas: 11, curtidoPorMim: true });
    expect(curtidasNoPost()).toMatchObject({ curtidas: 11, curtidoPorMim: true });

    // O servidor conta uma curtida de outra pessoa junto: vale o que ele devolve.
    await act(async () => rota.resolver({ ...alvo, curtidas: 12, curtidoPorMim: true }));
    expect(curtidasNoFeed()[0]).toEqual([12, true]);
    expect(curtidasNaThread()).toMatchObject({ curtidas: 12, curtidoPorMim: true });
    expect(curtidasNoPost()).toMatchObject({ curtidas: 12, curtidoPorMim: true });
  });

  it('em erro, desfaz nas três chaves e marca tudo para reler', async () => {
    semear();
    const rota = resposta<Post>();
    simularApi({ [`POST /posts/${alvo.id}/curtir`]: () => rota.promessa });
    const invalidar = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useCurtir(), { wrapper: Provedor });

    await act(async () => {
      result.current.mutate(alvo.id);
    });
    expect(curtidasNoFeed()[0]).toEqual([11, true]);

    await act(async () => rota.rejeitar(new ErroDaApi(500, 'interno', 'Falhou.')));
    expect(curtidasNoFeed()).toEqual([
      [10, false],
      [5, false],
    ]);
    expect(curtidasNaThread()).toMatchObject({ curtidas: 10, curtidoPorMim: false });
    expect(curtidasNoPost()).toMatchObject({ curtidas: 10, curtidoPorMim: false });
    const chavesRelidas = invalidar.mock.calls.map(([f]) => f?.queryKey);
    expect(chavesRelidas).toEqual(
      expect.arrayContaining([chaves.feed, ['thread'], chaves.post(alvo.id)]),
    );
  });

  it('descurtir alterna de volta e nunca deixa as curtidas negativas', async () => {
    const curtido = { ...alvo, curtidas: 0, curtidoPorMim: true };
    cliente.setQueryData(chaves.post(alvo.id), curtido);
    simularApi({ [`POST /posts/${alvo.id}/curtir`]: () => new Promise(() => {}) });
    const { result } = await renderHook(() => useCurtir(), { wrapper: Provedor });
    await act(async () => {
      result.current.mutate(alvo.id);
    });
    expect(curtidasNoPost()).toMatchObject({ curtidas: 0, curtidoPorMim: false });
  });
});

describe('aposAcao e o cartão da IA', () => {
  const cartao = { titulo: 'Indireta lida', texto: 'O mundo comentou.' };

  it('guarda a consequência, a energia e relê o que os números do motor movem', () => {
    const invalidar = jest.spyOn(cliente, 'invalidateQueries');
    const c = consequencia({ energia: energia(5) });
    aposAcao(cliente, c);
    expect(cliente.getQueryData(chaves.consequencia(c.eventoId))).toEqual(c);
    expect(cliente.getQueryData(chaves.energia)).toEqual(c.energia);
    const chavesRelidas = invalidar.mock.calls.map(([f]) => f?.queryKey);
    expect(chavesRelidas).toEqual(
      expect.arrayContaining([
        chaves.conta,
        chaves.registro,
        chaves.jornada,
        chaves.mundo,
        chaves.feed,
        chaves.relacoes,
        chaves.conversas,
        ['personagem'],
        ['mensagens'],
      ]),
    );
  });

  it('o cartão que chegou antes do POST não é sobrescrito pela resposta', () => {
    const c = consequencia();
    useCartoes.getState().guardar(c.eventoId, cartao);
    aposAcao(cliente, c);
    expect(cliente.getQueryData<Consequencia>(chaves.consequencia(c.eventoId))).toMatchObject({
      cartao,
      reacoesPendentes: 0,
    });
  });

  it('o cartão da própria resposta continua valendo', () => {
    const c = consequencia({ cartao: { titulo: 'Do servidor', texto: 'Já veio junto.' } });
    useCartoes.getState().guardar(c.eventoId, cartao);
    aposAcao(cliente, c);
    expect(cliente.getQueryData<Consequencia>(chaves.consequencia(c.eventoId))?.cartao).toEqual(
      c.cartao,
    );
  });

  it('useConsequencia junta o cartão recebido, mesmo antes do POST terminar', async () => {
    const c = consequencia();
    cliente.setQueryData(chaves.consequencia(c.eventoId), c);
    const { result } = await renderHook(() => useConsequencia(c.eventoId), { wrapper: Provedor });
    expect(result.current.data?.cartao).toBeNull();
    await act(async () => useCartoes.getState().guardar(c.eventoId, cartao));
    expect(result.current.data).toMatchObject({ cartao, reacoesPendentes: 0 });
  });

  it('o armazém lembra só os últimos 50 cartões', () => {
    for (let i = 0; i < 55; i++) useCartoes.getState().guardar(`evento-${i}`, cartao);
    const guardados = Object.keys(useCartoes.getState().porEvento);
    expect(guardados).toHaveLength(50);
    expect(guardados).not.toContain('evento-0');
    expect(guardados).toContain('evento-54');
  });
});

describe('mensagens', () => {
  const conversaId = uuid();
  const mensagem = (p: Partial<Mensagem> = {}): Mensagem => ({
    id: uuid(),
    conversaId,
    minha: true,
    texto: 'oi',
    criadoEm: '2026-10-16T12:00:00Z',
    ...p,
  });

  it('useEnviarMensagem não duplica a mensagem que o tempo real já trouxe', async () => {
    const m = mensagem();
    cliente.setQueryData(chaves.mensagens(conversaId), [m]);
    simularApi({
      [`POST /conversas/${conversaId}/mensagens`]: { mensagem: m, consequencia: consequencia() },
    });
    const { result } = await renderHook(() => useEnviarMensagem(conversaId), { wrapper: Provedor });
    await act(async () => {
      await result.current.mutateAsync('oi');
    });
    expect(cliente.getQueryData<Mensagem[]>(chaves.mensagens(conversaId))).toEqual([m]);
  });

  it('useEnviarMensagem acrescenta a mensagem nova ao fim da conversa', async () => {
    const antiga = mensagem({ minha: false, texto: 'e aí?' });
    const nova = mensagem({ texto: 'tudo bem' });
    cliente.setQueryData(chaves.mensagens(conversaId), [antiga]);
    simularApi({
      [`POST /conversas/${conversaId}/mensagens`]: { mensagem: nova, consequencia: consequencia() },
    });
    const { result } = await renderHook(() => useEnviarMensagem(conversaId), { wrapper: Provedor });
    await act(async () => {
      await result.current.mutateAsync('tudo bem');
    });
    expect(cliente.getQueryData<Mensagem[]>(chaves.mensagens(conversaId))).toEqual([antiga, nova]);
  });

  it('useResponderHistoria relê as mensagens da conversa que a resposta criou', async () => {
    const historiaId = uuid();
    const m = mensagem();
    simularApi({
      [`POST /historias/${historiaId}/resposta`]: { mensagem: m, consequencia: consequencia() },
    });
    const invalidar = jest.spyOn(cliente, 'invalidateQueries');
    const { result } = await renderHook(() => useResponderHistoria(historiaId), {
      wrapper: Provedor,
    });
    await act(async () => {
      await result.current.mutateAsync('eu topo');
    });
    const chavesRelidas = invalidar.mock.calls.map(([f]) => f?.queryKey);
    expect(chavesRelidas).toEqual(
      expect.arrayContaining([chaves.mensagens(conversaId), chaves.conversas]),
    );
  });
});

describe('useDesfazer', () => {
  it('desfazer_expirado relê o registro; outros erros não', async () => {
    const acao = uuid();
    const invalidar = jest.spyOn(cliente, 'invalidateQueries');
    simularApi({
      [`POST /acoes/${acao}/desfazer`]: new ErroDaApi(409, 'desfazer_expirado', 'Passou de 1 h.'),
    });
    const { result } = await renderHook(() => useDesfazer(), { wrapper: Provedor });
    await act(async () => {
      await result.current.mutateAsync(acao).catch(() => {});
    });
    expect(invalidar.mock.calls.map(([f]) => f?.queryKey)).toContainEqual(chaves.registro);

    invalidar.mockClear();
    simularApi({ [`POST /acoes/${acao}/desfazer`]: new ErroDaApi(500, 'interno', 'Falhou.') });
    await act(async () => {
      await result.current.mutateAsync(acao).catch(() => {});
    });
    expect(invalidar.mock.calls.map(([f]) => f?.queryKey)).not.toContainEqual(chaves.registro);
  });
});

describe('useEnergia', () => {
  afterEach(() => jest.useRealTimers());

  it('relê sozinha quando a próxima unidade da recarga chega, e para com a barra cheia', async () => {
    jest.useFakeTimers();
    const agora = Date.now();
    const chegando = { ...energia(7, 12), proximaEm: new Date(agora + 10_000).toISOString() };
    const cheia = { ...energia(12, 12), proximaEm: null };
    let leituras = 0;
    simularApi({ 'GET /energia': () => (++leituras === 1 ? chegando : cheia) });
    await renderHook(() => useEnergia(), { wrapper: Provedor });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(leituras).toBe(1);

    // Antes da hora (mais 1 s de folga) não pergunta; depois pergunta e vê a barra cheia.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_500);
    });
    expect(leituras).toBe(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });
    expect(leituras).toBe(2);
    expect(cliente.getQueryData(chaves.energia)).toEqual(cheia);

    // Barra cheia: sem proximaEm, nada mais agendado.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000);
    });
    expect(leituras).toBe(2);
    expect(chamadas.filter((c) => c.rota === '/energia')).toHaveLength(2);
  });

  it('com a recarga atrasada não pergunta mais de uma vez a cada 5 s', async () => {
    jest.useFakeTimers();
    const atrasada = { ...energia(7, 12), proximaEm: new Date(Date.now() - 60_000).toISOString() };
    let leituras = 0;
    simularApi({ 'GET /energia': () => (++leituras, atrasada) });
    await renderHook(() => useEnergia(), { wrapper: Provedor });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4_900);
    });
    expect(leituras).toBe(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });
    expect(leituras).toBe(2);
  });
});
