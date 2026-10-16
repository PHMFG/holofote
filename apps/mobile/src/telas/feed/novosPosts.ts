import type { EventoTempoReal } from '@holofote/shared';

/**
 * Conta para o aviso "N novos posts": post de primeiro nível (sem respondeA), que não é história
 * e não foi escrito pelo próprio jogador (o dele já entra na lista ao publicar).
 */
export function ehPostNovoDoFeed(evento: EventoTempoReal): boolean {
  return (
    evento.tipo === 'post' &&
    evento.post.respondeA === null &&
    evento.post.tipo === 'post' &&
    evento.post.autor.papel !== 'jogador'
  );
}

export function rotuloNovosPosts(quantidade: number): string {
  return quantidade === 1 ? '1 novo post' : `${quantidade} novos posts`;
}
