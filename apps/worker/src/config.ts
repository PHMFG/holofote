import { existsSync } from 'node:fs';
import { z } from 'zod';

const esquema = z.object({
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).default('redis://localhost:6379'),
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/ })
    .default('postgres://holofote:holofote@localhost:5432/holofote'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Quando roda o lote diário de cada mundo (cron, em UTC). */
  LOTE_CRON: z.string().trim().min(1).default('30 4 * * *'),
});

export type Config = z.infer<typeof esquema>;

/** Lê o .env da pasta atual, se existir, e valida as variáveis. Falha alto se algo estiver errado. */
export function lerConfig(env: NodeJS.ProcessEnv = process.env, arquivo = '.env'): Config {
  if (env === process.env && existsSync(arquivo)) {
    process.loadEnvFile(arquivo);
  }
  return esquema.parse(env);
}
