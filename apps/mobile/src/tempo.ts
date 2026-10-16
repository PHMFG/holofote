// Tempo das telas: relógio compartilhado, tempos relativos, dia do mundo e hora local.
// O dia do mundo acompanha o dia real no fuso do jogador (docs/PLANO.md, "Tempo"), então "Dia 5"
// sai do dia atual do mundo menos os dias de calendário passados desde o instante.
import type { Periodo } from '@holofote/shared';
import { useEffect, useState } from 'react';

export const MINUTO = 60_000;
export const HORA = 60 * MINUTO;
export const DIA = 24 * HORA;

/** Nome do período do mundo como aparece nas telas (02 · Feed: "noite"). */
export const NOME_PERIODO: Record<Periodo, string> = {
  manha: 'manhã',
  tarde: 'tarde',
  noite: 'noite',
};

/** "Agora" da tela, atualizado a cada intervalo: tempos relativos, expiração e contagens. */
export function useAgora(intervaloMs = 30_000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

/** Dias de calendário, no fuso do aparelho, entre duas datas (0 = mesmo dia). */
export function diasEntre(de: Date, ate: Date): number {
  const inicio = new Date(de.getFullYear(), de.getMonth(), de.getDate()).getTime();
  const fim = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate()).getTime();
  return Math.round((fim - inicio) / DIA);
}

/** Dia do mundo em que o instante caiu; sem o mundo carregado, devolve undefined. */
export function diaDoMundo(
  iso: string,
  diaAtual: number | undefined,
  agora: number = Date.now(),
): number | undefined {
  if (diaAtual === undefined) return undefined;
  return Math.max(1, diaAtual - diasEntre(new Date(iso), new Date(agora)));
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** "21:40" no fuso do aparelho. */
export function horaMinuto(iso: string): string {
  const data = new Date(iso);
  return `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
}

/** "Dia 5", ou "ontem" e "há 3 dias" enquanto o mundo não carregou. */
function diaPassado(iso: string, diaAtual: number | undefined, agora: number): string {
  const dia = diaDoMundo(iso, diaAtual, agora);
  if (dia !== undefined) return `Dia ${dia}`;
  const dias = diasEntre(new Date(iso), new Date(agora));
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

/**
 * Tempo desde um instante, num contrato só (posts, respostas, alertas, histórias): "agora",
 * "12 min" e "2 h" até 24 h. Depois disso, "Dia 5" quando o dia do mundo é conhecido; sem ele,
 * "3 d" até uma semana e a data ("09/10") além disso. `agora` em milissegundos (useAgora).
 */
export function tempoRelativo(iso: string, agora: number, diaAtual?: number): string {
  const passou = Math.max(0, agora - Date.parse(iso));
  if (passou < MINUTO) return 'agora';
  if (passou < HORA) return `${Math.floor(passou / MINUTO)} min`;
  if (passou < DIA) return `${Math.floor(passou / HORA)} h`;
  if (diaAtual !== undefined) return `Dia ${diaDoMundo(iso, diaAtual, agora)}`;
  if (passou < 7 * DIA) return `${Math.floor(passou / DIA)} d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/** "há 2 min" ou "agora", para cabeçalhos de cartão. */
export function haQuanto(iso: string, agora: number): string {
  const tempo = tempoRelativo(iso, agora);
  return tempo === 'agora' || Math.max(0, agora - Date.parse(iso)) >= 7 * DIA
    ? tempo
    : `há ${tempo}`;
}

/** Lista de conversas e post original: "agora", "21:40" no mesmo dia e "Dia 5" antes. */
export function horaCurta(iso: string, agora: number, diaAtual?: number): string {
  if (agora - Date.parse(iso) < MINUTO) return 'agora';
  if (diasEntre(new Date(iso), new Date(agora)) === 0) return horaMinuto(iso);
  return diaPassado(iso, diaAtual, agora);
}
