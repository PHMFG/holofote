// Ajustes de relação que a IA sugere (reação, DM, discurso). O motor manda: cada sugestão é
// limitada, somada ao que o motor já aplicou na ação e cortada no teto da ação (±8) ou do
// evento (±12). Fica gravada na tabela delta para o desfazer inverter.
import {
  and,
  delta as tabelaDelta,
  eq,
  memoria,
  relacao,
  sql,
  type Db,
  type LinhaPersonagem,
} from '@holofote/db';
import {
  alvoRelacao,
  aplicarDeltaRelacao,
  limitarDeltaRelacao,
  rotuloRelacao,
  type ContextoDelta,
} from '@holofote/engine';

/** Transação do Drizzle aberta por db.transaction. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Executor = Db | Tx;

/** Quanto uma sugestão da IA pode mexer sozinha numa relação. */
export const TETO_SUGESTAO = 3;

export function vinculoDoRotulo(tipo: LinhaPersonagem['tipoVinculo']): 'amizade' | 'parceria' {
  return tipo === 'parceria' || tipo === 'mentor' ? 'parceria' : 'amizade';
}

/**
 * Aplica a sugestão da IA à relação do jogador com `outro` dentro da ação `acaoId`.
 * Devolve o valor efetivamente aplicado (0 se nada mudou).
 */
export async function aplicarSugestaoDeRelacao(
  tx: Executor,
  acaoId: string,
  jogadorId: string,
  outro: LinhaPersonagem,
  sugestao: number,
  contexto: ContextoDelta = 'acao',
): Promise<number> {
  const pedido = Math.max(-TETO_SUGESTAO, Math.min(TETO_SUGESTAO, Math.round(sugestao)));
  if (pedido === 0) return 0;
  const alvo = alvoRelacao(outro.id);
  const [ja] = await tx
    .select({ total: sql<number>`coalesce(sum(${tabelaDelta.valor}), 0)::int` })
    .from(tabelaDelta)
    .where(and(eq(tabelaDelta.acaoId, acaoId), eq(tabelaDelta.alvo, alvo)));
  const anterior = ja?.total ?? 0;
  const valor = limitarDeltaRelacao(anterior + pedido, contexto) - anterior;
  if (valor === 0) return 0;

  // Trava a relação: a API (ações e desfazer) mexe na mesma linha.
  const [rel] = await tx
    .select()
    .from(relacao)
    .where(and(eq(relacao.deId, jogadorId), eq(relacao.paraId, outro.id)))
    .for('update');
  if (!rel) return 0;
  const afinidade = aplicarDeltaRelacao(rel.afinidade, valor);
  const efetivo = afinidade - rel.afinidade;
  if (efetivo === 0) return 0;
  await tx
    .update(relacao)
    .set({ afinidade, rotulo: rotuloRelacao(afinidade, vinculoDoRotulo(outro.tipoVinculo)) })
    .where(and(eq(relacao.deId, jogadorId), eq(relacao.paraId, outro.id)));
  await tx.insert(tabelaDelta).values({ acaoId, alvo, valor: efetivo });
  return efetivo;
}

/** Fatos guardados por par (os mais recentes); o lote diário resume quando passa disso. */
export const MAX_FATOS = 12;

/**
 * Acrescenta um fato ao que `personagemId` lembra de `sobreId` ("Dia 6 · elogiou o refrão"). A
 * linha é criada se não existe e, se existe, relida com trava antes de acrescentar: dois jobs ao
 * mesmo tempo não perdem um fato.
 */
export async function lembrar(
  tx: Executor,
  personagemId: string,
  sobreId: string,
  fato: string,
  dia: number,
): Promise<void> {
  const linha = `Dia ${dia} · ${fato.trim()}`;
  const criada = await tx
    .insert(memoria)
    .values({ personagemId, sobreId, fatos: linha, dia })
    .onConflictDoNothing({ target: [memoria.personagemId, memoria.sobreId] })
    .returning({ id: memoria.id });
  if (criada.length > 0) return;
  const [atual] = await tx
    .select()
    .from(memoria)
    .where(and(eq(memoria.personagemId, personagemId), eq(memoria.sobreId, sobreId)))
    .for('update');
  if (!atual) return;
  const fatos = [...atual.fatos.split('\n').filter(Boolean), linha].slice(-MAX_FATOS);
  await tx
    .update(memoria)
    .set({ fatos: fatos.join('\n'), dia, atualizadoEm: new Date() })
    .where(eq(memoria.id, atual.id));
}
