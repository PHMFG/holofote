import { randomUUID } from 'node:crypto';
import {
  acao as tabelaAcao,
  and,
  conversa,
  desc,
  eq,
  lte,
  mensagem,
  mensagemDto,
  ne,
  personagem,
  personagemResumoDto,
  relacao,
  type LinhaConversa,
  type LinhaPersonagem,
} from '@holofote/db';
import { alvoRelacao, calcularDm, criarRng, custoDe } from '@holofote/engine';
import { Conversa, Mensagem, PedidoTexto, RespostaMensagem } from '@holofote/shared';
import { z } from 'zod';
import { publicar, type Contexto } from '../contexto';
import { ErroApi, naoEncontrado } from '../infra/erros';
import { enfileirarIa } from '../infra/filas';
import { aplicarDeltas, consequenciaDto, verificarMarco } from '../servicos/acoes';
import { debitarEnergia } from '../servicos/carteira';
import { carregarSessao, exigirMundo, type SessaoComMundo } from '../servicos/sessao';
import type { Executor } from '../servicos/tipos';
import { moderar } from './mundos';
import { postVisivel } from './posts';
import type { AppZod } from './tipos';

const parametroId = z.object({ id: z.uuid() });

export async function conversaDto(
  db: Executor,
  c: LinhaConversa,
  p: LinhaPersonagem,
  sessao: SessaoComMundo,
): Promise<z.infer<typeof Conversa>> {
  const [rel] = await db
    .select()
    .from(relacao)
    .where(and(eq(relacao.deId, sessao.jogador.id), eq(relacao.paraId, p.id)));
  const [ultima] = await db
    .select()
    .from(mensagem)
    .where(
      and(
        eq(mensagem.conversaId, c.id),
        eq(mensagem.oculto, false),
        lte(mensagem.entregarEm, sessao.agora),
      ),
    )
    .orderBy(desc(mensagem.entregarEm))
    .limit(1);
  return {
    id: c.id,
    personagem: personagemResumoDto(p),
    relacao: { afinidade: rel?.afinidade ?? 50, rotulo: rel?.rotulo ?? 'Conhecidos' },
    ultima: ultima
      ? {
          texto: ultima.texto,
          criadoEm: ultima.entregarEm.toISOString(),
          minha: ultima.autorId === sessao.jogador.id,
        }
      : null,
    naoLidas: c.naoLidas,
    puxouConversa: c.puxouConversa,
    silenciada: p.silenciado,
  };
}

/** Conversa do jogador com um personagem do mundo, criada na primeira vez. */
export async function abrirConversa(db: Executor, sessao: SessaoComMundo, personagemId: string) {
  const [p] = await db
    .select()
    .from(personagem)
    .where(
      and(
        eq(personagem.id, personagemId),
        eq(personagem.mundoId, sessao.mundo.id),
        ne(personagem.papel, 'jogador'),
      ),
    );
  if (!p) throw naoEncontrado('Personagem não encontrado.');
  await db
    .insert(conversa)
    .values({ mundoId: sessao.mundo.id, personagemId: p.id })
    .onConflictDoNothing();
  const [c] = await db
    .select()
    .from(conversa)
    .where(and(eq(conversa.mundoId, sessao.mundo.id), eq(conversa.personagemId, p.id)));
  return { conversa: c!, personagem: p };
}

/**
 * Mensagem do jogador (DM ou resposta a história): débito, delta de relação do motor, marco e job
 * de IA na mesma transação. Custa 1 e o personagem responde pelo worker.
 */
