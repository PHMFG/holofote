import type { Alerta } from '@holofote/shared';
import { diaDoMundo, diasEntre } from '../../tempo';

export type FiltroAlerta = 'tudo' | 'mencoes' | 'relacoes' | 'sistema';

export const FILTROS_ALERTA = [
  { valor: 'tudo', rotulo: 'Tudo' },
  { valor: 'mencoes', rotulo: 'Menções' },
  { valor: 'relacoes', rotulo: 'Relações' },
  { valor: 'sistema', rotulo: 'Sistema' },
] as const;

/**
 * Menções: respostas e citações ao jogador. Relações: o resto que vem de um personagem (DM,
 * curtidas e seguidores de alguém do elenco). Sistema: o que não tem personagem (marco, evento,
 * seguidores em massa, resumo do dia).
 */
export function categoriaDe(alerta: Alerta): Exclude<FiltroAlerta, 'tudo'> {
  if (alerta.tipo === 'resposta' || alerta.tipo === 'mencao') return 'mencoes';
  return alerta.personagem ? 'relacoes' : 'sistema';
}

export interface GrupoDeAlertas {
  chave: string;
  /** "Hoje", "Ontem" ou "Dia 5" (o Rotulo de seção põe em maiúsculas). */
  titulo: string;
  alertas: Alerta[];
}

/** Filtra, ordena do mais novo para o mais velho e agrupa por dia, como no Figma (HOJE, ONTEM). */
export function agruparAlertas(
  alertas: readonly Alerta[],
  filtro: FiltroAlerta,
  diaAtual: number | undefined,
  agora: number = Date.now(),
): GrupoDeAlertas[] {
  const grupos = new Map<number, GrupoDeAlertas>();
  const ordenados = alertas
    .filter((a) => filtro === 'tudo' || categoriaDe(a) === filtro)
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
  for (const alerta of ordenados) {
    const dias = diasEntre(new Date(alerta.criadoEm), new Date(agora));
    let grupo = grupos.get(dias);
    if (!grupo) {
      const dia = diaDoMundo(alerta.criadoEm, diaAtual, agora);
      const titulo =
        dias <= 0
          ? 'Hoje'
          : dias === 1
            ? 'Ontem'
            : dia !== undefined
              ? `Dia ${dia}`
              : `Há ${dias} dias`;
      grupo = { chave: String(dias), titulo, alertas: [] };
      grupos.set(dias, grupo);
    }
    grupo.alertas.push(alerta);
  }
  return [...grupos.values()];
}
