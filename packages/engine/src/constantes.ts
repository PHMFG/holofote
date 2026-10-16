// Tabelas da seção "Regras do jogo" de docs/PLANO.md (versão 2). Toda regra numérica mora aqui
// ou ao lado da função que a usa; o modelo de linguagem nunca decide um número.
import type { Periodo, Plano } from './tipos';

// ---------- Energia ----------

/** Máximo da barra e intervalo da recarga natural (1 unidade a cada N minutos), por plano. */
export const ENERGIA: Readonly<Record<Plano, { max: number; recargaMinutos: number }>> = {
  free: { max: 12, recargaMinutos: 20 },
  plus: { max: 24, recargaMinutos: 10 },
};

/** Anúncio assistido: +3 de energia, até 3 por dia. */
export const ANUNCIO = { energia: 3, porDia: 3 } as const;

/** Custo em energia de cada ação. "historia" é responder a uma história (vira DM). */
export const CUSTOS = {
  post: 1,
  resposta: 1,
  dm: 1,
  historia: 1,
  voto: 0,
  curtir: 0,
  seguir: 0,
  desfazer: 2,
  previa: 0,
  /** Já pago nas ações de campanha. */
  discurso: 0,
} as const;

export type AcaoComCusto = keyof typeof CUSTOS;

/** Ações de campanha custam 1 ou 2 conforme o catálogo (ver eventos.ts). */
export const CUSTO_CAMPANHA = { min: 1, max: 2 } as const;

// ---------- Gemas ----------

export const GEMAS = {
  iniciais: 40,
  /** Quanto custa encher a barra de energia. */
  encherEnergia: 10,
  marco: 25,
  evento: { min: 10, max: 40 },
} as const;

// ---------- Atributos e relações ----------

export const ATRIBUTO = { min: 0, max: 100 } as const;
export const AFINIDADE = { min: 0, max: 100 } as const;

/** Limite de cada delta de relação: ±8 por ação, ±12 em evento. */
export const LIMITE_DELTA_RELACAO = { acao: 8, evento: 12 } as const;

export const POLEMICA = {
  /** Acima deste valor (estritamente) abre a chance diária de crise. */
  limiarCrise: 70,
  chanceCriseDia: 0.2,
  /** Pontos perdidos por dia sem provocação. */
  decaimentoDia: 3,
} as const;

/** Faixas de afinidade e seus rótulos. "vinculo" no 60–79 vira Amizade ou Parceria. */
export const FAIXAS_RELACAO = [
  { min: 0, max: 24, rotulo: 'Rival' },
  { min: 25, max: 44, rotulo: 'Rivais com respeito' },
  { min: 45, max: 59, rotulo: 'Conhecidos' },
  { min: 60, max: 79, rotulo: 'vinculo' },
  { min: 80, max: 100, rotulo: 'Aliança' },
] as const;

// ---------- Desfazer ----------

export const DESFAZER = {
  janelaMinutos: 60,
  /** Abaixo desta afinidade o personagem pode lembrar que o post foi apagado. */
  afinidadeLembra: 45,
  chanceLembrar: 0.25,
} as const;

// ---------- Reatores, marcos e eventos ----------

export const MAX_REATORES = 5;
export const MAX_MARCADOS = 3;
export const MARCOS_POR_ATO = 5;

/** Afinidades que contam como "extremas" na escolha de reatores. */
export const AFINIDADE_EXTREMA = { ate: 24, aPartirDe: 80 } as const;

/** Relação a partir da qual o personagem conta como aliado (requisito "aliados"). */
export const AFINIDADE_ALIADO = 80;

export const EVENTO = {
  /** Dias de antecedência do anúncio. */
  anuncioDiasAntes: 3,
  /** Segundos para escolher o discurso no ao vivo. */
  segundosAoVivo: 30,
} as const;

// ---------- Tempo ----------

/** Hora local de início de cada período (manhã 6–12, tarde 12–18, noite 18–6). */
export const PERIODOS: Readonly<Record<Periodo, { inicio: number; fim: number }>> = {
  manha: { inicio: 6, fim: 12 },
  tarde: { inicio: 12, fim: 18 },
  noite: { inicio: 18, fim: 6 },
};

export const FUSO_PADRAO = 'America/Sao_Paulo';
