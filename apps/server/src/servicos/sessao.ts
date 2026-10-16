import {
  and,
  eq,
  mundo as tabelaMundo,
  personagem,
  usuario as tabelaUsuario,
  type Db,
  type LinhaMundo,
  type LinhaPersonagem,
  type LinhaUsuario,
} from '@holofote/db';
import { aplicarDeslocamento, diaDoMundo, periodoDe } from '@holofote/engine';
import type { Contexto } from '../contexto';
import { ErroApi } from '../infra/erros';

export interface Sessao {
  usuario: LinhaUsuario;
  mundo: LinhaMundo | null;
  jogador: LinhaPersonagem | null;
  /** Hora do mundo (real + relógio simulado). */
  agora: Date;
}

export interface SessaoComMundo extends Sessao {
  mundo: LinhaMundo;
  jogador: LinhaPersonagem;
}

export async function carregarSessao(
  ctx: Contexto,
  usuarioId: string,
  db: Db = ctx.db,
): Promise<Sessao> {
  const [usuario] = await db.select().from(tabelaUsuario).where(eq(tabelaUsuario.id, usuarioId));
  if (!usuario) throw new ErroApi(401, 'nao_autenticado', 'Sessão inválida. Abra o app de novo.');
  const [mundo] = await db
    .select()
    .from(tabelaMundo)
    .where(and(eq(tabelaMundo.usuarioId, usuarioId), eq(tabelaMundo.ativo, true)));
  const [jogador] = mundo
    ? await db
        .select()
        .from(personagem)
        .where(and(eq(personagem.mundoId, mundo.id), eq(personagem.papel, 'jogador')))
    : [];
  return {
    usuario,
    mundo: mundo ?? null,
    jogador: jogador ?? null,
    agora: aplicarDeslocamento(ctx.agoraReal(), mundo?.deslocamentoMin ?? 0),
  };
}

/** Exige um mundo ativo; com `pronto`, também exige que a IA já tenha terminado de criá-lo. */
export function exigirMundo(sessao: Sessao, { pronto = true } = {}): SessaoComMundo {
  if (!sessao.mundo || !sessao.jogador) {
    throw new ErroApi(404, 'nao_encontrado', 'Você ainda não criou um mundo.');
  }
  if (pronto && sessao.mundo.estado !== 'pronto') {
    throw new ErroApi(409, 'mundo_criando', 'Seu mundo ainda está sendo criado.');
  }
  return sessao as SessaoComMundo;
}

export function diaEPeriodo(sessao: SessaoComMundo) {
  return {
    dia: diaDoMundo(sessao.mundo.criadoEm, sessao.agora, sessao.usuario.fuso),
    periodo: periodoDe(sessao.agora, sessao.usuario.fuso),
  };
}
