import { eq, lancamentoEnergia, lancamentoGemas, usuario } from '@holofote/db';
import { ENERGIA, GEMAS } from '@holofote/engine';
import {
  Aparencia,
  Conta,
  EstadoEnergia,
  PedidoAuth,
  PedidoRecarga,
  RespostaAuth,
  RespostaRecarga,
} from '@holofote/shared';
import { z } from 'zod';
import { publicar, type Contexto } from '../contexto';
import { emitirToken } from '../infra/auth';
import { ErroApi } from '../infra/erros';
import {
  anunciosRestantesHoje,
  energiaDto,
  estadoEnergia,
  moverGemas,
  recarregarEnergia,
  saldoGemas,
  travarUsuario,
} from '../servicos/carteira';
import { carregarSessao, type Sessao } from '../servicos/sessao';
import type { AppZod } from './tipos';

export async function contaDto(ctx: Contexto, sessao: Sessao): Promise<z.infer<typeof Conta>> {
  const { usuario: u, agora } = sessao;
  return {
    usuarioId: u.id,
    plano: u.plano,
    gemas: await saldoGemas(ctx.db, u.id),
    energia: energiaDto(await estadoEnergia(ctx.db, u, agora), u.plano),
    aparencia: { tema: u.tema, destaque: u.destaque },
    mundoId: sessao.mundo?.id ?? null,
    anunciosRestantesHoje: await anunciosRestantesHoje(ctx.db, u, agora),
  };
}

export function rotasConta(app: AppZod, ctx: Contexto) {
  // Login anônimo por aparelho: cria o usuário na primeira vez, com energia cheia e 40 gemas.
  app.post(
    '/v1/auth/anonimo',
    { schema: { body: PedidoAuth, response: { 200: RespostaAuth } } },
    async (req) => {
      const agora = ctx.agoraReal();
      const id = await ctx.db.transaction(async (tx) => {
        const [existente] = await tx
          .select()
          .from(usuario)
          .where(eq(usuario.aparelhoId, req.body.aparelhoId));
        if (existente) return existente.id;
        // Dois logins simultâneos do mesmo aparelho: o segundo espera o primeiro, não insere nada
        // e relê o usuário criado (em vez de 500 por violação de unicidade).
        const [novo] = await tx
          .insert(usuario)
          .values({ aparelhoId: req.body.aparelhoId })
          .onConflictDoNothing({ target: usuario.aparelhoId })
          .returning();
        if (!novo) {
          const [criado] = await tx
            .select()
            .from(usuario)
            .where(eq(usuario.aparelhoId, req.body.aparelhoId));
          return criado!.id;
        }
        await tx.insert(lancamentoEnergia).values({
          usuarioId: novo.id,
          valor: ENERGIA.free.max,
          motivo: 'inicial',
          criadoEm: agora,
        });
        await tx.insert(lancamentoGemas).values({
          usuarioId: novo.id,
          valor: GEMAS.iniciais,
          motivo: 'inicial',
          criadoEm: agora,
        });
        return novo.id;
      });
      return { token: await emitirToken(id, ctx.config.JWT_SEGREDO), usuarioId: id };
    },
  );

  app.get('/v1/conta', { schema: { response: { 200: Conta } } }, async (req) =>
    contaDto(ctx, await carregarSessao(ctx, req.usuarioId)),
  );

  app.patch(
    '/v1/conta/aparencia',
    { schema: { body: Aparencia, response: { 200: Conta } } },
    async (req) => {
      await ctx.db.update(usuario).set(req.body).where(eq(usuario.id, req.usuarioId));
      return contaDto(ctx, await carregarSessao(ctx, req.usuarioId));
    },
  );

  // Holofote Plus placebo (decisão do dono): liga e desliga sem cobrança.
  app.post(
    '/v1/conta/plus',
    { schema: { body: z.object({ ativo: z.boolean() }), response: { 200: Conta } } },
    async (req) => {
      await ctx.db
        .update(usuario)
        .set({ plano: req.body.ativo ? 'plus' : 'free' })
        .where(eq(usuario.id, req.usuarioId));
      const sessao = await carregarSessao(ctx, req.usuarioId);
      const conta = await contaDto(ctx, sessao);
      if (sessao.mundo)
        await publicar(ctx, sessao.mundo.id, { tipo: 'energia', energia: conta.energia });
      return conta;
    },
  );

  app.get('/v1/energia', { schema: { response: { 200: EstadoEnergia } } }, async (req) => {
    const { usuario: u, agora } = await carregarSessao(ctx, req.usuarioId);
    return energiaDto(await estadoEnergia(ctx.db, u, agora), u.plano);
  });

  app.post(
    '/v1/energia/recarga',
    { schema: { body: PedidoRecarga, response: { 200: RespostaRecarga } } },
    async (req) => {
      const sessao = await carregarSessao(ctx, req.usuarioId);
      const { usuario: u, agora } = sessao;
      await ctx.db.transaction(async (tx) => {
        // Trava o usuário antes de contar anúncios e ler a energia: duas recargas simultâneas não
        // passam as duas pela checagem.
        await travarUsuario(tx, u.id);
        if (req.body.via === 'anuncio' && (await anunciosRestantesHoje(tx, u, agora)) === 0) {
          throw new ErroApi(409, 'limite_anuncio', 'Você já viu os anúncios de hoje.');
        }
        const estado = await estadoEnergia(tx, u, agora);
        if (estado.atual >= estado.max) {
          if (req.body.via === 'gemas') {
            throw new ErroApi(409, 'energia_cheia', 'Sua energia já está cheia.');
          }
          return;
        }
        if (req.body.via === 'gemas') {
          await moverGemas(tx, u.id, -GEMAS.encherEnergia, 'energia', agora);
        }
        await recarregarEnergia(tx, u, req.body.via, agora);
      });
      const energia = energiaDto(await estadoEnergia(ctx.db, u, agora), u.plano);
      if (sessao.mundo) await publicar(ctx, sessao.mundo.id, { tipo: 'energia', energia });
      return {
        energia,
        gemas: await saldoGemas(ctx.db, u.id),
        anunciosRestantesHoje: await anunciosRestantesHoje(ctx.db, u, agora),
      };
    },
  );
}
