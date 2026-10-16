import type { EventoAgendado } from '@holofote/shared';
import { NOME_PERIODO } from '../../tempo';

export type OpcaoDiscurso = EventoAgendado['discurso'][number]['id'];

/** Chance do motor (0 a 1) em porcentagem inteira: "34%". */
export function porcentagem(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}

/** "Dia 8, noite". */
export function quandoTexto(quando: EventoAgendado['quando']): string {
  return `Dia ${quando.dia}, ${NOME_PERIODO[quando.periodo]}`;
}

/** Contagem pelo dia atual do mundo: "Faltam 2 dias", "Amanhã", "Hoje", "Ao vivo agora". */
export function contagem(evento: EventoAgendado, diaDoMundo: number | undefined): string {
  if (evento.estado === 'ao_vivo') return 'Ao vivo agora';
  if (evento.estado === 'encerrado') return 'Encerrado';
  if (diaDoMundo === undefined) return 'Em breve';
  const faltam = evento.quando.dia - diaDoMundo;
  if (faltam <= 0) return 'Hoje';
  if (faltam === 1) return 'Amanhã';
  return `Faltam ${faltam} dias`;
}
