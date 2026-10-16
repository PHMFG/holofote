// Configuração do drizzle-kit. Gerar migração depois de mudar o schema:
//   pnpm --filter @holofote/db exec drizzle-kit generate --name=<o_que_mudou>
// A primeira migração (0000_extensao_vector) é manual e cria a extensão do pgvector.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  // Igual ao CASING de src/cliente.ts.
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://holofote:holofote@localhost:5432/holofote',
  },
  strict: true,
  verbose: true,
});
