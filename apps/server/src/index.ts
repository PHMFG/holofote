import { criarDb, migrar } from '@holofote/db';
import { Redis } from 'ioredis';
import { construirApp } from './app';
import { lerConfig } from './config';
import type { Contexto } from './contexto';
import { Difusor } from './infra/difusor';
import { criarFilas, fecharFilas } from './infra/filas';
import { iniciarVarredor } from './infra/varredor';

const config = lerConfig();

// No dev o banco local acompanha o schema sozinho; em produção a migração é um passo do deploy.
if (config.AMBIENTE === 'dev') await migrar(config.DATABASE_URL);

const conexaoDb = criarDb(config.DATABASE_URL);
const redis = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
// Assinatura Pub/Sub precisa de conexão própria; as filas do BullMQ exigem maxRetriesPerRequest null.
const assinatura = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const conexaoFilas = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const filas = criarFilas(conexaoFilas);
const ctx: Contexto = {
  config,
  db: conexaoDb.db,
  redis,
  filas,
  difusor: new Difusor(assinatura),
  agoraReal: () => new Date(),
};

const app = construirApp(
  {
    postgres: () => conexaoDb.sql`select 1`,
    redis: () => redis.ping(),
  },
  {
    fastify: {
      logger: {
        level: config.LOG_LEVEL,
        transport: process.stdout.isTTY ? { target: 'pino-pretty' } : undefined,
      },
    },
    ctx,
  },
);

// Sem ouvinte, o ioredis escreve cada falha de reconexão direto no console.
for (const conexao of [redis, assinatura, conexaoFilas]) {
  conexao.on('error', (erro) => app.log.warn({ erro: erro.message }, 'redis com erro'));
}

let pararVarredor = () => {};

async function encerrar(sinal: string) {
  app.log.info({ sinal }, 'encerrando');
  pararVarredor();
  // Se alguma dependência travar o fechamento, sai assim mesmo.
  setTimeout(() => process.exit(1), 10_000).unref();
  await app.close();
  await fecharFilas(filas);
  await Promise.allSettled([
    conexaoDb.fechar(),
    redis.quit(),
    assinatura.quit(),
    conexaoFilas.quit(),
  ]);
  process.exit(0);
}

process.once('SIGINT', () => void encerrar('SIGINT'));
process.once('SIGTERM', () => void encerrar('SIGTERM'));

await redis.connect().catch((erro: unknown) => app.log.warn({ erro }, 'redis indisponível'));
await app.listen({ port: config.PORT, host: config.HOST });
// Reenfileira jobs de IA que se perderam depois do commit (ver infra/varredor.ts).
pararVarredor = iniciarVarredor(ctx);
