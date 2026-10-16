import type { Alerta, Consequencia, EventoTempoReal, Mensagem, Mundo } from '@holofote/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import { energia, mundo, personagem, post, uuid } from '../testes/dados';
import { useCartoes } from './cartoes';
import { garantirToken } from './cliente';
import { chaves } from './consultas';
import { ProvedorTempoReal, aplicarNoCache, useDigitando, useTempoReal } from './tempoReal';

jest.mock('./cliente', () => require('../testes/api').moduloClienteSimulado());

const cartao = { titulo: 'Indireta lida', texto: 'O mundo comentou.' };
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

let cliente: QueryClient;
let invalidar: jest.SpyInstance;
const chavesRelidas = () => invalidar.mock.calls.map(([f]) => f?.queryKey);

beforeEach(() => {
  jest.clearAllMocks();
  cliente = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  invalidar = jest.spyOn(cliente, 'invalidateQueries');
  useCartoes.setState({ porEvento: {} });
  useDigitando.setState({ porAlvo: {} });
});

describe('aplicarNoCache', () => {
  it('post de resposta relê thread, post, feed, relações, conversas e o personagem', () => {
    const original = uuid();
    const vic = personagem();
    aplicarNoCache(cliente, { tipo: 'post', post: post({ respondeA: original, autor: vic }) });
    expect(chavesRelidas()).toEqual(
      expect.arrayContaining([
        chaves.post(original),
        ['thread'],
        chaves.feed,
        chaves.relacoes,
        chaves.conversas,
        chaves.personagem(vic.id),
      ]),
    );
  });

  it('post de resposta apaga o "digitando" de quem respondeu', () => {
    const original = uuid();
    const vic = personagem();
    useDigitando.getState().marcar(original, vic);
    aplicarNoCache(cliente, { tipo: 'post', post: post({ respondeA: original, autor: vic }) });
    expect(useDigitando.getState().porAlvo[original]).toEqual([]);
  });

  it('post de primeiro nível não relê nada; história nova relê o feed', () => {
    aplicarNoCache(cliente, { tipo: 'post', post: post() });
    expect(invalidar).not.toHaveBeenCalled();
    aplicarNoCache(cliente, { tipo: 'post', post: post({ tipo: 'historia' }) });
    expect(chavesRelidas()).toEqual([chaves.feed]);
  });

  describe('cartao', () => {
    it('guarda o cartão e junta à consequência que já está no cache', () => {
      const c = consequencia();
      cliente.setQueryData(chaves.consequencia(c.eventoId), c);
      aplicarNoCache(cliente, { tipo: 'cartao', eventoId: c.eventoId, cartao });
      expect(cliente.getQueryData(chaves.consequencia(c.eventoId))).toMatchObject({
        cartao,
        reacoesPendentes: 0,
      });
      expect(useCartoes.getState().porEvento[c.eventoId]).toEqual(cartao);
      expect(chavesRelidas()).toEqual(
        expect.arrayContaining([chaves.registro, chaves.relacoes, ['personagem']]),
      );
    });

    it('cartão que chega antes do POST fica guardado e não cria consequência pela metade', () => {
      const eventoId = uuid();
      aplicarNoCache(cliente, { tipo: 'cartao', eventoId, cartao });
      expect(cliente.getQueryData(chaves.consequencia(eventoId))).toBeUndefined();
      expect(useCartoes.getState().porEvento[eventoId]).toEqual(cartao);
    });
  });

  it('mensagem entra na conversa carregada sem duplicar e limpa o "digitando"', () => {
    const vic = personagem();
    const conversaId = uuid();
    const mensagem: Mensagem = {
      id: uuid(),
      conversaId,
      minha: false,
      texto: 'oi',
      criadoEm: '2026-10-16T12:00:00Z',
    };
    cliente.setQueryData(chaves.mensagens(conversaId), []);
    useDigitando.getState().marcar(conversaId, vic);
    aplicarNoCache(cliente, { tipo: 'mensagem', mensagem });
    aplicarNoCache(cliente, { tipo: 'mensagem', mensagem });
    expect(cliente.getQueryData(chaves.mensagens(conversaId))).toEqual([mensagem]);
    expect(useDigitando.getState().porAlvo[conversaId]).toEqual([]);
    expect(chavesRelidas()).toContainEqual(chaves.conversas);
  });

  it('mensagem de conversa não carregada não cria lista pela metade', () => {
    const conversaId = uuid();
    aplicarNoCache(cliente, {
      tipo: 'mensagem',
      mensagem: {
        id: uuid(),
        conversaId,
        minha: false,
        texto: 'oi',
        criadoEm: '2026-10-16T12:00:00Z',
      },
    });
    expect(cliente.getQueryData(chaves.mensagens(conversaId))).toBeUndefined();
  });

  it('mundo grava no cache e só relê o feed quando fica pronto', () => {
    const criando: Mundo = mundo({ estado: 'criando' });
    aplicarNoCache(cliente, { tipo: 'mundo', mundo: criando });
    expect(cliente.getQueryData(chaves.mundo)).toEqual(criando);
    expect(invalidar).not.toHaveBeenCalled();
    const pronto = { ...criando, estado: 'pronto' as const };
    aplicarNoCache(cliente, { tipo: 'mundo', mundo: pronto });
    expect(cliente.getQueryData(chaves.mundo)).toEqual(pronto);
    expect(chavesRelidas()).toEqual([chaves.feed]);
  });

  it('energia grava no cache e relê a conta', () => {
    const e = energia(3);
    aplicarNoCache(cliente, { tipo: 'energia', energia: e });
    expect(cliente.getQueryData(chaves.energia)).toEqual(e);
    expect(chavesRelidas()).toEqual([chaves.conta]);
  });

  describe('alerta', () => {
    const alerta = (tipo: Alerta['tipo']): EventoTempoReal => ({
      tipo: 'alerta',
      alerta: {
        id: uuid(),
        tipo,
        texto: 'x',
        criadoEm: '2026-10-16T12:00:00Z',
        lido: false,
        personagem: null,
        destino: { rota: '/' },
      },
    });

    it('resumo relê o mundo (dia e período) e o resumo', () => {
      aplicarNoCache(cliente, alerta('resumo'));
      expect(chavesRelidas()).toEqual(
        expect.arrayContaining([chaves.alertas, chaves.mundo, chaves.resumo]),
      );
    });

    it('marco relê a jornada e as relações (personagem novo)', () => {
      aplicarNoCache(cliente, alerta('marco'));
      expect(chavesRelidas()).toEqual(
        expect.arrayContaining([chaves.alertas, chaves.relacoes, chaves.jornada]),
      );
    });

    it('outros tipos só relêem os alertas', () => {
      aplicarNoCache(cliente, alerta('dm'));
      expect(chavesRelidas()).toEqual([chaves.alertas]);
    });
  });
});

