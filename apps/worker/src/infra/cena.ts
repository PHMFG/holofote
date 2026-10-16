// Carrega o mundo como os jobs precisam: hora do mundo, jogador, elenco, relações e memórias,
// já no formato das entradas de prompt de @holofote/llm.
import {
  and,
  eq,
  inArray,
  memoria,
  mundo as tabelaMundo,
  ne,
  personagem,
  relacao,
  usuario as tabelaUsuario,
  type Db,
  type LinhaMundo,
  type LinhaPersonagem,
  type LinhaUsuario,
} from '@holofote/db';
import { aplicarDeslocamento, diaDoMundo, periodoDe } from '@holofote/engine';
import type { JogadorPrompt, PersonagemPrompt, PessoaCurta, ReatorPrompt } from '@holofote/llm';
import { mundoDto } from '@holofote/db';
import type { Periodo } from '@holofote/shared';
import type { ContextoWorker } from '../contexto';
import { publicar } from './publicador';

export interface Cena {
  mundo: LinhaMundo;
  usuario: LinhaUsuario;
  jogador: LinhaPersonagem;
  /** Hora do mundo: real + relógio simulado. */
  agora: Date;
  dia: number;
  periodo: Periodo;
}

/** Mundo com jogador e hora. Null se o mundo foi apagado (recomeçar) no meio do caminho. */
export async function carregarCena(ctx: ContextoWorker, mundoId: string): Promise<Cena | null> {
  const [m] = await ctx.db.select().from(tabelaMundo).where(eq(tabelaMundo.id, mundoId));
  if (!m) return null;
  const [u] = await ctx.db.select().from(tabelaUsuario).where(eq(tabelaUsuario.id, m.usuarioId));
  const [j] = await ctx.db
    .select()
    .from(personagem)
    .where(and(eq(personagem.mundoId, m.id), eq(personagem.papel, 'jogador')));
  if (!u || !j) return null;
  const agora = aplicarDeslocamento(ctx.agoraReal(), m.deslocamentoMin);
  return {
    mundo: m,
    usuario: u,
    jogador: j,
    agora,
    dia: diaDoMundo(m.criadoEm, agora, u.fuso),
    periodo: periodoDe(agora, u.fuso),
  };
}

/**
 * A mesma cena com a hora do mundo relida: depois de uma chamada de IA (segundos, às vezes
 * minutos), as entregas partem de agora, não de antes da chamada.
 */
export async function cenaAtualizada(ctx: ContextoWorker, cena: Cena): Promise<Cena> {
  const [m] = await ctx.db
    .select({ deslocamentoMin: tabelaMundo.deslocamentoMin })
    .from(tabelaMundo)
    .where(eq(tabelaMundo.id, cena.mundo.id));
  const agora = aplicarDeslocamento(
    ctx.agoraReal(),
    m?.deslocamentoMin ?? cena.mundo.deslocamentoMin,
  );
  return { ...cena, agora };
}

/** Recarrega o jogador (os números mudam a cada ação). */
export async function jogadorAtual(db: Db, cena: Cena): Promise<LinhaPersonagem> {
  const [j] = await db.select().from(personagem).where(eq(personagem.id, cena.jogador.id));
  return j ?? cena.jogador;
}

/** Avisa o app que o mundo mudou (pronto, erro). */
export async function publicarMundo(ctx: ContextoWorker, mundoId: string): Promise<void> {
  const cena = await carregarCena(ctx, mundoId);
  if (!cena) return;
  await publicar(ctx.redis, mundoId, {
    tipo: 'mundo',
    mundo: await mundoDto(ctx.db, cena.mundo, cena.jogador.id, cena),
  });
}

export const comArroba = (handle: string) => (handle.startsWith('@') ? handle : `@${handle}`);

export function jogadorPrompt(j: LinhaPersonagem): JogadorPrompt {
  return {
    id: j.id,
    nome: j.nome,
    handle: comArroba(j.handle),
    descricao: j.ficha,
    fama: j.fama,
    carisma: j.carisma,
    polemica: j.polemica,
    seguidores: j.seguidores,
  };
}

export function pessoaCurta(p: LinhaPersonagem): PessoaCurta {
  return { id: p.id, nome: p.nome, handle: comArroba(p.handle) };
}

export function personagemPrompt(p: LinhaPersonagem): PersonagemPrompt {
  return {
    id: p.id,
    nome: p.nome,
    handle: comArroba(p.handle),
    papel: p.papel === 'figurante' ? 'figurante' : 'elenco',
    ficha: p.ficha,
  };
}

/** Elenco e figurantes do mundo, sem o jogador e sem quem ele silenciou. */
export async function personagensDoMundo(db: Db, mundoId: string): Promise<LinhaPersonagem[]> {
  return db
    .select()
    .from(personagem)
    .where(
      and(
        eq(personagem.mundoId, mundoId),
        ne(personagem.papel, 'jogador'),
        eq(personagem.silenciado, false),
      ),
    );
}

export interface RelacaoJogador {
  afinidade: number;
  rotulo: string;
}

/** Afinidade do jogador com cada personagem (linha jogador → personagem). */
export async function relacoesDoJogador(
  db: Db,
  jogadorId: string,
): Promise<Map<string, RelacaoJogador>> {
  const linhas = await db.select().from(relacao).where(eq(relacao.deId, jogadorId));
  return new Map(linhas.map((r) => [r.paraId, { afinidade: r.afinidade, rotulo: r.rotulo }]));
}

/** O que cada personagem lembra do jogador, um fato por linha. */
export async function memoriasSobre(
  db: Db,
  personagemIds: readonly string[],
  jogadorId: string,
): Promise<Map<string, string[]>> {
  if (personagemIds.length === 0) return new Map();
  const linhas = await db
    .select()
    .from(memoria)
    .where(and(inArray(memoria.personagemId, [...personagemIds]), eq(memoria.sobreId, jogadorId)));
  return new Map(linhas.map((m) => [m.personagemId, m.fatos.split('\n').filter(Boolean)]));
}

/** Reatores no formato do prompt, na ordem dada, com relação, memórias e o motivo da escolha. */
export async function reatoresPrompt(
  db: Db,
  jogadorId: string,
  pessoas: readonly LinhaPersonagem[],
  motivos: ReadonlyMap<string, string> = new Map(),
): Promise<ReatorPrompt[]> {
  const relacoes = await relacoesDoJogador(db, jogadorId);
  const memorias = await memoriasSobre(
    db,
    pessoas.map((p) => p.id),
    jogadorId,
  );
  return pessoas.map((p) => {
    const rel = relacoes.get(p.id);
    return {
      ...personagemPrompt(p),
      relacao: rel ? { ...rel, tipoVinculo: p.tipoVinculo } : null,
      memorias: memorias.get(p.id) ?? [],
      motivo: motivos.get(p.id) ?? null,
    };
  });
}
