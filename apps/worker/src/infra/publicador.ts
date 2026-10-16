import { canalDoMundo, EventoTempoReal } from '@holofote/shared';
import type { Redis } from 'ioredis';

/** Publica um evento de tempo real no canal do mundo; a API repassa pelo WebSocket. */
export async function publicar(
  redis: Redis,
  mundoId: string,
  evento: EventoTempoReal,
): Promise<void> {
  // Valida antes de sair do worker: o app descarta eventos fora do contrato.
  await redis.publish(canalDoMundo(mundoId), JSON.stringify(EventoTempoReal.parse(evento)));
}

/**
 * Publica sem derrubar o job: para o que roda depois do commit (cartão, digitando). Se o Redis
 * falhar, o app vê o resultado na próxima leitura.
 */
export async function publicarSemFalha(
  ctx: { redis: Redis; log: { warn(objeto: object, mensagem?: string): void } },
  mundoId: string,
  evento: EventoTempoReal,
): Promise<void> {
  try {
    await publicar(ctx.redis, mundoId, evento);
  } catch (erro) {
    ctx.log.warn(
      { mundoId, tipo: evento.tipo, erro: (erro as Error).message },
      'tempo real não publicado',
    );
  }
}
