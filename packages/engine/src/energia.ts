// Energia como livro-caixa: o saldo é sempre a soma dos lançamentos, com a recarga natural
// calculada na leitura (nunca por cron). O servidor grava +max ao criar a conta.
import { ANUNCIO, CUSTOS, ENERGIA, type AcaoComCusto } from './constantes';
import type { Plano } from './tipos';

export interface Lancamento {
  /** Positivo soma, negativo gasta. */
  valor: number;
  criadoEm: Date;
}

export interface EstadoEnergia {
  atual: number;
  max: number;
  /** Quando entra a próxima unidade da recarga natural; null com a barra cheia. */
  proximaEm: Date | null;
}

export type ViaRecarga = 'gemas' | 'anuncio' | 'debug' | 'marco';

const MINUTO = 60_000;

/**
 * Reproduz o livro-caixa em ordem cronológica até `agora`, com a recarga natural entre um
 * lançamento e outro:
 * - a recarga só corre com a barra abaixo do máximo e conta unidades inteiras a partir do
 *   instante em que ela caiu abaixo do máximo (gastar de novo não zera o relógio);
 * - nunca passa do máximo e o saldo nunca fica negativo;
 * - lançamentos depois de `agora` ainda não aconteceram e são ignorados;
 * - sem nenhum lançamento a conta ainda não existe e a barra é tratada como cheia.
 * O máximo é sempre o do plano atual (quem sai do Plus perde o excedente).
 */
export function calcularEnergia(
  lancamentos: readonly Lancamento[],
  agora: Date,
  plano: Plano,
): EstadoEnergia {
  const { max, recargaMinutos } = ENERGIA[plano];
  const intervalo = recargaMinutos * MINUTO;
  const fim = agora.getTime();
  const ordenados = lancamentos
    .filter((l) => l.criadoEm.getTime() <= fim)
    .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());

  const primeiro = ordenados[0];
  if (!primeiro) return { atual: max, max, proximaEm: null };

  let saldo = 0;
  // Instante a partir do qual a recarga conta; null com a barra cheia.
  let abaixoDesde: number | null = primeiro.criadoEm.getTime();

  const recarregarAte = (instante: number) => {
    if (abaixoDesde === null) return;
    const unidades = Math.floor((instante - abaixoDesde) / intervalo);
    const ganho = Math.min(unidades, max - saldo);
    saldo += ganho;
    abaixoDesde = saldo >= max ? null : abaixoDesde + ganho * intervalo;
  };

  for (const lancamento of ordenados) {
    const instante = lancamento.criadoEm.getTime();
    recarregarAte(instante);
    saldo = Math.min(max, Math.max(0, saldo + lancamento.valor));
    if (saldo >= max) abaixoDesde = null;
    else abaixoDesde ??= instante;
  }
  recarregarAte(fim);

  return {
    atual: saldo,
    max,
    proximaEm: abaixoDesde === null ? null : new Date(abaixoDesde + intervalo),
  };
}

/** Custo em energia de uma ação de preço fixo. Campanha: ver custoDaCampanha. */
export function custoDe(acao: AcaoComCusto): number {
  return CUSTOS[acao];
}

/** Há energia para pagar o custo? Custo 0 sempre passa. */
export function podeGastar(estado: Pick<EstadoEnergia, 'atual'>, custo: number): boolean {
  return custo <= 0 || estado.atual >= custo;
}

/**
 * Valor do lançamento de recarga: gemas, debug e marco enchem a barra; anúncio soma 3 sem
 * passar do máximo. Nunca negativo.
 */
export function valorRecarga(
  via: ViaRecarga,
  estado: Pick<EstadoEnergia, 'atual' | 'max'>,
): number {
  const falta = Math.max(0, estado.max - estado.atual);
  return via === 'anuncio' ? Math.min(ANUNCIO.energia, falta) : falta;
}

/** Quantos anúncios ainda rendem energia hoje. */
export function anunciosRestantes(assistidosHoje: number): number {
  return Math.max(0, ANUNCIO.porDia - Math.max(0, Math.floor(assistidosHoje)));
}
