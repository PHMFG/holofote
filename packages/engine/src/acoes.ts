// Consequências numéricas das ações do jogador. Determinístico dado o RNG: o resultado real usa
// criarRng(eventoId) e a prévia usa rngFixo nos dois extremos.
//
// Ordem fixa dos sorteios de um post (não mudar sem atualizar os testes de reprodutibilidade):
// 1 variação do alcance, 2 taxa de curtidas, 3 taxa de seguidores, 4 polêmica, 5 carisma,
// 6 relação com cada marcado, na ordem em que vieram.
//
// Todos os números são monótonos (não decrescentes) em cada sorteio, então o resultado com
// rngFixo(0) é o mínimo e com rngFixo(RNG_MAXIMO) é o máximo. É isso que garante que a prévia
// sempre contém o resultado real.
import { ajustarDeltaRelacao, limitarAtributo, multFama, multPolemica } from './atributos';
import { CUSTOS } from './constantes';
import { alvoRelacao, aplicarDeltaRelacao, limitarDeltaRelacao } from './relacoes';
import { EXTREMOS_PREVIA, entre, inteiroEntre, rngFixo } from './rng';
import { TONS } from './tom';
import type { Delta, Faixa, Rng, Tom } from './tipos';

/**
 * Parâmetros das fórmulas de post. Desvios da fórmula sugerida na F3 (200 + 0,15 × seguidores,
 * seguidores a 0,2–0,8 % do alcance, fama +1 com 50 seguidores ganhos), que rendia 2 a 9
 * seguidores por post no começo e nunca chegava ao limiar de fama:
 * - alcance base sublinear, 200 + 20 × √seguidores, para o crescimento não explodir com a base;
 * - seguidores ganhos de 1 % a 3 % do alcance (vezes a fama, como no plano);
 * - fama +1 só em post viral (ver limiarViral).
 * Em simulação (2 000 seguidores, fama 20, mistura de tons), 8 posts por dia chegam a 10 mil
 * seguidores em cerca de 9 dias; 20 por dia, em cerca de 3.
 */
export const PARAMETROS_POST = {
  alcanceFixo: 200,
  alcancePorRaizSeguidor: 20,
  variacaoAlcance: [0.85, 1.15],
  taxaCurtidas: [0.04, 0.09],
  taxaSeguidores: [0.01, 0.03],
  viralMinimo: 50,
  viralSobreEsperado: 1.5,
  /** Comentário ou resposta a post alheio alcança 30 % de um post. */
  fatorResposta: 0.3,
  /** Mensagem direta: delta de relação antes do carisma. */
  relacaoDm: [0, 2],
} as const;

export interface NumerosJogador {
  fama: number;
  carisma: number;
  polemica: number;
  seguidores: number;
}

export interface Marcado {
  id: string;
  afinidade: number;
}

export interface EntradaPost {
  jogador: NumerosJogador;
  tom: Tom;
  marcados: readonly Marcado[];
  rng: Rng;
}

export interface ResultadoPost {
  alcance: number;
  curtidasSimuladas: number;
  seguidoresGanhos: number;
  /**
   * Deltas efetivos (já limitados ao que cabe em 0..100), sem os zerados. Inverter estes deltas
   * desfaz a ação exatamente.
   */
  deltas: Delta[];
}

/** Alcance antes do tom, da fama, da polêmica e da variação. */
export function alcanceBase(seguidores: number): number {
  return (
    PARAMETROS_POST.alcanceFixo +
    PARAMETROS_POST.alcancePorRaizSeguidor * Math.sqrt(Math.max(0, seguidores))
  );
}

/**
 * Seguidores ganhos a partir dos quais o post conta como viral e dá +1 de fama: no mínimo 50 e
 * pelo menos 1,5 vez o ganho esperado de um post sincero sem polêmica com a mesma fama e base.
 * Assim a fama sobe por post que se destaca (tom forte, polêmica alta, sorte), não por volume.
 */
export function limiarViral(seguidores: number, fama: number): number {
  const p = PARAMETROS_POST;
  const taxaMedia = (p.taxaSeguidores[0] + p.taxaSeguidores[1]) / 2;
  const esperado = alcanceBase(seguidores) * multFama(fama) ** 2 * taxaMedia;
  return Math.max(p.viralMinimo, Math.round(esperado * p.viralSobreEsperado));
}

function sortearFaixa(rng: Rng, faixa: Faixa): number {
  return inteiroEntre(rng, faixa[0], faixa[1]);
}

