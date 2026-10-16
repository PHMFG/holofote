import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { pino } from 'pino';
import { FILAS } from '@holofote/shared';
import { lerConfig } from './config';

const config = lerConfig();
const log = pino({
  level: config.LOG_LEVEL,
  transport: process.stdout.isTTY ? { target: 'pino-pretty' } : undefined,
});

// BullMQ exige maxRetriesPerRequest: null nas conexões de worker.
const conexao = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

// F0: a fila existe e consome, mas o diretor de verdade chega na F4.
const diretor = new Worker(
  FILAS.diretor,
  async (job) => {
    log.info({ fila: FILAS.diretor, jobId: job.id }, 'job recebido (sem processador ainda)');
  },
  { connection: conexao },
);

diretor.on('failed', (job, erro) => log.error({ jobId: job?.id, erro }, 'job falhou'));
diretor.on('error', (erro) => log.warn({ erro: erro.message }, 'worker com erro'));
// Sem ouvinte, o ioredis escreve cada falha de reconexão direto no console.
conexao.on('error', (erro) => log.warn({ erro: erro.message }, 'redis com erro'));

async function encerrar(sinal: string) {
  log.info({ sinal }, 'encerrando');
  // Com o Redis fora, quit() espera para sempre (maxRetriesPerRequest: null); sai assim mesmo.
  setTimeout(() => process.exit(1), 10_000).unref();
  await diretor.close();
  await conexao.quit();
  process.exit(0);
}

process.once('SIGINT', () => void encerrar('SIGINT'));
process.once('SIGTERM', () => void encerrar('SIGTERM'));

await diretor.waitUntilReady();
log.info({ filas: [FILAS.diretor] }, 'worker pronto');
