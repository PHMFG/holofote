import {
  acao,
  alerta,
  alertaDto,
  and,
  conversa,
  eq,
  isNull,
  mensagem,
  mensagemDto,
  mundo,
  personagem,
  post,
  postDto,
  sql,
  type Db,
} from '@holofote/db';
import type { Redis } from 'ioredis';
import type { PedidoEntrega } from '../infra/entrega';
import { publicar } from '../infra/publicador';

async function jogadorDoMundo(db: Db, mundoId: string) {
  const [j] = await db
    .select()
    .from(personagem)
    .where(and(eq(personagem.mundoId, mundoId), eq(personagem.papel, 'jogador')));
  return j ?? null;
}

/**
 * Publica no canal do mundo o item que chegou na hora. Itens ocultos (desfeitos) ou apagados
 * não saem; mensagem de personagem conta como não lida. O contador sobe uma vez só: a linha ganha
 * `entregueEm` na mesma transação, e uma repetição do job (o Redis caiu depois) só republica.
 */
export async function processarEntrega(db: Db, redis: Redis, pedido: PedidoEntrega): Promise<void> {
  const [m] = await db.select({ id: mundo.id }).from(mundo).where(eq(mundo.id, pedido.mundoId));
  const jogador = m ? await jogadorDoMundo(db, pedido.mundoId) : null;
  if (!jogador) return;

  if (pedido.tipo === 'post') {
    const p = await db.transaction(async (tx) => {
      const [marcado] = await tx
        .update(post)
        .set({ entregueEm: new Date() })
        .where(and(eq(post.id, pedido.id), isNull(post.entregueEm), eq(post.oculto, false)))
        .returning();
      // O contador de respostas do post original sobe quando a resposta aparece.
      if (marcado?.respondeA) {
        await tx
          .update(post)
          .set({ respostas: sql`${post.respostas} + 1` })
          .where(eq(post.id, marcado.respondeA));
      }
      if (marcado) return marcado;
      const [ja] = await tx.select().from(post).where(eq(post.id, pedido.id));
      return ja && !ja.oculto ? ja : null;
    });
    if (!p) return;
    await publicar(redis, pedido.mundoId, { tipo: 'post', post: await postDto(db, p, jogador.id) });
    return;
  }
  if (pedido.tipo === 'mensagem') {
    const msg = await db.transaction(async (tx) => {
      const [marcada] = await tx
        .update(mensagem)
        .set({ entregueEm: new Date() })
        .where(
          and(eq(mensagem.id, pedido.id), isNull(mensagem.entregueEm), eq(mensagem.oculto, false)),
        )
        .returning();
      if (marcada && marcada.autorId !== jogador.id) {
        await tx
          .update(conversa)
          .set({ naoLidas: sql`${conversa.naoLidas} + 1`, atualizadaEm: marcada.entregarEm })
          .where(eq(conversa.id, marcada.conversaId));
      }
      if (marcada) return marcada;
      const [ja] = await tx.select().from(mensagem).where(eq(mensagem.id, pedido.id));
      return ja && !ja.oculto ? ja : null;
    });
    if (!msg) return;
    await publicar(redis, pedido.mundoId, {
      tipo: 'mensagem',
      mensagem: mensagemDto(msg, jogador.id),
    });
    return;
  }
  const [linha] = await db
    .select({ alerta, desfeitaEm: acao.desfeitaEm })
    .from(alerta)
    .leftJoin(acao, eq(acao.id, alerta.acaoId))
    .where(eq(alerta.id, pedido.id));
  // Alerta de uma ação desfeita não sai (o desfazer já apagou os futuros e marcou os outros).
  if (!linha || linha.desfeitaEm) return;
  const a = linha.alerta;
  const [autor] = a.personagemId
    ? await db.select().from(personagem).where(eq(personagem.id, a.personagemId))
    : [];
  await publicar(redis, pedido.mundoId, { tipo: 'alerta', alerta: alertaDto(a, autor ?? null) });
}