function calcular(
  jogador: NumerosJogador,
  tom: Tom,
  marcados: readonly Marcado[],
  fatorAlcance: number,
  rng: Rng,
): ResultadoPost {
  const efeito = TONS[tom];
  const fama = limitarAtributo(jogador.fama);
  const carisma = limitarAtributo(jogador.carisma);
  const polemica = limitarAtributo(jogador.polemica);
  const seguidores = Math.max(0, Math.round(jogador.seguidores));
  const p = PARAMETROS_POST;

  const alcance = Math.round(
    alcanceBase(seguidores) *
      efeito.alcance *
      multFama(fama) *
      multPolemica(polemica) *
      fatorAlcance *
      entre(rng, p.variacaoAlcance[0], p.variacaoAlcance[1]),
  );
  const curtidasSimuladas = Math.round(alcance * entre(rng, p.taxaCurtidas[0], p.taxaCurtidas[1]));
  const seguidoresGanhos = Math.round(
    alcance * entre(rng, p.taxaSeguidores[0], p.taxaSeguidores[1]) * multFama(fama),
  );

  const deltas: Delta[] = [];
  const somar = (delta: Delta) => {
    if (delta.valor !== 0) deltas.push(delta);
  };

  somar({ alvo: 'seguidores', valor: seguidoresGanhos });
  const viral = seguidoresGanhos >= limiarViral(seguidores, fama) ? 1 : 0;
  somar({ alvo: 'fama', valor: limitarAtributo(fama + viral) - fama });
  somar({
    alvo: 'polemica',
    valor: limitarAtributo(polemica + sortearFaixa(rng, efeito.polemica)) - polemica,
  });
  somar({
    alvo: 'carisma',
    valor: limitarAtributo(carisma + sortearFaixa(rng, efeito.carisma)) - carisma,
  });

  const vistos = new Set<string>();
  for (const marcado of marcados) {
    if (vistos.has(marcado.id)) continue;
    vistos.add(marcado.id);
    const bruto = ajustarDeltaRelacao(sortearFaixa(rng, efeito.relacao), carisma);
    const limitado = limitarDeltaRelacao(bruto, 'acao');
    const afinidade = aplicarDeltaRelacao(marcado.afinidade, 0);
    somar({
      alvo: alvoRelacao(marcado.id),
      valor: aplicarDeltaRelacao(afinidade, limitado) - afinidade,
    });
  }

  return { alcance, curtidasSimuladas, seguidoresGanhos, deltas };
}

/** Post do jogador: alcance, curtidas simuladas, seguidores ganhos e deltas. */
export function calcularPost(entrada: EntradaPost): ResultadoPost {
  return calcular(entrada.jogador, entrada.tom, entrada.marcados, 1, entrada.rng);
}

export interface EntradaResposta {
  jogador: NumerosJogador;
  /** Autor do post comentado e a afinidade atual com ele. */
  autor: Marcado;
  rng: Rng;
}

/**
 * Comentário ou resposta a post de outro personagem. Não tem escolha de tom: usa "sincero",
 * alcança 30 % de um post e mexe na relação com o autor.
 */
export function calcularResposta(entrada: EntradaResposta): ResultadoPost {
  return calcular(
    entrada.jogador,
    'sincero',
    [entrada.autor],
    PARAMETROS_POST.fatorResposta,
    entrada.rng,
  );
}

export interface EntradaDm {
  afinidade: number;
  carisma: number;
  rng: Rng;
}

export interface ResultadoDm {
  /** Delta efetivo de relação (0..+2 antes do carisma). */
  delta: number;
  /** Afinidade depois do delta. */
  afinidade: number;
}

/** Mensagem direta (e resposta a história, que vira DM): delta de relação 0..+2 ajustado. */
export function calcularDm(entrada: EntradaDm): ResultadoDm {
  const antes = aplicarDeltaRelacao(entrada.afinidade, 0);
  const bruto = ajustarDeltaRelacao(
    sortearFaixa(entrada.rng, PARAMETROS_POST.relacaoDm),
    entrada.carisma,
  );
  const depois = aplicarDeltaRelacao(antes, limitarDeltaRelacao(bruto, 'acao'));
  return { delta: depois - antes, afinidade: depois };
}

export interface ResultadoPrevia {
  custo: number;
  alcance: Faixa;
  curtidas: Faixa;
  seguidores: Faixa;
  /** Faixa do delta de polêmica do jogador. */
  polemica: Faixa;
  /** Faixa da afinidade final com cada marcado (já com o delta aplicado). */
  relacoes: { id: string; afinidade: Faixa }[];
}

function valorDoDelta(deltas: readonly Delta[], alvo: string): number {
  return deltas.find((d) => d.alvo === alvo)?.valor ?? 0;
}

function faixa(a: number, b: number): Faixa {
  return [Math.min(a, b), Math.max(a, b)];
}

/**
 * Prévia de um rascunho de post (custo 0, sem IA): roda calcularPost com o RNG nos dois
 * extremos e devolve faixas. O resultado real com qualquer semente cai dentro delas.
 */
export function previa(entrada: Omit<EntradaPost, 'rng'>): ResultadoPrevia {
  const [baixo, alto] = EXTREMOS_PREVIA.map((valor) =>
    calcularPost({ ...entrada, rng: rngFixo(valor) }),
  ) as [ResultadoPost, ResultadoPost];

  const vistos = new Set<string>();
  const relacoes: ResultadoPrevia['relacoes'] = [];
  for (const marcado of entrada.marcados) {
    if (vistos.has(marcado.id)) continue;
    vistos.add(marcado.id);
    const alvo = alvoRelacao(marcado.id);
    const antes = aplicarDeltaRelacao(marcado.afinidade, 0);
    relacoes.push({
      id: marcado.id,
      afinidade: faixa(
        antes + valorDoDelta(baixo.deltas, alvo),
        antes + valorDoDelta(alto.deltas, alvo),
      ),
    });
  }

  return {
    // Custo de publicar o rascunho; a prévia em si é grátis (CUSTOS.previa).
    custo: CUSTOS.post,
    alcance: faixa(baixo.alcance, alto.alcance),
    curtidas: faixa(baixo.curtidasSimuladas, alto.curtidasSimuladas),
    seguidores: faixa(baixo.seguidoresGanhos, alto.seguidoresGanhos),
    polemica: faixa(valorDoDelta(baixo.deltas, 'polemica'), valorDoDelta(alto.deltas, 'polemica')),
    relacoes,
  };
}

/** Afinidade final de um alvo depois de aplicar os deltas (útil para servidor e testes). */
export function afinidadeDepois(afinidade: number, deltas: readonly Delta[], id: string): number {
  return aplicarDeltaRelacao(afinidade, valorDoDelta(deltas, alvoRelacao(id)));
}
