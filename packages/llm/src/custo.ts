// Preço por milhão de tokens e estimativa de custo de cada chamada.
// No Go a cobrança é a assinatura; estes valores medem o custo equivalente por consumo
// (Console do OpenCode), que é o que o teto diário e o critério dos evals usam.
import type { UsoTokens } from './provedor';

export interface PrecoModelo {
  /** US$ por milhão de tokens de entrada fora do cache. */
  entrada: number;
  /** US$ por milhão de tokens de entrada lidos do cache. */
  cache: number;
  /** US$ por milhão de tokens de saída. */
  saida: number;
  /** true quando o preço não foi conferido numa fonte oficial. */
  estimativa: boolean;
  fonte: string;
}

/**
 * Só o DeepSeek V4.1 Flash tem preço documentado (docs do Console, citado no plano).
 * Os outros são estimativas: a razão entre o limite em dólar e as requisições por 5 h de cada
 * modelo no Go, comparada à do Flash, aplicada ao preço do Flash e arredondada para cima.
 * Cache a 10 % da entrada para todos. Conferir no Console antes de abrir ao público.
 */
export const PRECOS: Record<string, PrecoModelo> = {
  'deepseek-v4.1-flash': {
    entrada: 0.3,
    cache: 0.03,
    saida: 1.2,
    estimativa: false,
    fonte: 'opencode.ai/docs/zen (preço por consumo no Console)',
  },
  'deepseek-v4-pro': {
    entrada: 1.9,
    cache: 0.19,
    saida: 7.5,
    estimativa: true,
    fonte: 'estimativa: US$ 15 / ~1.050 req por 5 h no Go, cerca de 6,2 vezes o Flash',
  },
  'mimo-v2.6-flash': {
    entrada: 0.27,
    cache: 0.027,
    saida: 1.1,
    estimativa: true,
    fonte: 'estimativa: US$ 60 / ~30.100 req por 5 h no Go, cerca de 0,9 vez o Flash',
  },
  'glm-5.3-flash': {
    entrada: 1.25,
    cache: 0.125,
    saida: 5,
    estimativa: true,
    fonte: 'estimativa: US$ 60 / ~6.320 req por 5 h no Go, cerca de 4,1 vezes o Flash',
  },
};

/** Modelo fora da tabela: usa o preço mais caro conhecido, para o teto diário errar para o lado seguro. */
export const PRECO_DESCONHECIDO: PrecoModelo = {
  entrada: 1.9,
  cache: 0.19,
  saida: 7.5,
  estimativa: true,
  fonte: 'modelo fora da tabela: preço do mais caro conhecido',
};

export function precoDoModelo(modelo: string): PrecoModelo {
  return PRECOS[modelo] ?? PRECO_DESCONHECIDO;
}

/** Custo em US$ de uma chamada. `uso.entrada` inclui os tokens de cache. */
export function estimarCusto(modelo: string, uso: UsoTokens): number {
  const preco = precoDoModelo(modelo);
  const cache = Math.min(Math.max(uso.cache, 0), Math.max(uso.entrada, 0));
  const semCache = Math.max(uso.entrada - cache, 0);
  const usd =
    (semCache * preco.entrada + cache * preco.cache + Math.max(uso.saida, 0) * preco.saida) /
    1_000_000;
  // Arredonda em 1e-9 para somas no banco não acumularem ruído de ponto flutuante.
  return Math.round(usd * 1e9) / 1e9;
}
