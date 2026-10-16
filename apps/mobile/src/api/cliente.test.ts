import { ErroDaApi, requisitar } from './cliente';
import * as sessao from './sessao';

// O token mora no SecureStore do aparelho; aqui é uma variável.
let mockToken: string | null = null;
jest.mock('./sessao', () => ({
  aparelhoId: jest.fn(() => 'aparelho-de-teste'),
  tokenSalvo: jest.fn(() => mockToken),
  salvarToken: jest.fn((novo: string) => {
    mockToken = novo;
  }),
  esquecerToken: jest.fn(async () => {
    mockToken = null;
  }),
}));

const USUARIO = '00000000-0000-4000-8000-000000000001';
const resposta = (status: number, corpo: unknown): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as Response;

const fetchSimulado = jest.fn<Promise<Response>, [string, RequestInit?]>();
const chamadasDe = () =>
  fetchSimulado.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`);
const cabecalhoDeAutorizacao = (i: number) =>
  (fetchSimulado.mock.calls[i]![1]!.headers as Record<string, string>).authorization;

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'token-velho';
  fetchSimulado.mockReset();
  globalThis.fetch = fetchSimulado as unknown as typeof fetch;
});

describe('requisitar', () => {
  it('manda o token e devolve o corpo da resposta', async () => {
    fetchSimulado.mockResolvedValueOnce(resposta(200, { ok: true }));
    await expect(requisitar('/conta')).resolves.toBeUndefined();
    expect(chamadasDe()).toEqual(['GET http://127.0.0.1:3333/v1/conta']);
    expect(cabecalhoDeAutorizacao(0)).toBe('Bearer token-velho');
  });

  it('401: esquece o token, entra de novo e repete o pedido com o token novo', async () => {
    fetchSimulado
      .mockResolvedValueOnce(
        resposta(401, { erro: 'nao_autenticado', mensagem: 'Token inválido.' }),
      )
      .mockResolvedValueOnce(resposta(200, { token: 'token-novo', usuarioId: USUARIO }))
      .mockResolvedValueOnce(resposta(200, { ok: true }));

    await requisitar('/conta', { metodo: 'GET' });

    expect(sessao.esquecerToken).toHaveBeenCalledTimes(1);
    expect(chamadasDe()).toEqual([
      'GET http://127.0.0.1:3333/v1/conta',
      'POST http://127.0.0.1:3333/v1/auth/anonimo',
      'GET http://127.0.0.1:3333/v1/conta',
    ]);
    expect(cabecalhoDeAutorizacao(0)).toBe('Bearer token-velho');
    expect(cabecalhoDeAutorizacao(2)).toBe('Bearer token-novo');
    expect(sessao.salvarToken).toHaveBeenCalledWith('token-novo');
  });

  it('o corpo do POST vai de novo no pedido repetido', async () => {
    fetchSimulado
      .mockResolvedValueOnce(resposta(401, { erro: 'nao_autenticado', mensagem: 'x' }))
      .mockResolvedValueOnce(resposta(200, { token: 'token-novo', usuarioId: USUARIO }))
      .mockResolvedValueOnce(resposta(200, {}));
    await requisitar('/posts', { metodo: 'POST', corpo: { texto: 'oi' } });
    expect(fetchSimulado.mock.calls[2]![1]!.body).toBe(JSON.stringify({ texto: 'oi' }));
  });

  it('um segundo 401 não entra em laço: vira ErroDaApi', async () => {
    fetchSimulado
      .mockResolvedValueOnce(
        resposta(401, { erro: 'nao_autenticado', mensagem: 'Token inválido.' }),
      )
      .mockResolvedValueOnce(resposta(200, { token: 'token-novo', usuarioId: USUARIO }))
      .mockResolvedValueOnce(
        resposta(401, { erro: 'nao_autenticado', mensagem: 'Ainda inválido.' }),
      );

    await expect(requisitar('/conta')).rejects.toMatchObject({
      status: 401,
      codigo: 'nao_autenticado',
      message: 'Ainda inválido.',
    });
    expect(fetchSimulado).toHaveBeenCalledTimes(3);
  });

  it('erro com o corpo do contrato vira ErroDaApi com o código estável', async () => {
    fetchSimulado.mockResolvedValueOnce(
      resposta(409, { erro: 'sem_energia', mensagem: 'Sem energia.' }),
    );
    const erro = await requisitar('/posts', { metodo: 'POST' }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDaApi);
    expect(erro).toMatchObject({ status: 409, codigo: 'sem_energia', message: 'Sem energia.' });
  });

  it('erro sem corpo do contrato vira "desconhecido" com frase em português', async () => {
    fetchSimulado.mockResolvedValueOnce(resposta(500, 'uma página de erro'));
    await expect(requisitar('/conta')).rejects.toMatchObject({
      status: 500,
      codigo: 'desconhecido',
      message: 'Algo deu errado. Tente de novo.',
    });
  });

  it('login compartilhado: chamadas simultâneas sem token fazem um login só', async () => {
    mockToken = null;
    fetchSimulado.mockImplementation(async (url) =>
      String(url).endsWith('/auth/anonimo')
        ? resposta(200, { token: 'token-novo', usuarioId: USUARIO })
        : resposta(204, null),
    );
    await Promise.all([requisitar('/alertas/lidos', { metodo: 'POST' }), requisitar('/conta')]);
    expect(chamadasDe().filter((c) => c.endsWith('/auth/anonimo'))).toHaveLength(1);
  });
});
