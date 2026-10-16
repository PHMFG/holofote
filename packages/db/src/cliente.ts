// Conexão com o Postgres: drizzle sobre postgres-js, com o schema e snake_case no banco.
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/** Mesma convenção do drizzle.config.ts: camelCase no TypeScript, snake_case no banco. */
export const CASING = 'snake_case' as const;

export type Schema = typeof schema;
export type Db = PostgresJsDatabase<Schema>;
export type OpcoesConexao = postgres.Options<Record<string, postgres.PostgresType>>;

export interface ConexaoDb {
  /** Drizzle com o schema (consultas tipadas e `db.query.<tabela>`). */
  db: Db;
  /** Cliente postgres-js cru, para SQL que o Drizzle não cobre. */
  sql: postgres.Sql;
  /** Encerra o pool. Chame no desligamento do processo e no fim dos testes. */
  fechar: () => Promise<void>;
}

export function criarDb(url: string, opcoes: OpcoesConexao = {}): ConexaoDb {
  const sql = postgres(url, opcoes);
  const db = drizzle({ client: sql, schema, casing: CASING });
  return { db, sql, fechar: () => sql.end() };
}
