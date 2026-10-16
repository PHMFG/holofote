// Gerador pseudoaleatório determinístico. A semente é uma string (em geral o eventoId), passada
// pelo hash cyrb53 e usada como estado inicial do mulberry32. Mesma semente, mesma sequência.
import type { Rng } from './tipos';

/** Maior valor que o mulberry32 consegue devolver: (2³² − 1) / 2³². */
export const RNG_MAXIMO = (2 ** 32 - 1) / 2 ** 32;

/** Os dois extremos usados pela prévia. O de cima é o teto real do gerador (0,99999999977). */
export const EXTREMOS_PREVIA = [0, RNG_MAXIMO] as const;

/** Hash cyrb53 (53 bits) de uma string. */
export function cyrb53(texto: string, semente = 0): number {
  let h1 = 0xdeadbeef ^ semente;
  let h2 = 0x41c6ce57 ^ semente;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32 a partir de um estado de 32 bits. */
function mulberry32(estadoInicial: number): Rng {
  let estado = estadoInicial >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG determinístico semeado por uma string. Devolve valores em [0, 1). */
export function criarRng(semente: string): Rng {
  const hash = cyrb53(semente);
  // Mistura as duas metades do hash de 53 bits num estado de 32 bits.
  const alto = Math.floor(hash / 4294967296);
  return mulberry32((hash ^ alto) >>> 0);
}

/**
 * RNG que devolve sempre o mesmo valor, limitado a [0, RNG_MAXIMO]. A prévia usa os dois
 * extremos (EXTREMOS_PREVIA) para obter as faixas de cada número.
 */
export function rngFixo(valor: number): Rng {
  const limitado = Math.min(RNG_MAXIMO, Math.max(0, Number.isNaN(valor) ? 0 : valor));
  return () => limitado;
}

/** Inteiro em [min, max], os dois inclusivos. Aceita os limites em qualquer ordem. */
export function inteiroEntre(rng: Rng, min: number, max: number): number {
  const baixo = Math.ceil(Math.min(min, max));
  const alto = Math.floor(Math.max(min, max));
  return baixo + Math.floor(rng() * (alto - baixo + 1));
}

/** Número real em [min, max). */
export function entre(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/**
 * Escolhe um item com probabilidade proporcional ao campo `peso` (pesos negativos contam como 0).
 * Se todos os pesos forem 0, escolhe com chance igual. Lista vazia é erro do chamador.
 */
export function escolherPonderado<T extends { readonly peso: number }>(
  rng: Rng,
  itens: readonly T[],
): T {
  if (itens.length === 0) throw new Error('escolherPonderado: lista vazia');
  const pesos = itens.map((item) => (item.peso > 0 ? item.peso : 0));
  const total = pesos.reduce((soma, peso) => soma + peso, 0);
  if (total <= 0) return itens[inteiroEntre(rng, 0, itens.length - 1)] as T;
  const sorteio = rng() * total;
  let acumulado = 0;
  let ultimoComPeso = 0;
  for (let i = 0; i < itens.length; i++) {
    const peso = pesos[i] as number;
    if (peso === 0) continue;
    acumulado += peso;
    ultimoComPeso = i;
    if (sorteio < acumulado) return itens[i] as T;
  }
  // Só por arredondamento de ponto flutuante: cai no último item com peso.
  return itens[ultimoComPeso] as T;
}

/** Embaralha uma cópia (Fisher-Yates) e devolve os `quantidade` primeiros. */
export function sortearSemRepeticao<T>(rng: Rng, itens: readonly T[], quantidade: number): T[] {
  const copia = [...itens];
  const total = Math.max(0, Math.min(quantidade, copia.length));
  for (let i = 0; i < total; i++) {
    const j = inteiroEntre(rng, i, copia.length - 1);
    const temp = copia[i] as T;
    copia[i] = copia[j] as T;
    copia[j] = temp;
  }
  return copia.slice(0, total);
}
