import { FILAS, POLITICA_JOBS_IA, type NomeFila } from '@holofote/shared';
import { Queue, type JobsOptions } from 'bullmq';
import type { Redis } from 'ioredis';

/** Política das filas de IA: o provedor pode cair ou bater limite; tenta de novo com espera crescente. */
export const OPCOES_JOB_IA: JobsOptions = { ...POLITICA_JOBS_IA };

export type Filas = Record<NomeFila, Queue>;

export function criarFilas(conexao: Redis): Filas {
  return Object.fromEntries(
    Object.values(FILAS).map((nome) => [
      nome,
      new Queue(nome, { connection: conexao, defaultJobOptions: OPCOES_JOB_IA }),
    ]),
  ) as Filas;
}

export async function fecharFilas(filas: Filas): Promise<void> {
  await Promise.allSettled(Object.values(filas).map((f) => f.close()));
}

/** Filas de IA ligadas a uma ação do jogador; o jobId é determinístico (`<fila>-<acaoId>`). */
export type FilaDeAcao = 'diretor' | 'dm' | 'discurso';

export const jobIdDaAcao = (fila: FilaDeAcao, acaoId: string) => `${fila}-${acaoId}`;

interface ComFilas {
  filas: Filas;
  log?: { warn(objeto: object, mensagem?: string): void };
}

/**
 * Enfileira o job de IA de uma ação já gravada. Roda depois do commit: se o Redis falhar, a ação
 * continua valendo e o varredor (infra/varredor.ts) enfileira de novo com o mesmo jobId.
 */
export async function enfileirarIa(ctx: ComFilas, fila: FilaDeAcao, acaoId: string) {
  try {
    await ctx.filas[fila].add(fila, { acaoId }, { jobId: jobIdDaAcao(fila, acaoId) });
  } catch (erro) {
    ctx.log?.warn(
      { fila, acaoId, erro: (erro as Error).message },
      'job de IA não enfileirado; o varredor tenta de novo',
    );
  }
}

/** Enfileira um job da fila `lote` (criar_mundo, ficha) com o mesmo tratamento de falha. */
export async function enfileirarLote(
  ctx: ComFilas,
  nome: 'criar_mundo' | 'ficha',
  dados: Record<string, string>,
  jobId: string,
) {
  try {
    await ctx.filas.lote.add(nome, dados, { jobId });
  } catch (erro) {
    ctx.log?.warn(
      { job: nome, jobId, erro: (erro as Error).message },
      'job não enfileirado; o varredor tenta de novo',
    );
  }
}
