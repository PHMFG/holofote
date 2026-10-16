// Erros do Postgres vistos pela API. O Drizzle embrulha o erro do driver (DrizzleQueryError) com a
// consulta e os parâmetros na mensagem, que podem ter texto do jogador: nunca vão para o log.

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

/** Violação de unicidade (23505), opcionalmente de uma constraint específica. */
export function violouUnicidade(erro: unknown, constraint?: string): boolean {
  const pg = erroDoBanco(erro);
  return pg?.codigo === '23505' && (!constraint || pg.constraint === constraint);
}

/** Versão do erro que pode ir para o log: sem consulta nem parâmetros quando vem do banco. */
export function erroParaLog(erro: unknown): object {
  const pg = erroDoBanco(erro);
  if (pg) return { nome: (erro as Error).name, codigo: pg.codigo, constraint: pg.constraint };
  return { erro };
}
