// Marcos de um ato. O título e a descrição vêm da IA; o motor só dá requisitos e recompensas.
import { AFINIDADE_ALIADO, ATRIBUTO, GEMAS, MARCOS_POR_ATO } from './constantes';
import { limitar } from './atributos';
import { entre, escolherPonderado } from './rng';
import type { Rng } from './tipos';

export type ChaveRequisito =
  'seguidores' | 'fama' | 'carisma' | 'posts' | 'dms' | 'escandalos' | 'aliados';

/** Rótulos curtos de interface para cada requisito. */
export const ROTULOS_REQUISITO: Readonly<Record<ChaveRequisito, string>> = {
  seguidores: 'Seguidores',
  fama: 'Fama',
  carisma: 'Carisma',
  posts: 'Posts publicados',
  dms: 'Mensagens enviadas',
  escandalos: 'Escândalos administrados',
  aliados: 'Aliados',
};

/** Ordem de exibição dos requisitos. */
export const ORDEM_REQUISITOS: readonly ChaveRequisito[] = [
  'seguidores',
  'fama',
  'carisma',
  'posts',
  'dms',
  'escandalos',
  'aliados',
];

/**
 * Como cada alvo cresce com a ordem do marco (índice 0 = marco 1). "fator" multiplica os
 * seguidores do início do ato; "soma" é somado ao valor do início do ato. Uma variação de ±10 %
 * é sorteada por requisito, e os degraus foram escolhidos para que o maior alvo possível de um
 * marco nunca passe do menor alvo possível do seguinte. "aPartirDe" é a primeira ordem em que a
 * chave pode aparecer.
 */
export const ESCALA_REQUISITOS: Readonly<
  Record<
    ChaveRequisito,
    { modo: 'fator' | 'soma'; degraus: readonly number[]; aPartirDe: number; peso: number }
  >
> = {
  seguidores: { modo: 'fator', degraus: [2, 5, 12, 30, 75], aPartirDe: 1, peso: 0 },
  fama: { modo: 'soma', degraus: [4, 10, 18, 28, 40], aPartirDe: 2, peso: 3 },
  carisma: { modo: 'soma', degraus: [4, 8, 12, 16, 20], aPartirDe: 2, peso: 3 },
  posts: { modo: 'soma', degraus: [10, 25, 50, 80, 120], aPartirDe: 1, peso: 2 },
  dms: { modo: 'soma', degraus: [3, 10, 20, 35, 50], aPartirDe: 1, peso: 2 },
  escandalos: { modo: 'soma', degraus: [1, 4, 8, 12, 18], aPartirDe: 2, peso: 2 },
  aliados: { modo: 'soma', degraus: [1, 1, 1, 2, 3], aPartirDe: 3, peso: 2 },
};

const VARIACAO_ALVO = [0.9, 1.1] as const;

/** Valores no início do ato. Contadores ausentes valem 0 (primeiro ato). */
export interface EstadoInicialMarcos {
  seguidores: number;
  fama: number;
  carisma: number;
  posts?: number;
  dms?: number;
  escandalos?: number;
  aliados?: number;
}

/** Valores atuais de cada chave. "aliados" = relações com afinidade ≥ 80 (AFINIDADE_ALIADO). */
export type EstadoMarcos = Partial<Record<ChaveRequisito, number>>;

export interface RequisitoMarco {
  chave: ChaveRequisito;
  rotulo: string;
  alvo: number;
}

export interface RequisitoAvaliado extends RequisitoMarco {
  atual: number;
}

/** Arredonda para dois algarismos significativos (9 873 vira 9 900). Monótono. */
export function arredondarSignificativo(valor: number): number {
  if (valor < 100) return Math.round(valor);
  const passo = 10 ** (Math.floor(Math.log10(valor)) - 1);
  return Math.round(valor / passo) * passo;
}

function ordemValida(ordem: number): number {
  return limitar(Math.floor(ordem), 1, MARCOS_POR_ATO);
}

/** Alvo de uma chave num marco. Sorteia só a variação de ±10 %. */
export function alvoDoRequisito(
  chave: ChaveRequisito,
  ordem: number,
  estadoInicial: EstadoInicialMarcos,
  rng: Rng,
): number {
  const escala = ESCALA_REQUISITOS[chave];
  const degrau = escala.degraus[ordemValida(ordem) - 1] as number;
  const variado = degrau * entre(rng, VARIACAO_ALVO[0], VARIACAO_ALVO[1]);
  if (escala.modo === 'fator') {
    // Base mínima de 1 000 para uma conta quase vazia ainda ter meta com sentido.
    return arredondarSignificativo(Math.max(1000, estadoInicial.seguidores) * variado);
  }
  const inicio = estadoInicial[chave] ?? 0;
  const alvo = Math.round(inicio + Math.max(1, variado));
  return chave === 'fama' || chave === 'carisma' ? limitar(alvo, ATRIBUTO.min, ATRIBUTO.max) : alvo;
}

