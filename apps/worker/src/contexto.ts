import type { Db } from '@holofote/db';
import type { ConfigLlm, Provedor } from '@holofote/llm';
import type { Redis } from 'ioredis';

/** O pedaço de uma fila do BullMQ que os jobs usam (agendar entregas e jobs seguintes). */
export interface FilaSimples {
  add(nome: string, dados: unknown, opcoes?: Record<string, unknown>): Promise<unknown>;
}

export interface Registro {
  info(objeto: object, mensagem?: string): void;
  warn(objeto: object, mensagem?: string): void;
  error(objeto: object, mensagem?: string): void;
}

/** Tudo de que os jobs precisam. Os testes montam um com o provedor falso e filas de mentira. */
export interface ContextoWorker {
  db: Db;
  /** Conexão só para publicar no canal do mundo. */
  redis: Redis;
  filas: { entrega: FilaSimples; lote: FilaSimples };
  provedor: Provedor;
  llm: ConfigLlm;
  /** Relógio real; o do mundo soma o deslocamento do relógio simulado. */
  agoraReal: () => Date;
  log: Registro;
}
