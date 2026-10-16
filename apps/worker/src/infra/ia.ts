// Ponte entre os jobs e o roteador de @holofote/llm: teto diário lido de chamada_llm e cada
// chamada gravada lá (custo, tokens, latência), ligada à ação do jogador quando houver.
import { chamadaLlm, gte, sql, type Db, type LinhaMundo } from '@holofote/db';
import {
  chamarJob,
  type ChamadaLlm,
  type EntradasJobs,
  type IdsPermitidos,
  type NomeJob,
  type ResultadoJob,
} from '@holofote/llm';
import type { ContextoWorker } from '../contexto';
import { erroParaLog } from './erros';

/** Início do dia em UTC: o teto diário vira à meia-noite UTC. */
export function inicioDoDiaUtc(agora: Date): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

/** Soma do custo de IA do dia (todas as contas: o teto é do servidor). */
export async function gastoHojeUsd(db: Db, agora: Date): Promise<number> {
  const [linha] = await db
    .select({ total: sql<number>`coalesce(sum(${chamadaLlm.custoUsd}), 0)::float` })
    .from(chamadaLlm)
    .where(gte(chamadaLlm.criadoEm, inicioDoDiaUtc(agora)));
  return linha?.total ?? 0;
}

async function registrarChamada(
  ctx: ContextoWorker,
  chamada: ChamadaLlm,
  acaoId: string | null,
): Promise<void> {
  try {
    await ctx.db.insert(chamadaLlm).values({
      mundoId: chamada.mundoId,
      acaoId,
      job: chamada.job,
      modelo: chamada.modelo,
      tokensEntrada: chamada.tokensEntrada,
      tokensCache: chamada.tokensCache,
      tokensSaida: chamada.tokensSaida,
      custoUsd: chamada.custoUsd,
      latenciaMs: chamada.latenciaMs,
      ok: chamada.ok,
      erro: chamada.erro,
      criadoEm: ctx.agoraReal(),
    });
  } catch (erro) {
    // O mundo pode ter sido apagado no meio da chamada; o custo ainda aparece no log.
    ctx.log.warn(
      { job: chamada.job, custoUsd: chamada.custoUsd, ...erroParaLog(erro) },
      'chamada de IA não gravada',
    );
  }
}

export interface PedidoIa<J extends NomeJob> {
  job: J;
  mundo: LinhaMundo;
  entrada: EntradasJobs[J];
  acaoId?: string | null;
  idsValidos?: IdsPermitidos | string[];
}

/** Chama a IA para um job do mundo. Erros tipados (ErroLlm) sobem para a política da fila. */
export async function gerar<J extends NomeJob>(
  ctx: ContextoWorker,
  pedido: PedidoIa<J>,
): Promise<ResultadoJob<J>> {
  return chamarJob({
    job: pedido.job,
    mundoId: pedido.mundo.id,
    biblia: pedido.job === 'criar_mundo' ? null : pedido.mundo.biblia,
    entrada: pedido.entrada,
    provedor: ctx.provedor,
    config: ctx.llm,
    gastoHojeUsd: () => gastoHojeUsd(ctx.db, ctx.agoraReal()),
    registrar: (c) => registrarChamada(ctx, c, pedido.acaoId ?? null),
    idsValidos: pedido.idsValidos,
  });
}
