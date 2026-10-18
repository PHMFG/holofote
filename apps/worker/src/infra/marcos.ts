// Contadores que os requisitos de marco leem, calculados como na API (estadoDosMarcos em
// apps/server/src/servicos/acoes.ts): seguidores, fama e carisma do jogador, ações não desfeitas
// (posts, mensagens, escândalos) e aliados. Os contadores valem para o mundo todo, não por ato.
import {
  acao as tabelaAcao,
  and,
  eq,
  isNull,
  relacao,
  sql,
  type LinhaPersonagem,
} from '@holofote/db';
import { contarAliados, type EstadoInicialMarcos } from '@holofote/engine';
import type { Executor } from './relacoes';

export async function estadoInicialDoAto(
  db: Executor,
  mundoId: string,
  jogador: Pick<LinhaPersonagem, 'id' | 'seguidores' | 'fama' | 'carisma'>,
): Promise<Required<EstadoInicialMarcos>> {
  const porTipo = await db
    .select({
      tipo: tabelaAcao.tipo,
      total: sql<number>`count(*)::int`,
      escandalos: sql<number>`count(*) filter (where ${tabelaAcao.entrada}->>'tom' = 'provocativo')::int`,
    })
    .from(tabelaAcao)
    .where(and(eq(tabelaAcao.mundoId, mundoId), isNull(tabelaAcao.desfeitaEm)))
    .groupBy(tabelaAcao.tipo);
  const afinidades = await db
    .select({ afinidade: relacao.afinidade })
    .from(relacao)
    .where(eq(relacao.deId, jogador.id));
  const total = (tipo: string) => porTipo.find((p) => p.tipo === tipo)?.total ?? 0;
  return {
    seguidores: jogador.seguidores,
    fama: jogador.fama,
    carisma: jogador.carisma,
    posts: total('post'),
    dms: total('dm') + total('historia'),
    escandalos: porTipo.find((p) => p.tipo === 'post')?.escandalos ?? 0,
    aliados: contarAliados(afinidades.map((r) => r.afinidade)),
  };
}
