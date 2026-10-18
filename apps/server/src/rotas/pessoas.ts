import {
  alerta,
  alertaDto,
  and,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  memoria,
  ne,
  personagem,
  personagemResumoDto,
  personagensPorId,
  relacao,
} from '@holofote/db';
import { Alerta, PedidoSilenciar, Personagem, RespostaRelacoes } from '@holofote/shared';
import { z } from 'zod';
import type { Contexto } from '../contexto';
import { ErroApi, naoEncontrado } from '../infra/erros';
import { personagemDto } from '../servicos/dto';
import { carregarSessao, exigirMundo } from '../servicos/sessao';
import type { AppZod } from './tipos';

export function rotasPessoas(app: AppZod, ctx: Contexto) {
  app.get(
    '/v1/personagens/:id',
    { schema: { params: z.object({ id: z.uuid() }), response: { 200: Personagem } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const [p] = await ctx.db
        .select()
        .from(personagem)
        .where(and(eq(personagem.id, req.params.id), eq(personagem.mundoId, sessao.mundo.id)));
      if (!p) throw naoEncontrado('Personagem não encontrado.');
      return personagemDto(ctx.db, p, sessao.jogador.id);
    },
  );

  // Silenciar: o personagem some do feed e da lista de conversas e o worker não o chama para
  // reagir. Grátis, reversível e sem IA.
  app.post(
    '/v1/personagens/:id/silenciar',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        body: PedidoSilenciar,
        response: { 200: Personagem },
      },
    },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const [p] = await ctx.db
        .select()
        .from(personagem)
        .where(and(eq(personagem.id, req.params.id), eq(personagem.mundoId, sessao.mundo.id)));
      if (!p) throw naoEncontrado('Personagem não encontrado.');
      if (p.papel === 'jogador') throw new ErroApi(400, 'invalido', 'Você não pode se silenciar.');
      const [atualizado] = await ctx.db
        .update(personagem)
        .set({ silenciado: req.body.silenciado })
        .where(eq(personagem.id, p.id))
        .returning();
      return personagemDto(ctx.db, atualizado!, sessao.jogador.id);
    },
  );

  // Mapa de relações (21): todos com quem o jogador tem relação, do mais próximo ao mais distante.
  app.get('/v1/relacoes', { schema: { response: { 200: RespostaRelacoes } } }, async (req) => {
    const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
    const linhas = await ctx.db
      .select({ personagem, afinidade: relacao.afinidade, rotulo: relacao.rotulo })
      .from(relacao)
      .innerJoin(personagem, eq(personagem.id, relacao.paraId))
      .where(and(eq(relacao.deId, sessao.jogador.id), ne(personagem.papel, 'jogador')))
      .orderBy(desc(relacao.afinidade));
    const memorias = await ctx.db
      .select()
      .from(memoria)
      .where(
        and(
          eq(memoria.sobreId, sessao.jogador.id),
          inArray(
            memoria.personagemId,
            linhas.map((l) => l.personagem.id),
          ),
        ),
      );
    return {
      jogador: personagemResumoDto(sessao.jogador),
      nos: linhas.map((l) => ({
        personagem: personagemResumoDto(l.personagem),
        relacao: { afinidade: l.afinidade, rotulo: l.rotulo },
        lembra:
          memorias
            .find((m) => m.personagemId === l.personagem.id)
            ?.fatos.split('\n')
            .filter(Boolean) ?? [],
      })),
    };
  });

  app.get('/v1/alertas', { schema: { response: { 200: z.array(Alerta) } } }, async (req) => {
    const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
    const linhas = await ctx.db
      .select()
      .from(alerta)
      .where(and(eq(alerta.mundoId, sessao.mundo.id), lte(alerta.entregarEm, sessao.agora)))
      .orderBy(desc(alerta.entregarEm))
      .limit(60);
    const pessoas = await personagensPorId(
      ctx.db,
      linhas.flatMap((a) => (a.personagemId ? [a.personagemId] : [])),
    );
    return linhas.map((a) =>
      alertaDto(a, a.personagemId ? (pessoas.get(a.personagemId) ?? null) : null),
    );
  });

  app.post('/v1/alertas/lidos', async (req, reply) => {
    const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
    await ctx.db
      .update(alerta)
      .set({ lidoEm: sessao.agora })
      .where(
        and(
          eq(alerta.mundoId, sessao.mundo.id),
          isNull(alerta.lidoEm),
          lte(alerta.entregarEm, sessao.agora),
        ),
      );
    return reply.code(204).send();
  });
}
