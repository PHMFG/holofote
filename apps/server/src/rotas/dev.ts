import { chamadaLlm, eq, gte, mundo, sql } from '@holofote/db';
import { PedidoRelogio } from '@holofote/shared';
import { z } from 'zod';
import { publicar, type Contexto } from '../contexto';
import { energiaDto, estadoEnergia } from '../servicos/carteira';
import { mundoDto } from '../servicos/dto';
import { carregarSessao, diaEPeriodo, exigirMundo } from '../servicos/sessao';
import type { AppZod } from './tipos';

/** Rotas de desenvolvimento (fora de produção): relógio simulado, lote na hora e custos de IA. */
export function rotasDev(app: AppZod, ctx: Contexto) {
  app.post(
    '/v1/dev/relogio',
    {
      schema: {
        body: PedidoRelogio,
        response: { 200: z.object({ deslocamentoMin: z.number(), agora: z.string() }) },
      },
    },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId), { pronto: false });
      const [atualizado] = await ctx.db
        .update(mundo)
        .set({ deslocamentoMin: sql`${mundo.deslocamentoMin} + ${req.body.avancarMinutos}` })
        .where(eq(mundo.id, sessao.mundo.id))
        .returning();
      const depois = exigirMundo(await carregarSessao(ctx, req.usuarioId), { pronto: false });
      await publicar(ctx, depois.mundo.id, {
        tipo: 'energia',
        energia: energiaDto(
          await estadoEnergia(ctx.db, depois.usuario, depois.agora),
          depois.usuario.plano,
        ),
      });
      await publicar(ctx, depois.mundo.id, {
        tipo: 'mundo',
        mundo: await mundoDto(ctx.db, depois),
      });
      return { deslocamentoMin: atualizado!.deslocamentoMin, agora: depois.agora.toISOString() };
    },
  );

  app.post('/v1/dev/lote', async (req, reply) => {
    const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
    const { dia } = diaEPeriodo(sessao);
    await ctx.filas.lote.add(
      'lote_diario',
      { mundoId: sessao.mundo.id, dia },
      { jobId: `lote_diario-${sessao.mundo.id}-${dia}-${Date.now()}` },
    );
    return reply.code(202).send();
  });

  app.get('/v1/dev/custos', async () => {
    const desde = new Date(Date.now() - 24 * 3600_000);
    const porJob = await ctx.db
      .select({
        job: chamadaLlm.job,
        chamadas: sql<number>`count(*)::int`,
        custoUsd: sql<number>`coalesce(sum(${chamadaLlm.custoUsd}), 0)::float`,
        falhas: sql<number>`count(*) filter (where not ${chamadaLlm.ok})::int`,
      })
      .from(chamadaLlm)
      .where(gte(chamadaLlm.criadoEm, desde))
      .groupBy(chamadaLlm.job);
    return { ultimas24h: porJob, totalUsd: porJob.reduce((s, j) => s + j.custoUsd, 0) };
  });
}
