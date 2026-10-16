export const NOME_APP = 'Holofote';

/** Prefixo de todas as rotas REST da API. */
export const VERSAO_API = 'v1';

/** Filas do BullMQ, uma por tipo de job do worker. */
export const FILAS = {
  diretor: 'diretor',
  dm: 'dm',
  lote: 'lote',
  memoria: 'memoria',
  entrega: 'entrega',
} as const;

export type NomeFila = (typeof FILAS)[keyof typeof FILAS];
