import { criarDb } from '@holofote/db';
import { criarProvedor, lerConfigLlm, verificarModelos } from '@holofote/llm';
import { FILAS, POLITICA_JOBS_IA } from '@holofote/shared';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { pino } from 'pino';
import { lerConfig } from './config';
import type { ContextoWorker } from './contexto';
import { erroParaLog } from './infra/erros';
import { processadores } from './processadores';

const config = lerConfig();
const llm = lerConfigLlm(process.env);
const log = pino({
  level: config.LOG_LEVEL,
  transport: process.stdout.isTTY ? { target: 'pino-pretty' } : undefined,
});

// Com o Go ligado, os quatro modelos precisam existir no plano; senão o worker nem sobe.
if (llm.provedor === 'opencode-go') {
  try {
    const { disponiveis } = await verificarModelos(llm);
    log.info({ modelos: llm.modelos, disponiveis: disponiveis.length }, 'modelos do Go conferidos');
  } catch (erro) {
    log.fatal({ erro: (erro as Error).message }, 'modelos de IA indisponíveis');
    process.exit(1);
  }
} else {
  log.warn('LLM_PROVIDER=falso: o worker usa o dublê de teste, sem IA de verdade');
}

const banco = criarDb(config.DATABASE_URL);
// BullMQ exige maxRetriesPerRequest: null nas conexões de worker e fila.
const conexao = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const publicador = new Redis(config.REDIS_URL);
// Sem ouvinte, o ioredis escreve cada falha de reconexão direto no console.
for (const r of [conexao, publicador]) r.on('error', (e) => log.warn({ erro: e.message }, 'redis'));

const filaEntrega = new Queue(FILAS.entrega, { connection: conexao });
const filaLote = new Queue(FILAS.lote, {
  connection: conexao,
  defaultJobOptions: { ...POLITICA_JOBS_IA },
});

const ctx: ContextoWorker = {
  db: banco.db,
  redis: publicador,
  filas: { entrega: filaEntrega, lote: filaLote },
  provedor: criarProvedor(llm),
  llm,
  agoraReal: () => new Date(),
  log,
};

const porFila = processadores(ctx);
const workers = Object.values(FILAS).map((nome) => {
  const worker = new Worker(nome, (job, token) => porFila[nome](job, token), {
    connection: conexao,
    // Entregas são leves; as filas de IA ficam em poucas chamadas simultâneas.
    concurrency: nome === FILAS.entrega ? 10 : 3,
  });
  // Os processadores já relançam erros de banco sem a consulta; erroParaLog garante o mesmo aqui.
  worker.on('failed', (job, erro) =>
    log.error({ fila: nome, job: job?.name, jobId: job?.id, ...erroParaLog(erro) }, 'job falhou'),
  );
  worker.on('error', (erro) => log.warn({ fila: nome, ...erroParaLog(erro) }, 'worker com erro'));
  return worker;
});

// Lote diário de todos os mundos às 04h30 UTC (configurável em LOTE_CRON).
await filaLote.upsertJobScheduler(
  'lote-diario',
  { pattern: config.LOTE_CRON, tz: 'UTC' },
  { name: 'agendar_lotes', data: {} },
);

async function encerrar(sinal: string) {
  log.info({ sinal }, 'encerrando');
  // Com o Redis fora, quit() espera para sempre (maxRetriesPerRequest: null); sai assim mesmo.
  setTimeout(() => process.exit(1), 10_000).unref();
  await Promise.allSettled(workers.map((w) => w.close()));
  await Promise.allSettled([filaEntrega.close(), filaLote.close()]);
  await Promise.allSettled([conexao.quit(), publicador.quit(), banco.fechar()]);
  process.exit(0);
}

process.once('SIGINT', () => void encerrar('SIGINT'));
process.once('SIGTERM', () => void encerrar('SIGTERM'));

await Promise.all(workers.map((w) => w.waitUntilReady()));
log.info({ filas: Object.values(FILAS), provedor: llm.provedor }, 'worker pronto');
