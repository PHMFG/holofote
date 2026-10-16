import { randomUUID } from 'node:crypto';
import {
  acao as tabelaAcao,
  and,
  curtida,
  eq,
  gt,
  historiaVista,
  inArray,
  isNull,
  lte,
  or,
  personagem,
  personagemResumoDto,
  post,
  postDto,
  postsDto,
  relacao,
  sql,
  voto,
  type LinhaPersonagem,
  type LinhaPost,
} from '@holofote/db';
import { calcularPost, calcularResposta, criarRng, custoDe, previa } from '@holofote/engine';
import {
  PedidoPost,
  PedidoTexto,
  PedidoVoto,
  Post,
  RespostaAcaoComPost,
  RespostaPrevia,
  RespostaThread,
} from '@holofote/shared';
import { z } from 'zod';
import { publicar, type Contexto } from '../contexto';
import { ErroApi, naoEncontrado } from '../infra/erros';
import { enfileirarIa } from '../infra/filas';
import { aplicarDeltas, consequenciaDto, verificarMarco } from '../servicos/acoes';
import { debitarEnergia } from '../servicos/carteira';
import { carregarSessao, exigirMundo, type SessaoComMundo } from '../servicos/sessao';
import type { Executor } from '../servicos/tipos';
import { moderar } from './mundos';
import type { AppZod } from './tipos';

const parametroId = z.object({ id: z.uuid() });

/** Faixa do motor (readonly) no formato de tupla do contrato. */
const par = (f: readonly [number, number]): [number, number] => [f[0], f[1]];

const numerosDe = (p: LinhaPersonagem) => ({
  fama: p.fama,
  carisma: p.carisma,
  polemica: p.polemica,
  seguidores: p.seguidores,
});

/** Post visível do mundo da sessão (entregue, não escondido e, se for história, não vencido), ou 404. */
export async function postVisivel(
  db: Executor,
  sessao: SessaoComMundo,
  id: string,
): Promise<LinhaPost> {
  const [linha] = await db
    .select()
    .from(post)
    .where(
      and(
        eq(post.id, id),
        eq(post.mundoId, sessao.mundo.id),
        eq(post.oculto, false),
        lte(post.entregarEm, sessao.agora),
        or(isNull(post.expiraEm), gt(post.expiraEm, sessao.agora)),
      ),
    );
  if (!linha) throw naoEncontrado('Post não encontrado.');
  return linha;
}

/** Marcados do pedido: personagens do mesmo mundo (não o jogador), com a afinidade atual. */
async function marcadosComAfinidade(db: Executor, sessao: SessaoComMundo, ids: readonly string[]) {
  if (ids.length === 0) return [];
  const linhas = await db
    .select({ personagem, afinidade: relacao.afinidade })
    .from(personagem)
    .innerJoin(relacao, and(eq(relacao.deId, sessao.jogador.id), eq(relacao.paraId, personagem.id)))
    .where(and(eq(personagem.mundoId, sessao.mundo.id), inArray(personagem.id, [...ids])));
  if (linhas.length !== new Set(ids).size)
    throw new ErroApi(400, 'invalido', 'Personagem marcado inválido.');
  return linhas;
}

