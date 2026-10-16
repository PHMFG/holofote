// A ação do jogador vista pelos jobs de IA (diretor, dm, discurso): trava dentro da transação e
// retomada das entregas quando o job se repete depois do commit.
import {
  acao as tabelaAcao,
  alerta,
  and,
  eq,
  gt,
  isNull,
  mensagem,
  ne,
  post,
  type LinhaAcao,
} from '@holofote/db';
import type { EventoTempoReal } from '@holofote/shared';
import type { ContextoWorker } from '../contexto';
import type { Cena } from './cena';
import { agendarEntregas, type Entrega } from './feed';
import { publicarSemFalha } from './publicador';
import type { Executor } from './relacoes';

/** Ação que ainda existe e não foi desfeita (pendente ou já atendida). */
export async function acaoViva(ctx: ContextoWorker, acaoId: string): Promise<LinhaAcao | null> {
  const [a] = await ctx.db.select().from(tabelaAcao).where(eq(tabelaAcao.id, acaoId));
  return a && !a.desfeitaEm ? a : null;
}

/**
 * Trava a linha da ação até o fim da transação do worker (o desfazer trava a mesma linha) e
 * confere que ainda espera a IA. Null se foi desfeita ou já atendida: o job não grava nada.
 */
export async function travarAcaoPendente(tx: Executor, acaoId: string): Promise<LinhaAcao | null> {
  const [a] = await tx.select().from(tabelaAcao).where(eq(tabelaAcao.id, acaoId)).for('update');
  return a && !a.desfeitaEm && a.iaPendente > 0 ? a : null;
}

/**
 * O job se repetiu depois do commit (o agendamento das entregas falhou): reagenda o que a ação já
 * gravou e a fila ainda não entregou, e republica o cartão. Os jobIds das entregas são
 * determinísticos e a entrega marca a linha, então repetir não duplica nada.
 */
export async function retomarEntregas(
  ctx: ContextoWorker,
  cena: Cena,
  a: LinhaAcao,
): Promise<void> {
  const mundoId = cena.mundo.id;
  const posts = await ctx.db
    .select({ id: post.id, entregarEm: post.entregarEm })
    .from(post)
    .where(
      and(
        eq(post.acaoId, a.id),
        ne(post.autorId, cena.jogador.id),
        eq(post.oculto, false),
        isNull(post.entregueEm),
      ),
    );
  const mensagens = await ctx.db
    .select({ id: mensagem.id, entregarEm: mensagem.entregarEm })
    .from(mensagem)
    .where(
      and(
        eq(mensagem.acaoId, a.id),
        ne(mensagem.autorId, cena.jogador.id),
        eq(mensagem.oculto, false),
        isNull(mensagem.entregueEm),
      ),
    );
  const alertas = await ctx.db
    .select({ id: alerta.id, entregarEm: alerta.entregarEm })
    .from(alerta)
    .where(and(eq(alerta.acaoId, a.id), isNull(alerta.lidoEm), gt(alerta.entregarEm, cena.agora)));
  const entregas: Entrega[] = [
    ...posts.map((p) => ({
      pedido: { tipo: 'post' as const, id: p.id, mundoId },
      entregarEm: p.entregarEm,
    })),
    ...mensagens.map((m) => ({
      pedido: { tipo: 'mensagem' as const, id: m.id, mundoId },
      entregarEm: m.entregarEm,
    })),
    ...alertas.map((x) => ({
      pedido: { tipo: 'alerta' as const, id: x.id, mundoId },
      entregarEm: x.entregarEm,
    })),
  ];
  await agendarEntregas(ctx, cena, entregas);
  if (a.cartao) {
    const evento: EventoTempoReal = { tipo: 'cartao', eventoId: a.id, cartao: a.cartao };
    await publicarSemFalha(ctx, mundoId, evento);
  }
}
