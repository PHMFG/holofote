// Erros do Postgres no worker. O Drizzle embrulha o erro do driver (DrizzleQueryError) com a
// consulta e os parâmetros na mensagem, e os parâmetros têm texto do jogador e da IA: essa
// mensagem não pode ir para o log nem para o failedReason do BullMQ (que fica no Redis).

const SQLSTATE = /^[0-9A-Z]{5}$/;

interface Elo {
  code?: unknown;
  constraint_name?: unknown;
  query?: unknown;
  params?: unknown;
  cause?: unknown;
}

/** Erro vindo do banco (consulta do Drizzle ou erro do driver), com código e constraint. */
export function erroDoBanco(erro: unknown): { codigo: string; constraint: string | null } | null {
  let consulta = false;
  let codigo: string | null = null;
  let constraint: string | null = null;
  for (let e = erro as Elo | undefined, i = 0; e && typeof e === 'object' && i < 5; i++) {
    if (typeof e.query === 'string' && Array.isArray(e.params)) consulta = true;
    if (codigo === null && typeof e.code === 'string') {
      codigo = e.code;
      constraint = typeof e.constraint_name === 'string' ? e.constraint_name : null;
    }
    e = e.cause as Elo | undefined;
  }
  if (!consulta && !(codigo && SQLSTATE.test(codigo))) return null;
  return { codigo: codigo ?? 'desconhecido', constraint };
}

export function violouUnicidade(erro: unknown, constraint?: string): boolean {
  const pg = erroDoBanco(erro);
  return pg?.codigo === '23505' && (!constraint || pg.constraint === constraint);
}

/** Erro de banco sem consulta nem parâmetros: só nome, código e constraint. */
export class ErroBanco extends Error {
  override readonly name = 'ErroBanco';
  constructor(
    readonly codigo: string,
    readonly constraint: string | null,
  ) {
    super(`erro de banco ${codigo}${constraint ? ` (${constraint})` : ''}`);
  }
}

/** Troca um erro de banco pela versão sem dados; os outros passam como estão. */
export function sanitizarErro(erro: unknown): unknown {
  const pg = erroDoBanco(erro);
  return pg ? new ErroBanco(pg.codigo, pg.constraint) : erro;
}

/** Campos seguros para o log estruturado. */
export function erroParaLog(erro: unknown): Record<string, string | null> {
  const pg = erroDoBanco(erro);
  const nome = erro instanceof Error ? erro.name : typeof erro;
  if (pg) return { nome, codigo: pg.codigo, constraint: pg.constraint };
  return { nome, erro: erro instanceof Error ? erro.message : String(erro) };
}
