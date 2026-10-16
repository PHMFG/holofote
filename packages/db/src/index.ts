// @holofote/db: schema Drizzle, conexão, migrações e a fixture de testes.
export * from './schema';
export {
  CASING,
  criarDb,
  type ConexaoDb,
  type Db,
  type OpcoesConexao,
  type Schema,
} from './cliente';
export { migrar, PASTA_MIGRACOES } from './migrar';
export * from './dto';
export {
  criarFixturePopBrasil,
  type FixturePopBrasil,
  type OpcoesFixturePopBrasil,
} from './fixtures/pop-brasil';

// Operadores do Drizzle reexportados para a API e o worker não dependerem do drizzle-orm direto.
export {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  or,
  sql,
  sum,
} from 'drizzle-orm';
