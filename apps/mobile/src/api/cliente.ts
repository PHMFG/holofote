import { Erro, RespostaAuth } from '@holofote/shared';
import type { z } from 'zod';
import { API_URL } from './config';
import { aparelhoId, esquecerToken, salvarToken, tokenSalvo } from './sessao';

/** Erro com o código estável do contrato (docs/CONTRATOS.md), ex.: sem_energia, moderacao. */
export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface Opcoes<S extends z.ZodType | undefined> {
  metodo?: Metodo;
  corpo?: unknown;
  schema?: S;
}

let loginEmAndamento: Promise<string> | null = null;

async function login(): Promise<string> {
  const resposta = await fetch(`${API_URL}/v1/auth/anonimo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ aparelhoId: aparelhoId() }),
  });
  if (!resposta.ok) throw await erroDe(resposta);
  const { token } = RespostaAuth.parse(await resposta.json());
  salvarToken(token);
  return token;
}

/** Token salvo ou um login novo; chamadas simultâneas compartilham o mesmo login. */
export function garantirToken(): Promise<string> {
  const salvo = tokenSalvo();
  if (salvo) return Promise.resolve(salvo);
  loginEmAndamento ??= login().finally(() => {
    loginEmAndamento = null;
  });
  return loginEmAndamento;
}

async function erroDe(resposta: Response): Promise<ErroDaApi> {
  const corpo = Erro.safeParse(await resposta.json().catch(() => null));
  return corpo.success
    ? new ErroDaApi(resposta.status, corpo.data.erro, corpo.data.mensagem)
    : new ErroDaApi(resposta.status, 'desconhecido', 'Algo deu errado. Tente de novo.');
}

/** Chama a API /v1 com o token e valida a resposta pelo schema do contrato. */
export async function requisitar<S extends z.ZodType | undefined = undefined>(
  rota: string,
  { metodo = 'GET', corpo, schema }: Opcoes<S> = {},
  tentativa = 0,
): Promise<S extends z.ZodType ? z.infer<S> : void> {
  const token = await garantirToken();
  const resposta = await fetch(`${API_URL}/v1${rota}`, {
    method: metodo,
    headers: {
      authorization: `Bearer ${token}`,
      ...(corpo !== undefined && { 'content-type': 'application/json' }),
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  if (resposta.status === 401 && tentativa === 0) {
    await esquecerToken();
    return requisitar(rota, { metodo, corpo, schema }, 1);
  }
  if (!resposta.ok) throw await erroDe(resposta);
  if (resposta.status === 204 || !schema) return undefined as never;
  return schema.parse(await resposta.json()) as never;
}