/**
 * Requisitos de um marco (ordem 1 a 5): seguidores sempre, mais 1 chave no marco 1 e 2 chaves
 * a partir do marco 2, sorteadas sem repetição entre as liberadas para a ordem.
 */
export function requisitosDoMarco(
  ordem: number,
  estadoInicial: EstadoInicialMarcos,
  rng: Rng,
): RequisitoMarco[] {
  const n = ordemValida(ordem);
  const extras = n === 1 ? 1 : 2;
  let candidatas = ORDEM_REQUISITOS.filter((chave) => {
    const escala = ESCALA_REQUISITOS[chave];
    return escala.peso > 0 && escala.aPartirDe <= n;
  }).map((chave) => ({ chave, peso: ESCALA_REQUISITOS[chave].peso }));

  const chaves: ChaveRequisito[] = ['seguidores'];
  for (let i = 0; i < extras; i++) {
    const { chave } = escolherPonderado(rng, candidatas);
    chaves.push(chave);
    candidatas = candidatas.filter((c) => c.chave !== chave);
  }

  return ORDEM_REQUISITOS.filter((chave) => chaves.includes(chave)).map((chave) => ({
    chave,
    rotulo: ROTULOS_REQUISITO[chave],
    alvo: alvoDoRequisito(chave, n, estadoInicial, rng),
  }));
}

export interface AvaliacaoMarco {
  requisitos: RequisitoAvaliado[];
  cumprido: boolean;
}

/** Junta o valor atual de cada requisito e diz se todos foram cumpridos. */
export function avaliarMarco(
  requisitos: readonly RequisitoMarco[],
  estadoAtual: EstadoMarcos,
): AvaliacaoMarco {
  const avaliados = requisitos.map((r) => ({
    chave: r.chave,
    rotulo: r.rotulo,
    atual: estadoAtual[r.chave] ?? 0,
    alvo: r.alvo,
  }));
  return { requisitos: avaliados, cumprido: avaliados.every((r) => r.atual >= r.alvo) };
}

/** Quantos personagens contam como aliados (afinidade ≥ 80). */
export function contarAliados(afinidades: readonly number[]): number {
  return afinidades.filter((a) => a >= AFINIDADE_ALIADO).length;
}

/** Ações liberadas pelos marcos, uma por ordem (rótulos curtos de interface). */
export const ACOES_NOVAS = [
  { id: 'enquete', rotulo: 'Enquete' },
  { id: 'citar', rotulo: 'Citar post' },
  { id: 'parceria', rotulo: 'Post em parceria' },
  { id: 'bastidores', rotulo: 'Bastidores' },
  { id: 'ao_vivo', rotulo: 'Ao vivo' },
] as const;

export type AcaoNova = (typeof ACOES_NOVAS)[number]['id'];

export interface Recompensa {
  gemas: number;
  energiaCheia: boolean;
  personagemNovo: boolean;
  acaoNova: AcaoNova;
}

/** Recompensa padrão do plano: +25 gemas, energia cheia, um personagem novo e uma ação nova. */
export const RECOMPENSA_PADRAO: Readonly<Recompensa> = {
  gemas: GEMAS.marco,
  energiaCheia: true,
  personagemNovo: true,
  acaoNova: ACOES_NOVAS[0].id,
};

/** Recompensa do marco de uma ordem: a padrão, com a ação nova daquela ordem. */
export function recompensaDoMarco(ordem: number): Recompensa {
  const acao = ACOES_NOVAS[ordemValida(ordem) - 1] ?? ACOES_NOVAS[0];
  return { ...RECOMPENSA_PADRAO, acaoNova: acao.id };
}

export interface MarcoParaProgresso {
  concluido: boolean;
  requisitos?: readonly { atual: number; alvo: number }[];
}

/**
 * Progresso do ato de 0 a 1: marcos concluídos mais a fração do primeiro marco não concluído
 * (média de atual / alvo dos requisitos), sobre 5 marcos (ou mais, se a lista for maior).
 */
export function progressoDoAto(marcos: readonly MarcoParaProgresso[]): number {
  const total = Math.max(MARCOS_POR_ATO, marcos.length);
  const concluidos = marcos.filter((m) => m.concluido).length;
  const atual = marcos.find((m) => !m.concluido);
  const requisitos = atual?.requisitos ?? [];
  const fracao =
    requisitos.length === 0
      ? 0
      : requisitos.reduce(
          (soma, r) => soma + (r.alvo <= 0 ? 1 : limitar(r.atual / r.alvo, 0, 1)),
          0,
        ) / requisitos.length;
  return limitar((concluidos + fracao) / total, 0, 1);
}
