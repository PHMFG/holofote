// Atributos de 0 a 100 e os multiplicadores que eles aplicam.
import { ATRIBUTO, POLEMICA } from './constantes';
import type { Rng } from './tipos';

/** Limita a [min, max]. */
export function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

/** Arredonda para o inteiro mais próximo, simétrico em torno de zero (−2,5 vira −3) e sem −0. */
export function arredondar(valor: number): number {
  return Math.sign(valor) * Math.round(Math.abs(valor)) || 0;
}

/** Atributo inteiro entre 0 e 100. */
export function limitarAtributo(valor: number): number {
  return limitar(arredondar(valor), ATRIBUTO.min, ATRIBUTO.max);
}

/** Fama multiplica alcance e seguidores ganhos: 1 + fama / 50 (de 1 a 3). */
export function multFama(fama: number): number {
  return 1 + limitar(fama, ATRIBUTO.min, ATRIBUTO.max) / 50;
}

/** Polêmica multiplica o alcance: 1 + polêmica / 100 (de 1 a 2). */
export function multPolemica(polemica: number): number {
  return 1 + limitar(polemica, ATRIBUTO.min, ATRIBUTO.max) / 100;
}

/**
 * Carisma amplia ganhos e amortece perdas de relação.
 * Ganho × (0,7 + carisma / 100); perda × (1,3 − carisma / 100); arredondado.
 */
export function ajustarDeltaRelacao(delta: number, carisma: number): number {
  const c = limitar(carisma, ATRIBUTO.min, ATRIBUTO.max) / 100;
  if (delta > 0) return arredondar(delta * (0.7 + c));
  if (delta < 0) return arredondar(delta * (1.3 - c));
  return 0;
}

/** Polêmica cai 3 pontos por dia inteiro sem provocação, até 0. */
export function decairPolemica(polemica: number, diasSemProvocacao: number): number {
  const dias = Math.max(0, Math.floor(diasSemProvocacao));
  return limitarAtributo(polemica - POLEMICA.decaimentoDia * dias);
}

/** Chance diária de crise: 20 % com polêmica acima de 70, senão 0. */
export function chanceDeCrise(polemica: number): number {
  return polemica > POLEMICA.limiarCrise ? POLEMICA.chanceCriseDia : 0;
}

/** Sorteio diário da crise (o lote chama uma vez por dia). */
export function sortearCrise(polemica: number, rng: Rng): boolean {
  return rng() < chanceDeCrise(polemica);
}
