import type { Db } from '@holofote/db';

/** Transação do Drizzle aberta por db.transaction. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** Banco ou transação: os serviços rodam nos dois. */
export type Executor = Db | Tx;
