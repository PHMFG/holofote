import type { FilaSimples } from '../contexto';

/**
 * O que a fila `entrega` publica na hora marcada. "digitando" avisa, pouco antes de uma mensagem
 * ou resposta de personagem chegar, que ele está escrevendo (`id` e `de` apontam para o item).
 */
export interface PedidoEntrega {
  tipo: 'post' | 'mensagem' | 'alerta' | 'digitando';
  id: string;
  mundoId: string;
  de?: 'post' | 'mensagem';
}

/** Quanto antes da mensagem ou resposta o personagem aparece "digitando". */
export const ANTECEDENCIA_DIGITANDO_MS = 6000;

/**
 * Agenda a publicação de um item gravado com `entregarEm` no futuro. O atraso é medido no relógio
 * do mundo (que pode estar adiantado pelo relógio simulado), então recebe o "agora" do mundo.
 */
export async function agendarEntrega(
  fila: FilaSimples,
  pedido: PedidoEntrega,
  entregarEm: Date,
  agoraDoMundo: Date,
) {
  await fila.add('entrega', pedido, {
    jobId: `entrega-${pedido.tipo}-${pedido.id}`,
    delay: Math.max(0, entregarEm.getTime() - agoraDoMundo.getTime()),
    attempts: 3,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  });
}

/**
 * Agenda a entrega e, para mensagem ou post (as respostas), o "digitando" um pouco antes, como
 * quem está escrevendo de verdade. O processador decide se o post é resposta.
 */
export async function agendarEntregaComDigitando(
  fila: FilaSimples,
  pedido: PedidoEntrega,
  entregarEm: Date,
  agoraDoMundo: Date,
) {
  if (pedido.tipo === 'post' || pedido.tipo === 'mensagem') {
    const antes = new Date(
      Math.max(agoraDoMundo.getTime(), entregarEm.getTime() - ANTECEDENCIA_DIGITANDO_MS),
    );
    await agendarEntrega(
      fila,
      { ...pedido, tipo: 'digitando', de: pedido.tipo },
      antes,
      agoraDoMundo,
    );
  }
  await agendarEntrega(fila, pedido, entregarEm, agoraDoMundo);
}
