import type { Db } from '@holofote/db';
import { canalDoMundo, type EventoTempoReal } from '@holofote/shared';
import type { Redis } from 'ioredis';
import type { Config } from './config';
import type { Difusor } from './infra/difusor';
import type { Filas } from './infra/filas';

/** O pedaço do logger que os serviços usam fora de uma requisição. */
export interface Registro {
  info(objeto: object, mensagem?: string): void;
  warn(objeto: object, mensagem?: string): void;
  error(objeto: object, mensagem?: string): void;
}

/** Dependências das rotas; os testes trocam o relógio e as conexões. */
export interface Contexto {
  config: Config;
  db: Db;
  redis: Redis;
  filas: Filas;
  difusor: Difusor;
  /** Hora real; o relógio de cada mundo soma o deslocamento do relógio simulado. */
  agoraReal: () => Date;
  /** Sem logger próprio, construirApp usa o do Fastify. */
  log?: Registro;
}

/**
 * Publica no canal do mundo; a própria API repassa pelo WebSocket. Melhor esforço: roda depois do
 * commit, e uma falha do Redis não pode transformar uma ação já gravada em erro para o app.
 */
export async function publicar(
  ctx: Contexto,
  mundoId: string,
  evento: EventoTempoReal,
): Promise<void> {
  try {
    await ctx.redis.publish(canalDoMundo(mundoId), JSON.stringify(evento));
  } catch (erro) {
    ctx.log?.warn(
      { mundoId, tipo: evento.tipo, erro: (erro as Error).message },
      'tempo real não publicado',
    );
  }
}
