// Aplicação das consequências numéricas do motor e montagem da Consequencia do contrato.
import {
  acao as tabelaAcao,
  alerta,
  and,
  asc,
  delta as tabelaDelta,
  eq,
  inArray,
  isNull,
  marco,
  ne,
  personagem,
  relacao,
  sql,
  type LinhaAcao,
  type LinhaMundo,
  type LinhaPersonagem,
  type LinhaUsuario,
} from '@holofote/db';
import {
  aplicarDeltaRelacao,
  avaliarMarco,
  contarAliados,
  desfazivelAte,
  idDoAlvoRelacao,
  limitarAtributo,
  rotuloRelacao,
  type Delta,
  type EstadoMarcos,
  type RequisitoMarco,
} from '@holofote/engine';
import type { Consequencia } from '@holofote/shared';
import { energiaDto, estadoEnergia } from './carteira';
import type { Executor } from './tipos';

/** Ações que o jogador pode desfazer (custo 2, até 60 min, só a última). */
export const TIPOS_DESFAZIVEIS = new Set(['post', 'resposta', 'dm', 'historia']);

export function vinculoDoRotulo(tipo: LinhaPersonagem['tipoVinculo']): 'amizade' | 'parceria' {
  return tipo === 'parceria' || tipo === 'mentor' ? 'parceria' : 'amizade';
}

/**
 * Aplica deltas ao jogador e às relações dele, gravando cada um na tabela `delta`. Atributos ficam
 * em 0..100 e seguidores nunca negativos; o rótulo da relação é recalculado pela faixa. Grava o
 * delta efetivo (depois do limite), para o desfazer inverter exatamente o que mudou. Trava a linha
 * do jogador e relê os números dentro da transação.
 */
export async function aplicarDeltas(
  tx: Executor,
  acaoId: string,
  jogador: Pick<LinhaPersonagem, 'id'>,
  deltas: readonly Delta[],
): Promise<Delta[]> {
  const pedidos = deltas.filter((d) => d.valor !== 0);
  if (pedidos.length === 0) return [];
  const [atual] = await tx
    .select()
    .from(personagem)
    .where(eq(personagem.id, jogador.id))
    .for('update');
  const numeros = {
    fama: atual!.fama,
    carisma: atual!.carisma,
    polemica: atual!.polemica,
    seguidores: atual!.seguidores,
  };

  const gravados: Delta[] = [];
  for (const d of pedidos) {
    const outroId = idDoAlvoRelacao(d.alvo);
    if (outroId) {
      const [rel] = await tx
        .select()
        .from(relacao)
        .where(and(eq(relacao.deId, jogador.id), eq(relacao.paraId, outroId)))
        .for('update');
      const [outro] = await tx.select().from(personagem).where(eq(personagem.id, outroId));
      if (!rel || !outro) continue;
      const afinidade = aplicarDeltaRelacao(rel.afinidade, d.valor);
      if (afinidade === rel.afinidade) continue;
      await tx
        .update(relacao)
        .set({ afinidade, rotulo: rotuloRelacao(afinidade, vinculoDoRotulo(outro.tipoVinculo)) })
        .where(and(eq(relacao.deId, jogador.id), eq(relacao.paraId, outroId)));
      gravados.push({ alvo: d.alvo, valor: afinidade - rel.afinidade });
    } else if (d.alvo === 'seguidores') {
      const novo = Math.max(0, numeros.seguidores + d.valor);
      if (novo !== numeros.seguidores)
        gravados.push({ alvo: d.alvo, valor: novo - numeros.seguidores });
      numeros.seguidores = novo;
    } else if (d.alvo === 'fama' || d.alvo === 'carisma' || d.alvo === 'polemica') {
      const novo = limitarAtributo(numeros[d.alvo] + d.valor);
      if (novo !== numeros[d.alvo]) gravados.push({ alvo: d.alvo, valor: novo - numeros[d.alvo] });
      numeros[d.alvo] = novo;
    }
  }
  await tx.update(personagem).set(numeros).where(eq(personagem.id, jogador.id));
  if (gravados.length > 0) {
    await tx
      .insert(tabelaDelta)
      .values(gravados.map((d) => ({ acaoId, alvo: d.alvo, valor: d.valor })));
  }
  return gravados;
}