describe('"digitando"', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('um aviso novo do mesmo personagem renova a contagem de 8 s', () => {
    const vic = personagem();
    const alvo = uuid();
    const aviso: EventoTempoReal = {
      tipo: 'digitando',
      personagem: vic,
      conversaId: alvo,
      postId: null,
    };
    aplicarNoCache(cliente, aviso);
    jest.advanceTimersByTime(5000);
    aplicarNoCache(cliente, aviso);
    // 8 s depois do primeiro aviso o primeiro timer já teria apagado; o renovado ainda vale.
    jest.advanceTimersByTime(5000);
    expect(useDigitando.getState().porAlvo[alvo]).toEqual([vic]);
    jest.advanceTimersByTime(3100);
    expect(useDigitando.getState().porAlvo[alvo]).toEqual([]);
  });

  it('avisos de post usam o id do post como alvo e sem alvo não fazem nada', () => {
    const vic = personagem();
    const postId = uuid();
    aplicarNoCache(cliente, { tipo: 'digitando', personagem: vic, conversaId: null, postId });
    expect(useDigitando.getState().porAlvo[postId]).toEqual([vic]);
    aplicarNoCache(cliente, { tipo: 'digitando', personagem: vic, conversaId: null, postId: null });
    expect(Object.keys(useDigitando.getState().porAlvo)).toEqual([postId]);
  });
});

// ---------- ProvedorTempoReal ----------

class SocketFalso {
  static instancias: SocketFalso[] = [];
  static falharNaCriacao = false;
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  fechado = false;
  constructor(readonly url: string) {
    if (SocketFalso.falharNaCriacao) throw new Error('sem rede');
    SocketFalso.instancias.push(this);
  }
  close() {
    this.fechado = true;
  }
  abrir() {
    this.onopen?.();
  }
  receber(dados: unknown) {
    this.onmessage?.({ data: typeof dados === 'string' ? dados : JSON.stringify(dados) });
  }
  cair() {
    this.onclose?.();
  }
}

function Provedores({ children, mundoId }: { children: ReactNode; mundoId: string | undefined }) {
  return (
    <QueryClientProvider client={cliente}>
      <ProvedorTempoReal mundoId={mundoId}>{children}</ProvedorTempoReal>
    </QueryClientProvider>
  );
}

const sockets = () => SocketFalso.instancias;
/** Espera o `await garantirToken()` do provedor e o efeito assentarem. */
const assentar = () => act(async () => {});

