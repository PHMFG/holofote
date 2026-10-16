import { diasEntre } from '../../tempo';

/** Dias de calendário (fuso local) entre o instante e agora: 0 hoje, 1 ontem. */
export function diasAtras(iso: string, agora: number): number {
  return diasEntre(new Date(iso), new Date(agora));
}

export function ehHoje(iso: string, agora: number): boolean {
  return diasAtras(iso, agora) === 0;
}

/**
 * Rótulo do grupo do registro: "Hoje · dia 6", "Ontem · dia 5" e, antes disso, "Dia 4". O dia do
 * mundo acompanha o dia real (docs/PLANO.md, tempo); sem ele, cai na data.
 */
export function rotuloDoDia(iso: string, agora: number, diaDoMundo?: number): string {
  const atras = diasAtras(iso, agora);
  const dia = diaDoMundo !== undefined ? diaDoMundo - atras : undefined;
  const sufixo = dia !== undefined && dia >= 1 ? ` · dia ${dia}` : '';
  if (atras <= 0) return `Hoje${sufixo}`;
  if (atras === 1) return `Ontem${sufixo}`;
  if (dia !== undefined && dia >= 1) return `Dia ${dia}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export interface GrupoDoDia<T> {
  chave: number;
  rotulo: string;
  itens: T[];
}

/** Agrupa por dia de calendário, mantendo a ordem de chegada (a API manda do mais novo). */
export function agruparPorDia<T extends { criadoEm: string }>(
  itens: readonly T[],
  agora: number,
  diaDoMundo?: number,
): GrupoDoDia<T>[] {
  const grupos: GrupoDoDia<T>[] = [];
  for (const item of itens) {
    const chave = diasAtras(item.criadoEm, agora);
    const grupo = grupos.find((g) => g.chave === chave);
    if (grupo) grupo.itens.push(item);
    else
      grupos.push({ chave, rotulo: rotuloDoDia(item.criadoEm, agora, diaDoMundo), itens: [item] });
  }
  return grupos;
}
