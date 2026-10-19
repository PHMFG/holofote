// diretor: reações do mundo a um post, comentário ou ação de campanha do jogador. O motor escolhe
// quem reage (até 5) e já aplicou os números da ação; a IA escreve as reações, o cartão de
// consequência e as memórias, e sugere ajustes de relação que o motor limita.
import {
  acao as tabelaAcao,
  alerta,
  and,
  conversa,
  delta as tabelaDelta,
  eq,
  eventoAgendado,
  mensagem,
  personagem,
  personagemResumoDto,
  post,
  sql,
  type LinhaAcao,
  type LinhaPersonagem,
  type LinhaPost,
} from '@holofote/db';
import {
  criarRng,
  engajamentoDePersonagem,
  escolherReatores,
  idDoAlvoRelacao,
} from '@holofote/engine';
import type { AcaoDiretor, SaidaDiretor } from '@holofote/llm';
import type { ContextoWorker } from '../contexto';
import { acaoViva, retomarEntregas, travarAcaoPendente } from '../infra/acao';
import {
  carregarCena,
  cenaAtualizada,
  jogadorAtual,
  jogadorPrompt,
  pessoaCurta,
  personagensDoMundo,
  reatoresPrompt,
  relacoesDoJogador,
  type Cena,
} from '../infra/cena';
import { agendarEntregas, type Entrega } from '../infra/feed';
import { gerar } from '../infra/ia';
import { publicarSemFalha } from '../infra/publicador';
import { aplicarSugestaoDeRelacao, lembrar, type Executor } from '../infra/relacoes';

/** A primeira reação chega logo depois que a IA escreve: o "digitando" emenda até ela. */
export const PRIMEIRA_REACAO_SEG = 8;
/** As seguintes mantêm a ordem e o ritmo que a IA escolheu, comprimidos para o jogador ver. */
export const RITMO_DAS_SEGUINTES = 0.4;
/** Nenhuma reação passa de três minutos depois da IA. */
export const ULTIMA_REACAO_ATE_SEG = 180;

/** Atraso de entrega (ms, a partir de agora) da reação que a IA marcou para `atrasoSeg`. */
export function atrasoDaReacao(atrasoSeg: number, primeiraSeg: number): number {
  const depoisDaPrimeira = Math.max(0, atrasoSeg - primeiraSeg) * RITMO_DAS_SEGUINTES;
  return Math.round(
    Math.min(ULTIMA_REACAO_ATE_SEG, PRIMEIRA_REACAO_SEG + depoisDaPrimeira) * 1000,
  );
}

export interface PedidoDiretor {
  acaoId: string;
}

interface Alvo {
  /** Post do jogador a que as respostas se penduram (nulo na campanha: as reações viram posts). */
  postDoJogador: LinhaPost | null;
  acao: AcaoDiretor;
  marcados: string[];
  autorAlvo?: string;
}

/** Ação ainda viva: existe, não foi desfeita e ainda espera as reações da IA. */
export async function acaoPendente(ctx: ContextoWorker, acaoId: string) {
  const a = await acaoViva(ctx, acaoId);
  return a && a.iaPendente > 0 ? a : null;
}

/** Deltas que o motor já aplicou na ação (o modelo só cita). */
export async function deltasDaAcao(ctx: ContextoWorker, acaoId: string) {
  return ctx.db
    .select({ alvo: tabelaDelta.alvo, valor: tabelaDelta.valor })
    .from(tabelaDelta)
    .where(eq(tabelaDelta.acaoId, acaoId));
}

async function alvoDaAcao(ctx: ContextoWorker, cena: Cena, a: LinhaAcao): Promise<Alvo | null> {
  const entrada = a.entrada as Record<string, unknown>;
  if (a.tipo === 'campanha') {
    const [e] = await ctx.db
      .select()
      .from(eventoAgendado)
      .where(eq(eventoAgendado.id, String(entrada.eventoId)));
    if (!e) return null;
    return {
      postDoJogador: null,
      marcados: [],
      acao: {
        tipo: 'post',
        texto: `Ação de campanha para "${e.titulo}" (${e.categoria}): ${String(entrada.rotulo)}.`,
      },
    };
  }

  const [meu] = await ctx.db
    .select()
    .from(post)
    .where(and(eq(post.acaoId, a.id), eq(post.autorId, cena.jogador.id)));
  if (!meu || meu.oculto) return null;

  if (a.tipo === 'post') {
    const marcados = meu.marcados;
    const pessoas = marcados.length
      ? await ctx.db.select().from(personagem).where(eq(personagem.mundoId, cena.mundo.id))
      : [];
    return {
      postDoJogador: meu,
      marcados,
      acao: {
        tipo: 'post',
        texto: meu.texto,
        tom: meu.tom,
        marcados: pessoas.filter((p) => marcados.includes(p.id)).map(pessoaCurta),
      },
    };
  }

  if (a.tipo === 'resposta' && meu.respondeA) {
    const [original] = await ctx.db.select().from(post).where(eq(post.id, meu.respondeA));
    const [autor] = original
      ? await ctx.db.select().from(personagem).where(eq(personagem.id, original.autorId))
      : [];
    const deFora = autor && autor.id !== cena.jogador.id ? autor : undefined;
    return {
      postDoJogador: meu,
      marcados: [],
      autorAlvo: deFora?.id,
      acao: {
        tipo: 'resposta',
        texto: meu.texto,
        emResposta: original && autor ? { autor: pessoaCurta(autor), texto: original.texto } : null,
      },
    };
  }
  return null;
}

