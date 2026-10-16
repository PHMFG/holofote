// Desfazer a última ação: até 60 minutos, custa 2, sem nova chamada de IA.
import { DESFAZER } from './constantes';
import type { Delta, Rng } from './tipos';

export interface EntradaDesfazer {
  criadaEm: Date;
  agora: Date;
  ehUltimaAcao: boolean;
  jaDesfeita: boolean;
}

/** Códigos estáveis; o servidor devolve `desfazer_expirado` no contrato de erro. */
export type MotivoNaoDesfaz = 'ja_desfeita' | 'nao_e_ultima' | 'desfazer_expirado';

export type ResultadoDesfazer = { ok: true } | { ok: false; motivo: MotivoNaoDesfaz };

/** Instante até o qual a ação pode ser desfeita (Consequencia.desfazivelAte). */
export function desfazivelAte(criadaEm: Date): Date {
  return new Date(criadaEm.getTime() + DESFAZER.janelaMinutos * 60_000);
}

/** Só a última ação, ainda não desfeita, até 60 minutos depois (inclusive). */
export function podeDesfazer(entrada: EntradaDesfazer): ResultadoDesfazer {
  if (entrada.jaDesfeita) return { ok: false, motivo: 'ja_desfeita' };
  if (!entrada.ehUltimaAcao) return { ok: false, motivo: 'nao_e_ultima' };
  if (entrada.agora.getTime() > desfazivelAte(entrada.criadaEm).getTime()) {
    return { ok: false, motivo: 'desfazer_expirado' };
  }
  return { ok: true };
}

/** Deltas com o sinal trocado, para reverter uma ação. */
export function inverterDeltas(deltas: readonly Delta[]): Delta[] {
  return deltas.map((d) => ({ alvo: d.alvo, valor: -d.valor || 0 }));
}

export interface EntradaLembra {
  afinidade: number;
  perfilFofoca: boolean;
  rng: Rng;
}

/**
 * O personagem "lembra" que o post foi apagado (vira memória)? 25 % de chance para afinidade
 * abaixo de 45 ou perfil de fofoca; os demais nunca lembram e não consomem o RNG.
 */
export function lembraDoDesfazer(entrada: EntradaLembra): boolean {
  const elegivel = entrada.afinidade < DESFAZER.afinidadeLembra || entrada.perfilFofoca;
  return elegivel && entrada.rng() < DESFAZER.chanceLembrar;
}
