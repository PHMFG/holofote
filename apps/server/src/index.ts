import { Redis } from 'ioredis';
import postgres from 'postgres';
import { construirApp } from './app';
import { lerConfig } from './config';

const config = lerConfig();

const sql = postgres(config.DATABASE_URL, { max: 5, connect_timeout: 5 });
const redis = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });

const app = construirApp(
  {
    postgres: () => sql`select 1`,
    redis: () => redis.ping(),
  },
  {
    fastify: {
      logger: {
        level: config.LOG_LEVEL,
        transport: process.stdout.isTTY ? { target: 'pino-pretty' } : undefined,
      },
    },
  },
);

// Sem ouvinte, o ioredis escreve cada falha de reconexão direto no console.
redis.on('error', (erro) => app.log.warn({ erro: erro.message }, 'redis com erro'));

async function encerrar(sinal: string) {
  app.log.info({ sinal }, 'encerrando');
  // Se alguma dependência travar o fechamento, sai assim mesmo.
  setTimeout(() => process.exit(1), 10_000).unref();
  await app.close();
  await Promise.allSettled([sql.end({ timeout: 5 }), redis.quit()]);
  process.exit(0);
}

process.once('SIGINT', () => void encerrar('SIGINT'));
process.once('SIGTERM', () => void encerrar('SIGTERM'));

await redis.connect().catch((erro: unknown) => app.log.warn({ erro }, 'redis indisponível'));
await app.listen({ port: config.PORT, host: config.HOST });
