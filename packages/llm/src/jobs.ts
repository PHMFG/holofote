// Tabela de jobs: qual papel de modelo atende cada um e o teto de tokens de saída.
// Os tetos de docs/PLANO.md ("Tetos por tipo de job") foram estimados para inglês. Em português o
// JSON gasta mais tokens, e nos evals com o Go (16/10/2026) o diretor cortava a resposta em 500.
// O teto não é meta: o custo é o que o modelo de fato escreve. Daí a folga.
import type { ConfigLlm, PapelModelo } from './config';

export const NOMES_JOBS = [
  'diretor',
  'dm',
  'discurso',
  'criar_mundo',
  'feed_inicial',
  'lote_diario',
  'memoria',
  'ficha',
  'novo_ato',
] as const;

export type NomeJob = (typeof NOMES_JOBS)[number];

/** Papel do personagem que responde na DM: decide entre o modelo principal e o diretor. */
export type PapelNaDm = 'elenco' | 'figurante';

export interface DefinicaoJob {
  /** Papel fixo, ou um por papel do personagem (só a DM). */
  papel: PapelModelo | Record<PapelNaDm, PapelModelo>;
  maxTokens: number;
}

export const JOBS: Record<NomeJob, DefinicaoJob> = {
  diretor: { papel: 'diretor', maxTokens: 1200 },
  dm: { papel: { elenco: 'principal', figurante: 'diretor' }, maxTokens: 500 },
  discurso: { papel: 'principal', maxTokens: 900 },
  criar_mundo: { papel: 'lote', maxTokens: 5000 },
  feed_inicial: { papel: 'lote', maxTokens: 4500 },
  lote_diario: { papel: 'lote', maxTokens: 5000 },
  memoria: { papel: 'lote', maxTokens: 1200 },
  ficha: { papel: 'lote', maxTokens: 700 },
  novo_ato: { papel: 'lote', maxTokens: 1500 },
};

export function ehNomeJob(valor: string): valor is NomeJob {
  return (NOMES_JOBS as readonly string[]).includes(valor);
}

/** Papel de modelo do job. Na DM, `papelNaDm` escolhe: elenco usa o principal; figurante, o diretor. */
export function papelDoJob(job: NomeJob, papelNaDm: PapelNaDm = 'elenco'): PapelModelo {
  const { papel } = JOBS[job];
  return typeof papel === 'string' ? papel : papel[papelNaDm];
}

/** Id do modelo configurado para o job. */
export function modeloDoJob(job: NomeJob, config: ConfigLlm, papelNaDm?: PapelNaDm): string {
  return config.modelos[papelDoJob(job, papelNaDm)];
}
