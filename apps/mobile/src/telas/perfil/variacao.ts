import type { ItemRegistro, PersonagemResumo, Relacao } from '@holofote/shared';
import { ehHoje } from '../registro/dias';

/**
 * Variação de hoje por alvo ("fama", "relacao:<id>"), somando os deltas das ações do registro.
 * Uma ação desfeita e o desfazer dela trazem deltas opostos e se anulam na soma.
 * Sem registro carregado, devolve undefined (a tela esconde a variação).
 */
export function variacaoDeHoje(
  itens: readonly ItemRegistro[] | undefined,
  agora: number,
): ReadonlyMap<string, number> | undefined {
  if (!itens) return undefined;
  const soma = new Map<string, number>();
  for (const item of itens) {
    if (!ehHoje(item.criadoEm, agora)) continue;
    for (const d of item.deltas) soma.set(d.alvo, (soma.get(d.alvo) ?? 0) + d.valor);
  }
  return soma;
}

interface No {
  personagem: PersonagemResumo;
  relacao: Relacao;
}

/** Relações do perfil (05): até 3, elenco antes de figurantes, na ordem da API (mais próximo antes). */
export function relacoesPrincipais<T extends No>(nos: readonly T[], limite = 3): T[] {
  const elenco = nos.filter((n) => n.personagem.papel === 'elenco');
  const outros = nos.filter((n) => n.personagem.papel !== 'elenco');
  return [...elenco, ...outros].slice(0, limite);
}
