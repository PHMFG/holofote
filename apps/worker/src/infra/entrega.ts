import type { FilaSimples } from '../contexto';

/** O que a fila `entrega` publica na hora marcada. */
export interface PedidoEntrega {
  tipo: 'post' | 'mensagem' | 'alerta';
  id: string;
  mundoId: string;
}

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