async function enviarMensagem(
  ctx: Contexto,
  sessao: SessaoComMundo,
  c: LinhaConversa,
  p: LinhaPersonagem,
  texto: string,
  tipo: 'dm' | 'historia',
  extra: Record<string, unknown> = {},
) {
  moderar(texto);
  const acaoId = randomUUID();
  const linha = await ctx.db.transaction(async (tx) => {
    await debitarEnergia(tx, sessao.usuario, custoDe(tipo), sessao.agora);
    const [rel] = await tx
      .select()
      .from(relacao)
      .where(and(eq(relacao.deId, sessao.jogador.id), eq(relacao.paraId, p.id)));
    const resultado = calcularDm({
      afinidade: rel?.afinidade ?? 50,
      carisma: sessao.jogador.carisma,
      rng: criarRng(acaoId),
    });
    await tx.insert(tabelaAcao).values({
      id: acaoId,
      mundoId: sessao.mundo.id,
      tipo,
      entrada: { texto, conversaId: c.id, personagemId: p.id, ...extra },
      iaPendente: 1,
      criadoEm: sessao.agora,
    });
    const [nova] = await tx
      .insert(mensagem)
      .values({
        conversaId: c.id,
        autorId: sessao.jogador.id,
        texto,
        entregarEm: sessao.agora,
        acaoId,
      })
      .returning();
    await tx.update(conversa).set({ atualizadaEm: sessao.agora }).where(eq(conversa.id, c.id));
    if (rel && resultado.delta !== 0) {
      await aplicarDeltas(tx, acaoId, sessao.jogador, [
        { alvo: alvoRelacao(p.id), valor: resultado.delta },
      ]);
    }
    const marco = await verificarMarco(tx, sessao.mundo, sessao.jogador.id, sessao.agora);
    await tx
      .update(tabelaAcao)
      .set({
        consequencia: {
          seguidoresGanhos: 0,
          curtidasSimuladas: 0,
          marcoLiberadoId: marco?.id ?? null,
        },
      })
      .where(eq(tabelaAcao.id, acaoId));
    return nova!;
  });

  await enfileirarIa(ctx, 'dm', acaoId);
  const [gravada] = await ctx.db.select().from(tabelaAcao).where(eq(tabelaAcao.id, acaoId));
  const consequencia = await consequenciaDto(ctx.db, gravada!, sessao.usuario, sessao.agora);
  await publicar(ctx, sessao.mundo.id, { tipo: 'energia', energia: consequencia.energia });
  return { mensagem: mensagemDto(linha, sessao.jogador.id), consequencia };
}

export function rotasMensagens(app: AppZod, ctx: Contexto) {
  app.get('/v1/conversas', { schema: { response: { 200: z.array(Conversa) } } }, async (req) => {
    const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
    const linhas = await ctx.db
      .select({ conversa, personagem })
      .from(conversa)
      .innerJoin(personagem, eq(personagem.id, conversa.personagemId))
      .where(eq(conversa.mundoId, sessao.mundo.id))
      .orderBy(desc(conversa.atualizadaEm));
    return Promise.all(linhas.map((l) => conversaDto(ctx.db, l.conversa, l.personagem, sessao)));
  });

  app.post(
    '/v1/personagens/:id/conversa',
    { schema: { params: parametroId, response: { 200: Conversa } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const { conversa: c, personagem: p } = await abrirConversa(ctx.db, sessao, req.params.id);
      return conversaDto(ctx.db, c, p, sessao);
    },
  );

  app.get(
    '/v1/conversas/:id/mensagens',
    { schema: { params: parametroId, response: { 200: z.array(Mensagem) } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const [c] = await ctx.db
        .select()
        .from(conversa)
        .where(and(eq(conversa.id, req.params.id), eq(conversa.mundoId, sessao.mundo.id)));
      if (!c) throw naoEncontrado('Conversa não encontrada.');
      const linhas = await ctx.db
        .select()
        .from(mensagem)
        .where(
          and(
            eq(mensagem.conversaId, c.id),
            eq(mensagem.oculto, false),
            lte(mensagem.entregarEm, sessao.agora),
          ),
        )
        .orderBy(mensagem.entregarEm);
      if (c.naoLidas > 0)
        await ctx.db.update(conversa).set({ naoLidas: 0 }).where(eq(conversa.id, c.id));
      return linhas.map((m) => mensagemDto(m, sessao.jogador.id));
    },
  );

  app.post(
    '/v1/conversas/:id/mensagens',
    { schema: { params: parametroId, body: PedidoTexto, response: { 201: RespostaMensagem } } },
    async (req, reply) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const [linha] = await ctx.db
        .select({ conversa, personagem })
        .from(conversa)
        .innerJoin(personagem, eq(personagem.id, conversa.personagemId))
        .where(and(eq(conversa.id, req.params.id), eq(conversa.mundoId, sessao.mundo.id)));
      if (!linha) throw naoEncontrado('Conversa não encontrada.');
      return reply
        .code(201)
        .send(
          await enviarMensagem(ctx, sessao, linha.conversa, linha.personagem, req.body.texto, 'dm'),
        );
    },
  );

  // Responder a uma história vira mensagem direta com o autor (custo 1).
  app.post(
    '/v1/historias/:id/resposta',
    { schema: { params: parametroId, body: PedidoTexto, response: { 201: RespostaMensagem } } },
    async (req, reply) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const historia = await postVisivel(ctx.db, sessao, req.params.id);
      if (historia.tipo !== 'historia') throw naoEncontrado('História não encontrada.');
      if (historia.autorId === sessao.jogador.id) {
        throw new ErroApi(400, 'invalido', 'Você não pode responder à própria história.');
      }
      const { conversa: c, personagem: p } = await abrirConversa(ctx.db, sessao, historia.autorId);
      return reply.code(201).send(
        await enviarMensagem(ctx, sessao, c, p, req.body.texto, 'historia', {
          historiaId: historia.id,
        }),
      );
    },
  );
}