export async function diretor(ctx: ContextoWorker, pedido: PedidoDiretor): Promise<void> {
  const a = await acaoViva(ctx, pedido.acaoId);
  if (!a) return;
  const cena = await carregarCena(ctx, a.mundoId);
  if (!cena) return;
  // Repetição depois do commit: só falta agendar as entregas e avisar o cartão.
  if (a.iaPendente === 0) return retomarEntregas(ctx, cena, a);
  const alvo = await alvoDaAcao(ctx, cena, a);
  if (!alvo) {
    await ctx.db.update(tabelaAcao).set({ iaPendente: 0 }).where(eq(tabelaAcao.id, a.id));
    return;
  }

  const personagens = await personagensDoMundo(ctx.db, cena.mundo.id);
  const porId = new Map(personagens.map((p) => [p.id, p]));
  const relacoes = await relacoesDoJogador(ctx.db, cena.jogador.id);
  const ids = escolherReatores({
    personagens: personagens.map((p) => ({
      id: p.id,
      papel: p.papel === 'figurante' ? 'figurante' : 'elenco',
      afinidade: relacoes.get(p.id)?.afinidade ?? 50,
      perfilFofoca: p.perfilFofoca,
    })),
    marcados: alvo.marcados.filter((id) => porId.has(id)),
    autorAlvo: alvo.autorAlvo && porId.has(alvo.autorAlvo) ? alvo.autorAlvo : undefined,
    rng: criarRng(`reatores:${a.id}`),
  });
  const reatores = ids.map((id) => porId.get(id)!);
  if (reatores.length === 0) {
    await ctx.db.update(tabelaAcao).set({ iaPendente: 0 }).where(eq(tabelaAcao.id, a.id));
    return;
  }

  const motivos = new Map<string, string>();
  for (const id of alvo.marcados) motivos.set(id, 'foi marcado no post');
  if (alvo.autorAlvo) motivos.set(alvo.autorAlvo, 'é o autor do post comentado');

  // O primeiro reator aparece "digitando" enquanto a IA escreve.
  if (alvo.postDoJogador) {
    await publicarSemFalha(ctx, cena.mundo.id, {
      tipo: 'digitando',
      personagem: personagemResumoDto(reatores[0]!),
      conversaId: null,
      postId: alvo.postDoJogador.id,
    });
  }

  const consequencia = a.consequencia;
  const { dados } = await gerar(ctx, {
    job: 'diretor',
    mundo: cena.mundo,
    acaoId: a.id,
    entrada: {
      resumoEstado: cena.mundo.resumoEstado,
      momento: { dia: cena.dia, periodo: cena.periodo },
      jogador: jogadorPrompt(await jogadorAtual(ctx.db, cena)),
      acao: alvo.acao,
      numeros: {
        seguidoresGanhos: consequencia?.seguidoresGanhos,
        curtidas: consequencia?.curtidasSimuladas,
        deltas: await deltasDaAcao(ctx, a.id),
      },
      reatores: await reatoresPrompt(ctx.db, cena.jogador.id, reatores, motivos),
    },
  });

  // As reações partem de agora, não de antes da chamada de IA.
  const depois = await cenaAtualizada(ctx, cena);
  const entregas = await ctx.db.transaction(async (tx) => {
    // O jogador pode ter desfeito a ação enquanto a IA escrevia: com a linha travada, ou o
    // desfazer já passou (e aqui não se grava nada) ou espera este commit e apaga o que entrou.
    if (!(await travarAcaoPendente(tx, a.id))) return null;

    // A IA recusou a ação do jogador: o post some, nada de reação, delta ou memória; fica o
    // cartão que o modelo escreveu. A energia não volta (docs/DECISOES.md).
    if (!dados.moderacao.ok) {
      const meu = alvo.postDoJogador;
      if (meu) {
        await tx.update(post).set({ oculto: true }).where(eq(post.id, meu.id));
        if (meu.respondeA) {
          await tx
            .update(post)
            .set({ respostas: sql`greatest(0, ${post.respostas} - 1)` })
            .where(eq(post.id, meu.respondeA));
        }
      }
      await tx
        .update(tabelaAcao)
        .set({ cartao: dados.cartao, iaPendente: 0 })
        .where(eq(tabelaAcao.id, a.id));
      ctx.log.warn({ acaoId: a.id }, 'IA recusou a ação do jogador');
      return [];
    }

    const futuras: Entrega[] = [];
    const rng = criarRng(`reacoes:${a.id}`);
    const agendar = (tipo: Entrega['pedido']['tipo'], id: string, entregarEm: Date) =>
      futuras.push({ pedido: { tipo, id, mundoId: cena.mundo.id }, entregarEm });

    const primeira = Math.min(...dados.reacoes.map((r) => r.atrasoSeg));
    const reacoes = ajustarCanais(dados.reacoes, alvo.acao.tipo, !!alvo.postDoJogador);
    for (const r of reacoes) {
      const autor = porId.get(r.personagemId);
      if (!autor) continue;
      const entregarEm = new Date(depois.agora.getTime() + atrasoDaReacao(r.atrasoSeg, primeira));

      if (r.tipo === 'dm') {
        const conversaId = await conversaCom(tx, cena.mundo.id, autor);
        const [msg] = await tx
          .insert(mensagem)
          .values({ conversaId, autorId: autor.id, texto: r.texto, entregarEm, acaoId: a.id })
          .returning({ id: mensagem.id });
        agendar('mensagem', msg!.id, entregarEm);
        continue;
      }

      const responde = r.tipo === 'resposta' && alvo.postDoJogador;
      const numeros = engajamentoDePersonagem({
        seguidores: autor.seguidores,
        polemica: autor.polemica,
        rng,
      });
      const [novo] = await tx
        .insert(post)
        .values({
          mundoId: cena.mundo.id,
          autorId: autor.id,
          respondeA: responde ? alvo.postDoJogador!.id : null,
          texto: r.texto,
          origem: 'diretor',
          acaoId: a.id,
          entregarEm,
          curtidas: responde ? Math.round(numeros.curtidas / 4) : numeros.curtidas,
          reposts: responde ? 0 : numeros.reposts,
          criadoEm: depois.agora,
        })
        .returning({ id: post.id });
      agendar('post', novo!.id, entregarEm);

      const [aviso] = await tx
        .insert(alerta)
        .values({
          mundoId: cena.mundo.id,
          tipo: responde ? 'resposta' : 'mencao',
          texto: responde ? `${autor.nome} respondeu você` : `${autor.nome} comentou sobre você`,
          personagemId: autor.id,
          acaoId: a.id,
          destino: `/post/${responde ? alvo.postDoJogador!.id : novo!.id}/respostas`,
          entregarEm,
        })
        .returning({ id: alerta.id });
      agendar('alerta', aviso!.id, entregarEm);
    }

    const reatoresIds = new Set(ids);
    for (const d of dados.deltasSugeridos) {
      const outroId = idDoAlvoRelacao(d.alvo);
      const outro = outroId && reatoresIds.has(outroId) ? porId.get(outroId) : undefined;
      // Atributos do jogador são só do motor; a IA mexe apenas nas relações de quem reagiu.
      if (outro) await aplicarSugestaoDeRelacao(tx, a.id, cena.jogador.id, outro, d.valor);
    }

    for (const m of dados.memorias) {
      if (reatoresIds.has(m.personagemId)) {
        await lembrar(tx, m.personagemId, cena.jogador.id, m.fato, cena.dia);
      }
    }

    await tx
      .update(tabelaAcao)
      .set({ cartao: dados.cartao, iaPendente: 0 })
      .where(eq(tabelaAcao.id, a.id));
    return futuras;
  });
  if (!entregas) return;

  // Entregas antes do cartão: se o Redis falhar aqui, o job se repete e retoma pelas linhas.
  await agendarEntregas(ctx, depois, entregas);
  // Um desfazer logo depois do commit já apagou as reações; o cartão também não sai.
  if (!(await acaoViva(ctx, a.id))) return;
  await publicarSemFalha(ctx, cena.mundo.id, {
    tipo: 'cartao',
    eventoId: a.id,
    cartao: dados.cartao,
  });
}

