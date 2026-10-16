// Eventos agendados: campanha, chances dos indicados, sorteio do vencedor e discurso ao vivo.
import { GEMAS } from './constantes';
import { alvoRelacao, limitarDeltaRelacao } from './relacoes';
import { escolherPonderado, inteiroEntre } from './rng';
import type { Delta, Rng } from './tipos';

export type EfeitoCampanha = { tipo: 'liberaOusado' } | { tipo: 'bonus'; valor: number };

export interface AcaoCampanha {
  id: string;
  /** Rótulo curto de interface. A descrição longa, se houver, vem da IA. */
  rotulo: string;
  custo: 1 | 2;
  /** Ações que geram post chamam a IA (por isso custam 2). */
  geraPost: boolean;
  efeito: EfeitoCampanha;
}

/**
 * Catálogo das ações de campanha. O bônus soma pontos ao peso do jogador no sorteio (a mesma
 * escala da base, de 0 a 100), antes da normalização. Cada ação vale uma vez por evento.
 */
export const CATALOGO_CAMPANHA: readonly AcaoCampanha[] = [
  {
    id: 'ensaiar',
    rotulo: 'Ensaiar o discurso',
    custo: 1,
    geraPost: false,
    efeito: { tipo: 'liberaOusado' },
  },
  {
    id: 'pedir_votos',
    rotulo: 'Pedir votos aos fãs',
    custo: 1,
    geraPost: false,
    efeito: { tipo: 'bonus', valor: 6 },
  },
  {
    id: 'bastidores',
    rotulo: 'Postar bastidores',
    custo: 2,
    geraPost: true,
    efeito: { tipo: 'bonus', valor: 10 },
  },
  {
    id: 'entrevista',
    rotulo: 'Dar entrevista',
    custo: 2,
    geraPost: true,
    efeito: { tipo: 'bonus', valor: 12 },
  },
];

/** Ação de campanha pelo id, ou undefined. */
export function acaoDeCampanha(id: string): AcaoCampanha | undefined {
  return CATALOGO_CAMPANHA.find((a) => a.id === id);
}

/** Custo em energia de uma ação de campanha (1 ou 2), ou null se o id não existe. */
export function custoDaCampanha(id: string): number | null {
  return acaoDeCampanha(id)?.custo ?? null;
}

/** Soma dos bônus das ações feitas (cada id conta uma vez; ids desconhecidos valem 0). */
export function bonusDaCampanha(feitas: readonly string[]): number {
  return [...new Set(feitas)].reduce((soma, id) => {
    const efeito = acaoDeCampanha(id)?.efeito;
    return soma + (efeito?.tipo === 'bonus' ? efeito.valor : 0);
  }, 0);
}

/** O jogador ensaiou (libera o discurso ousado)? */
export function ensaiou(feitas: readonly string[]): boolean {
  return feitas.some((id) => acaoDeCampanha(id)?.efeito.tipo === 'liberaOusado');
}

/** Base de um indicado no sorteio: fama; para o jogador, média de fama e carisma. */
export function baseIndicado(
  numeros: { fama: number; carisma: number },
  ehJogador: boolean,
): number {
  return ehJogador ? (numeros.fama + numeros.carisma) / 2 : numeros.fama;
}

/** Peso mínimo de qualquer indicado, para ninguém ficar com chance zero. */
export const PESO_MINIMO_INDICADO = 1;

export interface Chance {
  id: string;
  /** De 0 a 1; a soma de todas dá 1. */
  chance: number;
}

/**
 * Chance de cada indicado: peso = base (+ bônus de campanha no jogador), com piso de 1,
 * normalizado para somar 1. Mantém a ordem da entrada.
 */
export function chancesIndicados(
  indicados: readonly { id: string; base: number }[],
  bonusJogador: number,
  jogadorId: string,
): Chance[] {
  const pesos = indicados.map((i) =>
    Math.max(PESO_MINIMO_INDICADO, i.base + (i.id === jogadorId ? bonusJogador : 0)),
  );
  const total = pesos.reduce((soma, p) => soma + p, 0);
  return indicados.map((i, k) => ({ id: i.id, chance: (pesos[k] as number) / total }));
}

/** Sorteio ponderado do vencedor pelas chances. */
export function sortearVencedor(chances: readonly Chance[], rng: Rng): string {
  return escolherPonderado(
    rng,
    chances.map((c) => ({ id: c.id, peso: c.chance })),
  ).id;
}

export type OpcaoDiscurso = 'seguro' | 'ousado' | 'especial';

export type MotivoDiscursoBloqueado = 'precisa_ensaiar' | 'precisa_marco';

export interface OpcaoDiscursoEstado {
  id: OpcaoDiscurso;
  /** Rótulo curto de interface; o texto do discurso vem da IA. */
  rotulo: string;
  liberada: boolean;
  motivo: MotivoDiscursoBloqueado | null;
}

/** As três opções do ao vivo: seguro sempre, ousado se ensaiou, especial se cumpriu o marco. */
export function opcoesDiscurso(entrada: {
  ensaiou: boolean;
  marcoEspecialCumprido: boolean;
}): OpcaoDiscursoEstado[] {
  return [
    { id: 'seguro', rotulo: 'Seguro', liberada: true, motivo: null },
    {
      id: 'ousado',
      rotulo: 'Ousado',
      liberada: entrada.ensaiou,
      motivo: entrada.ensaiou ? null : 'precisa_ensaiar',
    },
    {
      id: 'especial',
      rotulo: 'Especial',
      liberada: entrada.marcoEspecialCumprido,
      motivo: entrada.marcoEspecialCumprido ? null : 'precisa_marco',
    },
  ];
}

/** Faixas de efeito de cada discurso (inteiros, inclusivo). */
export const EFEITOS_DISCURSO = {
  seguro: { fama: [1, 2] },
  ousado: { fama: [2, 5], polemica: [3, 6] },
  especial: { fama: [4, 8], relacaoAliados: [2, 4] },
} as const;

export interface ResultadoDiscurso {
  /** Deltas brutos: o servidor aplica com limitarAtributo e aplicarDeltaRelacao. */
  deltas: Delta[];
  gemas: number;
}

/**
 * Efeitos do discurso escolhido. Seguro: fama +1..2. Ousado: fama +2..5 e polêmica +3..6.
 * Especial: fama +4..8 e relação +2..4 com cada aliado (limitada a ±12, contexto de evento).
 * Gemas: 10 a 40 se venceu, senão 0. Ordem dos sorteios: fama, polêmica, aliados, gemas.
 */
export function efeitosDiscurso(
  opcao: OpcaoDiscurso,
  venceu: boolean,
  rng: Rng,
  aliados: readonly string[] = [],
): ResultadoDiscurso {
  const deltas: Delta[] = [];
  const faixas = EFEITOS_DISCURSO[opcao];
  deltas.push({ alvo: 'fama', valor: inteiroEntre(rng, faixas.fama[0], faixas.fama[1]) });
  if ('polemica' in faixas) {
    deltas.push({
      alvo: 'polemica',
      valor: inteiroEntre(rng, faixas.polemica[0], faixas.polemica[1]),
    });
  }
  if ('relacaoAliados' in faixas) {
    for (const id of new Set(aliados)) {
      const bruto = inteiroEntre(rng, faixas.relacaoAliados[0], faixas.relacaoAliados[1]);
      deltas.push({ alvo: alvoRelacao(id), valor: limitarDeltaRelacao(bruto, 'evento') });
    }
  }
  const gemas = venceu ? inteiroEntre(rng, GEMAS.evento.min, GEMAS.evento.max) : 0;
  return { deltas, gemas };
}
