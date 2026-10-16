export * from './contratos';

export const NOME_APP = 'Holofote';

/** Prefixo de todas as rotas REST da API. */
export const VERSAO_API = 'v1';

/** Filas do BullMQ, uma por tipo de trabalho do worker. */
export const FILAS = {
  /** Reações a post, comentário e resposta de história (modelo diretor). */
  diretor: 'diretor',
  /** Respostas em mensagem direta. */
  dm: 'dm',
  /** Reação ao discurso no evento ao vivo (modelo principal). */
  discurso: 'discurso',
  /** Criação de mundo, lote diário e fichas novas (modelo de lote). */
  lote: 'lote',
  /** Publica no canal do mundo o que chegou na hora marcada. */
  entrega: 'entrega',
} as const;

export type NomeFila = (typeof FILAS)[keyof typeof FILAS];

/**
 * Política dos jobs de IA (opções do BullMQ), igual na API e no worker: o provedor pode cair ou
 * bater limite, então o job tenta de novo com espera crescente (30 s, 1 min, 2 min...).
 */
export const POLITICA_JOBS_IA = {
  attempts: 8,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
} as const;

/** Canal Redis por mundo, repassado pelo WebSocket. */
export const canalDoMundo = (mundoId: string) => `mundo:${mundoId}`;