type Reacao = SaidaDiretor['reacoes'][number];

/**
 * Onde cada reação aparece. Uma resposta a um comentário fica sempre na conversa do post (quem
 * comentou espera a resposta ali, não na DM). Num post, no máximo uma reação vira mensagem
 * direta; as outras ficam como resposta ao post.
 */
export function ajustarCanais(
  reacoes: readonly Reacao[],
  tipoDaAcao: AcaoDiretor['tipo'],
  temPostDoJogador: boolean,
): Reacao[] {
  let dms = 0;
  return reacoes.map((r) => {
    if (r.tipo !== 'dm') return r;
    const podeDm = tipoDaAcao === 'post' && dms === 0;
    if (podeDm) {
      dms++;
      return r;
    }
    return { ...r, tipo: temPostDoJogador ? 'resposta' : 'citacao' };
  });
}

/** Conversa do jogador com o personagem, criada na primeira vez. */
export async function conversaCom(
  tx: Executor,
  mundoId: string,
  p: LinhaPersonagem,
): Promise<string> {
  await tx.insert(conversa).values({ mundoId, personagemId: p.id }).onConflictDoNothing();
  const [c] = await tx
    .select({ id: conversa.id })
    .from(conversa)
    .where(and(eq(conversa.mundoId, mundoId), eq(conversa.personagemId, p.id)));
  return c!.id;
}
