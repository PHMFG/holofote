// Aplica as migrações SQL de packages/db/drizzle.
// Uso como script: DATABASE_URL=postgres://... pnpm --filter @holofote/db migrar
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { criarDb } from './cliente';

/** Pasta das migrações geradas pelo drizzle-kit, ao lado de src/. */
export const PASTA_MIGRACOES = fileURLToPath(new URL('../drizzle', import.meta.url));

/** Aplica as migrações pendentes. Idempotente: o drizzle registra as aplicadas em drizzle.__drizzle_migrations. */
export async function migrar(url: string): Promise<void> {
  // Uma conexão só: migrações rodam em sequência. Os avisos (NOTICE) do Postgres não interessam aqui.
  const { db, fechar } = criarDb(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(db, { migrationsFolder: PASTA_MIGRACOES });
  } finally {
    await fechar();
  }
}

/** Verdadeiro quando este arquivo é o ponto de entrada (`tsx src/migrar.ts`), e não um import. */
function executadoDireto(): boolean {
  const entrada = process.argv[1];
  if (!entrada) return false;
  try {
    const caminho = (p: string) => realpathSync(p).normalize('NFC');
    return caminho(entrada) === caminho(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (executadoDireto()) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      'Defina DATABASE_URL, por exemplo: DATABASE_URL=postgres://holofote:holofote@localhost:5432/holofote pnpm --filter @holofote/db migrar',
    );
    process.exit(1);
  }
  migrar(url).then(
    () => console.log('Migrações aplicadas.'),
    (erro: unknown) => {
      console.error('Falha ao migrar:', erro);
      process.exit(1);
    },
  );
}