export function rotasPosts(app: AppZod, ctx: Contexto) {
  app.post(
    '/v1/posts/previa',
    { schema: { body: PedidoPost, response: { 200: RespostaPrevia } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const marcados = await marcadosComAfinidade(ctx.db, sessao, req.body.marcados);
      const resultado = previa({
        jogador: numerosDe(sessao.jogador),
        tom: req.body.tom,
        marcados: marcados.map((m) => ({ id: m.personagem.id, afinidade: m.afinidade })),
      });
      return {
        custo: resultado.custo,
        alcance: par(resultado.alcance),
        seguidores: par(resultado.seguidores),
        polemica: par(resultado.polemica),
        relacoes: resultado.relacoes.flatMap((r) => {
          const m = marcados.find((x) => x.personagem.id === r.id);
          return m
            ? [{ personagem: personagemResumoDto(m.personagem), afinidade: par(r.afinidade) }]
            : [];
        }),
      };
    },
  );

  app.post(
    '/v1/posts',
    { schema: { body: PedidoPost, response: { 201: RespostaAcaoComPost } } },
    async (req, reply) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      moderar(req.body.texto);
      const acaoId = randomUUID();
      const linhaPost = await ctx.db.transaction(async (tx) => {
        await debitarEnergia(tx, sessao.usuario, custoDe('post'), sessao.agora);
        const marcados = await marcadosComAfinidade(tx, sessao, req.body.marcados);
        const resultado = calcularPost({
          jogador: numerosDe(sessao.jogador),
          tom: req.body.tom,
          marcados: marcados.map((m) => ({ id: m.personagem.id, afinidade: m.afinidade })),
          rng: criarRng(acaoId),
        });
        await tx.insert(tabelaAcao).values({
          id: acaoId,
          mundoId: sessao.mundo.id,
          tipo: 'post',
          entrada: req.body,
          iaPendente: 1,
          criadoEm: sessao.agora,
        });
        const [novo] = await tx
          .insert(post)
          .values({
            mundoId: sessao.mundo.id,
            autorId: sessao.jogador.id,
            texto: req.body.texto,
            tom: req.body.tom,
            marcados: req.body.marcados,
            origem: 'jogador',
            acaoId,
            entregarEm: sessao.agora,
            curtidas: resultado.curtidasSimuladas,
          })
          .returning();
        await aplicarDeltas(tx, acaoId, sessao.jogador, resultado.deltas);
        const marco = await verificarMarco(tx, sessao.mundo, sessao.jogador.id, sessao.agora);
        await tx
          .update(tabelaAcao)
          .set({
            consequencia: {
              seguidoresGanhos: resultado.seguidoresGanhos,
              curtidasSimuladas: resultado.curtidasSimuladas,
              marcoLiberadoId: marco?.id ?? null,
            },
          })
          .where(eq(tabelaAcao.id, acaoId));
        return novo!;
      });
      return reply.code(201).send(await depoisDaAcao(ctx, sessao, acaoId, linhaPost, 'diretor'));
    },
  );

  app.get(
    '/v1/posts/:id',
    { schema: { params: parametroId, response: { 200: Post } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      return postDto(ctx.db, await postVisivel(ctx.db, sessao, req.params.id), sessao.jogador.id);
    },
  );

  // Curtir é grátis e não chama IA: alterna a curtida do jogador.
  app.post(
    '/v1/posts/:id/curtir',
    { schema: { params: parametroId, response: { 200: Post } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const alvo = await postVisivel(ctx.db, sessao, req.params.id);
      const atualizado = await ctx.db.transaction(async (tx) => {
        const apagadas = await tx
          .delete(curtida)
          .where(and(eq(curtida.postId, alvo.id), eq(curtida.personagemId, sessao.jogador.id)))
          .returning();
        if (apagadas.length === 0) {
          await tx.insert(curtida).values({ postId: alvo.id, personagemId: sessao.jogador.id });
        }
        const [linha] = await tx
          .update(post)
          .set({ curtidas: sql`greatest(0, ${post.curtidas} + ${apagadas.length === 0 ? 1 : -1})` })
          .where(eq(post.id, alvo.id))
          .returning();
        return linha!;
      });
      return postDto(ctx.db, atualizado, sessao.jogador.id);
    },
  );

  app.get(
    '/v1/posts/:id/respostas',
    { schema: { params: parametroId, response: { 200: RespostaThread } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const raiz = await postVisivel(ctx.db, sessao, req.params.id);
      const arvore = await ctx.db.execute<{ id: string }>(sql`
        with recursive arvore as (
          select id from post where responde_a = ${raiz.id}
          union all
          select p.id from post p join arvore a on p.responde_a = a.id
        )
        select id from arvore`);
      const ids = arvore.map((r) => r.id);
      const respostas =
        ids.length === 0
          ? []
          : await ctx.db
              .select()
              .from(post)
              .where(
                and(
                  inArray(post.id, ids),
                  eq(post.oculto, false),
                  lte(post.entregarEm, sessao.agora),
                ),
              )
              .orderBy(post.entregarEm);
      return {
        post: await postDto(ctx.db, raiz, sessao.jogador.id),
        respostas: await postsDto(ctx.db, respostas, sessao.jogador.id),
        digitando: [],
      };
    },
  );

  app.post(
    '/v1/posts/:id/respostas',
    { schema: { params: parametroId, body: PedidoTexto, response: { 201: RespostaAcaoComPost } } },
    async (req, reply) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      moderar(req.body.texto);
      const alvo = await postVisivel(ctx.db, sessao, req.params.id);
      // História se responde por DM (POST /historias/:id/resposta), não com comentário.
      if (alvo.tipo !== 'post') throw naoEncontrado('Post não encontrado.');
      const acaoId = randomUUID();
      const linhaPost = await ctx.db.transaction(async (tx) => {
        await debitarEnergia(tx, sessao.usuario, custoDe('resposta'), sessao.agora);
        const [rel] = await tx
          .select()
          .from(relacao)
          .where(and(eq(relacao.deId, sessao.jogador.id), eq(relacao.paraId, alvo.autorId)));
        const resultado = calcularResposta({
          jogador: numerosDe(sessao.jogador),
          autor: { id: alvo.autorId, afinidade: rel?.afinidade ?? 50 },
          rng: criarRng(acaoId),
        });
        // Responder a si mesmo não mexe em relação nenhuma.
        const deltas = resultado.deltas.filter((d) => rel || !d.alvo.startsWith('relacao:'));
        await tx.insert(tabelaAcao).values({
          id: acaoId,
          mundoId: sessao.mundo.id,
          tipo: 'resposta',
          entrada: { texto: req.body.texto, respondeA: alvo.id },
          iaPendente: 1,
          criadoEm: sessao.agora,
        });
        const [nova] = await tx
          .insert(post)
          .values({
            mundoId: sessao.mundo.id,
            autorId: sessao.jogador.id,
            respondeA: alvo.id,
            texto: req.body.texto,
            origem: 'jogador',
            acaoId,
            entregarEm: sessao.agora,
            curtidas: resultado.curtidasSimuladas,
          })
          .returning();
        await tx
          .update(post)
          .set({ respostas: sql`${post.respostas} + 1` })
          .where(eq(post.id, alvo.id));
        await aplicarDeltas(tx, acaoId, sessao.jogador, deltas);
        const marco = await verificarMarco(tx, sessao.mundo, sessao.jogador.id, sessao.agora);
        await tx
          .update(tabelaAcao)
          .set({
            consequencia: {
              seguidoresGanhos: resultado.seguidoresGanhos,
              curtidasSimuladas: resultado.curtidasSimuladas,
              marcoLiberadoId: marco?.id ?? null,
            },
          })
          .where(eq(tabelaAcao.id, acaoId));
        return nova!;
      });
      return reply.code(201).send(await depoisDaAcao(ctx, sessao, acaoId, linhaPost, 'diretor'));
    },
  );

  // Abrir uma história marca como vista; votar é grátis e não chama IA.
  app.get(
    '/v1/historias/:id',
    { schema: { params: parametroId, response: { 200: Post } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const historia = await postVisivel(ctx.db, sessao, req.params.id);
      if (historia.tipo !== 'historia') throw naoEncontrado('História não encontrada.');
      await ctx.db
        .insert(historiaVista)
        .values({ postId: historia.id, personagemId: sessao.jogador.id })
        .onConflictDoNothing();
      return postDto(ctx.db, historia, sessao.jogador.id);
    },
  );

  app.post(
    '/v1/historias/:id/voto',
    { schema: { params: parametroId, body: PedidoVoto, response: { 200: Post } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const historia = await postVisivel(ctx.db, sessao, req.params.id);
      if (!historia.enquete?.opcoes.some((o) => o.id === req.body.opcao)) {
        throw new ErroApi(400, 'invalido', 'Opção de enquete inválida.');
      }
      await ctx.db
        .insert(voto)
        .values({ postId: historia.id, personagemId: sessao.jogador.id, opcao: req.body.opcao })
        .onConflictDoUpdate({
          target: [voto.postId, voto.personagemId],
          set: { opcao: req.body.opcao },
        });
      return postDto(ctx.db, historia, sessao.jogador.id);
    },
  );
}

/** Depois do commit: enfileira a IA, avisa a energia pelo tempo real e monta a resposta. */
export async function depoisDaAcao(
  ctx: Contexto,
  sessao: SessaoComMundo,
  acaoId: string,
  linhaPost: LinhaPost,
  fila: 'diretor',
) {
  await enfileirarIa(ctx, fila, acaoId);
  const [acaoGravada] = await ctx.db.select().from(tabelaAcao).where(eq(tabelaAcao.id, acaoId));
  const consequencia = await consequenciaDto(ctx.db, acaoGravada!, sessao.usuario, sessao.agora);
  await publicar(ctx, sessao.mundo.id, { tipo: 'energia', energia: consequencia.energia });
  return { post: await postDto(ctx.db, linhaPost, sessao.jogador.id), consequencia };
}