/** Contadores que os requisitos de marco leem (ver packages/engine/src/marcos.ts). */
export async function estadoDosMarcos(
  db: Executor,
  mundo: LinhaMundo,
  jogadorId: string,
): Promise<EstadoMarcos> {
  const [jogador] = await db.select().from(personagem).where(eq(personagem.id, jogadorId));
  const porTipo = await db
    .select({
      tipo: tabelaAcao.tipo,
      total: sql<number>`count(*)::int`,
      escandalos: sql<number>`count(*) filter (where ${tabelaAcao.entrada}->>'tom' = 'provocativo')::int`,
    })
    .from(tabelaAcao)
    .where(and(eq(tabelaAcao.mundoId, mundo.id), isNull(tabelaAcao.desfeitaEm)))
    .groupBy(tabelaAcao.tipo);
  const relacoes = await db
    .select({ afinidade: relacao.afinidade })
    .from(relacao)
    .where(eq(relacao.deId, jogadorId));
  const total = (tipo: string) => porTipo.find((p) => p.tipo === tipo)?.total ?? 0;
  return {
    seguidores: jogador!.seguidores,
    fama: jogador!.fama,
    carisma: jogador!.carisma,
    posts: total('post'),
    dms: total('dm') + total('historia'),
    escandalos: porTipo.find((p) => p.tipo === 'post')?.escandalos ?? 0,
    aliados: contarAliados(relacoes.map((r) => r.afinidade)),
  };
}

/**
 * Libera o marco atual do ato se os requisitos foram cumpridos (um por ação), com alerta.
 * Devolve o marco liberado, se houver.
 */
export async function verificarMarco(
  tx: Executor,
  mundo: LinhaMundo,
  jogadorId: string,
  agora: Date,
) {
  const [atual] = await tx
    .select()
    .from(marco)
    .where(and(eq(marco.mundoId, mundo.id), eq(marco.ato, mundo.ato), isNull(marco.liberadoEm)))
    .orderBy(asc(marco.ordem))
    .limit(1);
  if (!atual) return null;
  const avaliacao = avaliarMarco(
    atual.requisitos as RequisitoMarco[],
    await estadoDosMarcos(tx, mundo, jogadorId),
  );
  if (!avaliacao.cumprido) return null;
  await tx.update(marco).set({ liberadoEm: agora }).where(eq(marco.id, atual.id));
  await tx.insert(alerta).values({
    mundoId: mundo.id,
    tipo: 'marco',
    texto: `Marco liberado: ${atual.titulo}`,
    destino: `/marco/${atual.id}`,
    entregarEm: agora,
  });
  return atual;
}

/** Consequencia do contrato a partir da ação gravada. */
export async function consequenciaDto(
  db: Executor,
  acao: LinhaAcao,
  usuario: LinhaUsuario,
  agora: Date,
): Promise<Consequencia> {
  const deltas = await db
    .select({ alvo: tabelaDelta.alvo, valor: tabelaDelta.valor })
    .from(tabelaDelta)
    .where(eq(tabelaDelta.acaoId, acao.id));
  const marcoId = acao.consequencia?.marcoLiberadoId ?? null;
  const [liberado] = marcoId
    ? await db
        .select({ id: marco.id, titulo: marco.titulo })
        .from(marco)
        .where(eq(marco.id, marcoId))
    : [];
  const ultima = await ehUltimaAcao(db, acao);
  const ate = desfazivelAte(acao.criadoEm);
  return {
    eventoId: acao.id,
    deltas,
    seguidoresGanhos: acao.consequencia?.seguidoresGanhos ?? 0,
    curtidasSimuladas: acao.consequencia?.curtidasSimuladas ?? 0,
    cartao: acao.cartao ?? null,
    reacoesPendentes: acao.iaPendente,
    energia: energiaDto(await estadoEnergia(db, usuario, agora), usuario.plano),
    marcoLiberado: liberado ?? null,
    desfazivelAte:
      TIPOS_DESFAZIVEIS.has(acao.tipo) && !acao.desfeitaEm && ultima && ate > agora
        ? ate.toISOString()
        : null,
  };
}

/** A ação é a mais recente não desfeita do mundo (ignorando os próprios desfazer). */
export async function ehUltimaAcao(db: Executor, acao: LinhaAcao): Promise<boolean> {
  const [maisRecente] = await db
    .select({ id: tabelaAcao.id })
    .from(tabelaAcao)
    .where(
      and(
        eq(tabelaAcao.mundoId, acao.mundoId),
        isNull(tabelaAcao.desfeitaEm),
        ne(tabelaAcao.tipo, 'desfazer'),
        inArray(tabelaAcao.tipo, [...TIPOS_DESFAZIVEIS] as (
          'post' | 'resposta' | 'dm' | 'historia'
        )[]),
      ),
    )
    .orderBy(sql`${tabelaAcao.criadoEm} desc`)
    .limit(1);
  return maisRecente?.id === acao.id;
}
