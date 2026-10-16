// Relações: afinidade de 0 a 100, rótulo por faixa e limites de delta.
import { arredondar, limitar } from './atributos';
import { AFINIDADE, FAIXAS_RELACAO, LIMITE_DELTA_RELACAO } from './constantes';
import type { AlvoDelta } from './tipos';

/** Tipo do vínculo que decide o rótulo da faixa 60–79. */
export type VinculoRotulo = 'amizade' | 'parceria';

export type RotuloRelacao =
  'Rival' | 'Rivais com respeito' | 'Conhecidos' | 'Amizade' | 'Parceria' | 'Aliança';

export type ContextoDelta = 'acao' | 'evento';

/** Rótulo da faixa de afinidade: Rival, Rivais com respeito, Conhecidos, Amizade/Parceria, Aliança. */
export function rotuloRelacao(afinidade: number, tipoVinculo: VinculoRotulo): RotuloRelacao {
  const valor = limitar(Math.floor(afinidade), AFINIDADE.min, AFINIDADE.max);
  const faixa = FAIXAS_RELACAO.find((f) => valor <= f.max) ?? FAIXAS_RELACAO[4];
  if (faixa.rotulo === 'vinculo') return tipoVinculo === 'parceria' ? 'Parceria' : 'Amizade';
  return faixa.rotulo;
}

/** Limita um delta de relação a ±8 (ação) ou ±12 (evento), em inteiro. */
export function limitarDeltaRelacao(valor: number, contexto: ContextoDelta): number {
  const teto = LIMITE_DELTA_RELACAO[contexto];
  return limitar(arredondar(valor), -teto, teto);
}

/** Aplica um delta à afinidade, mantendo 0..100. */
export function aplicarDeltaRelacao(afinidade: number, delta: number): number {
  return limitar(arredondar(afinidade + delta), AFINIDADE.min, AFINIDADE.max);
}

/** Alvo de delta para a relação com um personagem: "relacao:<id>". */
export function alvoRelacao(personagemId: string): AlvoDelta {
  return `relacao:${personagemId}`;
}

/** Id do personagem num alvo "relacao:<id>", ou null se o alvo for um atributo. */
export function idDoAlvoRelacao(alvo: string): string | null {
  return alvo.startsWith('relacao:') ? alvo.slice('relacao:'.length) : null;
}
