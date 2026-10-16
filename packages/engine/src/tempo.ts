// Tempo do mundo no fuso do jogador. A hora sempre entra por parâmetro (relógio simulado em dev).
import { PERIODOS } from './constantes';
import type { Periodo } from './tipos';

const DIA_MS = 86_400_000;

export interface DataLocal {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
}

// Cache de formatadores por fuso: criar Intl.DateTimeFormat é caro e o resultado não muda.
const formatadores = new Map<string, Intl.DateTimeFormat>();

function formatador(fusoIana: string): Intl.DateTimeFormat {
  let f = formatadores.get(fusoIana);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: fusoIana,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      hourCycle: 'h23',
    });
    formatadores.set(fusoIana, f);
  }
  return f;
}

/** Ano, mês, dia e hora locais de um instante num fuso IANA. Fuso inválido lança RangeError. */
export function dataLocal(data: Date, fusoIana: string): DataLocal {
  const partes = formatador(fusoIana).formatToParts(data);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((p) => p.type === tipo)?.value);
  return { ano: parte('year'), mes: parte('month'), dia: parte('day'), hora: parte('hour') % 24 };
}

/** Período do dia no fuso: manhã 6–12, tarde 12–18, noite 18–6. */
export function periodoDe(data: Date, fusoIana: string): Periodo {
  const { hora } = dataLocal(data, fusoIana);
  if (hora >= PERIODOS.manha.inicio && hora < PERIODOS.manha.fim) return 'manha';
  if (hora >= PERIODOS.tarde.inicio && hora < PERIODOS.tarde.fim) return 'tarde';
  return 'noite';
}

function numeroDoDia(local: DataLocal): number {
  return Math.round(Date.UTC(local.ano, local.mes - 1, local.dia) / DIA_MS);
}

/**
 * Dia do mundo: 1 no dia (de calendário, no fuso do jogador) em que o mundo foi criado, e soma 1
 * a cada meia-noite local. Nunca menor que 1.
 */
export function diaDoMundo(criadoEm: Date, agora: Date, fusoIana: string): number {
  const dias = numeroDoDia(dataLocal(agora, fusoIana)) - numeroDoDia(dataLocal(criadoEm, fusoIana));
  return Math.max(1, dias + 1);
}

/** Relógio simulado: soma minutos (positivos ou negativos) a um instante. */
export function aplicarDeslocamento(agora: Date, minutos: number): Date {
  return new Date(agora.getTime() + minutos * 60_000);
}
