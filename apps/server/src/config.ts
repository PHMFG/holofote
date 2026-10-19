import { existsSync } from 'node:fs';
import { z } from 'zod';

const SEGREDO_DEV = 'holofote-dev-segredo-local-nao-use-em-producao';

const esquema = z
  .object({
    AMBIENTE: z.enum(['dev', 'teste', 'producao']).default('dev'),
    // 127.0.0.1 basta para o simulador; use 0.0.0.0 só para testar em aparelho na rede local.
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().positive().default(3333),
    DATABASE_URL: z
      .url({ protocol: /^postgres(ql)?$/ })
      .default('postgres://holofote:holofote@localhost:5432/holofote'),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }).default('redis://localhost:6379'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    /** Segredo do JWT; obrigatório fora do dev e dos testes. */
    JWT_SEGREDO: z.string().min(32).optional(),
    /** Pasta das atualizações por ar: <dir>/<runtimeVersion>/<timestamp>/ (ver rotas/atualizacoes.ts). */
    ATUALIZACOES_DIR: z.string().min(1).default('./atualizacoes'),
    /** Origem pública da API (ex.: https://host.ts.net), usada nas URLs absolutas dos arquivos. */
    URL_PUBLICA: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
  })
  .transform((c) => ({
    ...c,
    JWT_SEGREDO: c.JWT_SEGREDO ?? (c.AMBIENTE === 'producao' ? '' : SEGREDO_DEV),
  }))
  .refine((c) => c.JWT_SEGREDO.length >= 32, {
    message: 'JWT_SEGREDO é obrigatório em produção',
    path: ['JWT_SEGREDO'],
  });

export type Config = z.infer<typeof esquema>;

/** Lê o .env da pasta atual, se existir, e valida as variáveis. Falha alto se algo estiver errado. */
export function lerConfig(env: NodeJS.ProcessEnv = process.env, arquivo = '.env'): Config {
  if (env === process.env && existsSync(arquivo)) {
    process.loadEnvFile(arquivo);
  }
  return esquema.parse(env);
}