describe('ProvedorTempoReal', () => {
  const original = globalThis.WebSocket;
  let estadoOriginal: unknown;
  beforeEach(() => {
    jest.useFakeTimers();
    SocketFalso.instancias = [];
    SocketFalso.falharNaCriacao = false;
    globalThis.WebSocket = SocketFalso as unknown as typeof WebSocket;
    // No Jest o AppState começa sem estado; o app de verdade começa ativo.
    estadoOriginal = AppState.currentState;
    (AppState as { currentState: unknown }).currentState = 'active';
  });
  afterEach(() => {
    globalThis.WebSocket = original;
    (AppState as { currentState: unknown }).currentState = estadoOriginal;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const montar = async (mundoId: string | undefined) => {
    const tela = await render(<Provedores mundoId={mundoId}>{null}</Provedores>);
    await assentar();
    return tela;
  };
  const trocarMundo = async (
    tela: Awaited<ReturnType<typeof montar>>,
    mundoId: string | undefined,
  ) => {
    await tela.rerender(<Provedores mundoId={mundoId}>{null}</Provedores>);
    await assentar();
  };

  it('sem mundo não abre socket; com mundo abre com o token na URL', async () => {
    const tela = await montar(undefined);
    expect(sockets()).toHaveLength(0);
    await trocarMundo(tela, uuid());
    expect(sockets()).toHaveLength(1);
    expect(sockets()[0]!.url).toBe('ws://127.0.0.1:3333/v1/tempo-real?token=token-de-teste');
  });

  it('trocar o id do mundo fecha o socket velho e abre outro (criar ou recomeçar mundo)', async () => {
    const tela = await montar(uuid());
    expect(sockets()).toHaveLength(1);
    await trocarMundo(tela, uuid());
    expect(sockets()).toHaveLength(2);
    expect(sockets()[0]!.fechado).toBe(true);
    expect(sockets()[1]!.fechado).toBe(false);
    // Sem mundo (cache limpo ao recomeçar): fecha e fica fechado.
    await trocarMundo(tela, undefined);
    expect(sockets()[1]!.fechado).toBe(true);
    expect(sockets()).toHaveLength(2);
  });

  it('a primeira abertura não relê tudo; as seguintes (reconexão) releem', async () => {
    await montar(uuid());
    sockets()[0]!.abrir();
    expect(invalidar).not.toHaveBeenCalled();

    sockets()[0]!.cair();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2100);
    });
    expect(sockets()).toHaveLength(2);
    sockets()[1]!.abrir();
    // Sem filtro: todas as consultas.
    expect(invalidar).toHaveBeenCalledWith();
  });

  it('o mundo novo também começa sem reler tudo', async () => {
    const tela = await montar(uuid());
    sockets()[0]!.abrir();
    await trocarMundo(tela, uuid());
    sockets()[1]!.abrir();
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('reconecta com espera crescente depois de cair', async () => {
    await montar(uuid());
    sockets()[0]!.cair();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1900);
    });
    expect(sockets()).toHaveLength(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });
    expect(sockets()).toHaveLength(2);
    // Segunda queda sem ter aberto: espera dobrada (4 s).
    sockets()[1]!.cair();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3900);
    });
    expect(sockets()).toHaveLength(2);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });
    expect(sockets()).toHaveLength(3);
  });

  it('falha ao conectar (sem rede ou sem token) agenda nova tentativa em vez de estourar', async () => {
    SocketFalso.falharNaCriacao = true;
    await montar(uuid());
    expect(sockets()).toHaveLength(0);
    SocketFalso.falharNaCriacao = false;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2100);
    });
    expect(sockets()).toHaveLength(1);

    // O login que falha também cai no mesmo caminho (a abertura zera a espera: 2 s, depois 4 s).
    jest.mocked(garantirToken).mockRejectedValueOnce(new TypeError('Network request failed'));
    sockets()[0]!.abrir();
    sockets()[0]!.cair();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2100);
    });
    expect(sockets()).toHaveLength(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(4100);
    });
    expect(sockets()).toHaveLength(2);
  });

  it('mensagem que não é JSON ou não é do contrato é ignorada; a válida chega às telas', async () => {
    const recebidos: EventoTempoReal[] = [];
    function Tela() {
      useTempoReal((e) => recebidos.push(e));
      return null;
    }
    await render(
      <Provedores mundoId={uuid()}>
        <Tela />
      </Provedores>,
    );
    await assentar();
    const socket = sockets()[0]!;
    socket.abrir();

    await act(async () => {
      socket.receber('isto não é json {');
      socket.receber({ tipo: 'inventado' });
    });
    expect(recebidos).toEqual([]);

    const e = energia(3);
    await act(async () => socket.receber({ tipo: 'energia', energia: e }));
    expect(recebidos).toEqual([{ tipo: 'energia', energia: e }]);
    expect(cliente.getQueryData(chaves.energia)).toEqual(e);
  });

  it('ao voltar para o primeiro plano relê o mundo (o dia anda com o relógio)', async () => {
    const ouvintes: ((estado: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _: string,
      fn: (e: string) => void,
    ) => {
      ouvintes.push(fn);
      return { remove: jest.fn() };
    }) as never);
    await montar(uuid());
    await act(async () => ouvintes.forEach((fn) => fn('background')));
    expect(invalidar).not.toHaveBeenCalled();
    await act(async () => ouvintes.forEach((fn) => fn('active')));
    expect(chavesRelidas()).toContainEqual(chaves.mundo);
  });
});
