import {
  and,
  asc,
  count,
  desc,
  eq,
  eventoAgendado,
  isNull,
  lte,
  marco,
  ne,
  resumoDia,
} from '@holofote/db';
import { avaliarMarco, progressoDoAto, type RequisitoMarco } from '@holofote/engine';
import { Conta, Jornada, ResumoDia } from '@holofote/shared';
import { z } from 'zod';
import { publicar, type Contexto } from '../contexto';
import { ErroApi, naoEncontrado } from '../infra/erros';
import { enfileirarLote, jobIdDoNovoAto } from '../infra/filas';
import { estadoDosMarcos } from '../servicos/acoes';
import { moverGemas, recarregarEnergia } from '../servicos/carteira';
import { carregarSessao, diaEPeriodo, exigirMundo } from '../servicos/sessao';
import { contaDto } from './conta';
import type { AppZod } from './tipos';

/**
 * Depois de resgatar um marco: se foi o último do ato atual, enfileira o `novo_ato`. Melhor
 * esforço, como a ficha: o resgate já valeu, e o varredor enfileira de novo se algo falhar aqui.
 */
async function enfileirarNovoAtoSeTerminou(
  ctx: Contexto,
  mundoId: string,
  atoDoMarco: number,
  atoDoMundo: number,
) {
  if (atoDoMarco !== atoDoMundo) return;
  try {
    const [{ pendentes } = { pendentes: 1 }] = await ctx.db
      .select({ pendentes: count() })
      .from(marco)
      .where(and(eq(marco.mundoId, mundoId), eq(marco.ato, atoDoMarco), isNull(marco.resgatadoEm)));
    if (pendentes > 0) return;
    const ato = atoDoMarco + 1;
    await enfileirarLote(ctx, 'novo_ato', { mundoId, ato }, jobIdDoNovoAto(mundoId, ato));
  } catch (erro) {
    ctx.log?.warn(
      { job: 'novo_ato', mundoId, erro: (erro as Error).message },
      'novo_ato não enfileirado; o varredor tenta de novo',
    );
  }
}

export function rotasJornada(app: AppZod, ctx: Contexto) {
  app.get('/v1/jornada', { schema: { response: { 200: Jornada } } }, async (req) => {
    const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
    const linhas = await ctx.db
      .select()
      .from(marco)
      .where(and(eq(marco.mundoId, sessao.mundo.id), eq(marco.ato, sessao.mundo.ato)))
      .orderBy(asc(marco.ordem));
    const estado = await estadoDosMarcos(ctx.db, sessao.mundo, sessao.jogador.id);
    const atualId = linhas.find((m) => !m.liberadoEm)?.id;
    const marcos = linhas.map((m) => ({
      id: m.id,
      ordem: m.ordem,
      titulo: m.titulo,
      descricao: m.descricao,
      estado: m.liberadoEm
        ? ('concluido' as const)
        : m.id === atualId
          ? ('atual' as const)
          : ('futuro' as const),
      requisitos: avaliarMarco(m.requisitos as RequisitoMarco[], estado).requisitos,
      recompensa: m.recompensa,
      liberadoEm: m.liberadoEm?.toISOString() ?? null,
      resgatado: m.resgatadoEm !== null,
    }));
    const [proximo] = await ctx.db
      .select()
      .from(eventoAgendado)
      .where(
        and(eq(eventoAgendado.mundoId, sessao.mundo.id), ne(eventoAgendado.estado, 'encerrado')),
      )
      .orderBy(asc(eventoAgendado.diaMundo))
      .limit(1);
    return {
      ato: sessao.mundo.ato,
      objetivo: sessao.mundo.objetivoAto ?? '',
      progressoAto: progressoDoAto(
        marcos.map((m) => ({ concluido: m.estado === 'concluido', requisitos: m.requisitos })),
      ),
      marcos,
      // Ato terminado e resgatado: o job `novo_ato` está escrevendo o próximo.
      ...(marcos.length > 0 && marcos.every((m) => m.resgatado)
        ? { proximoAto: { ato: sessao.mundo.ato + 1 } }
        : {}),
      proximoEvento: proximo
        ? {
            id: proximo.id,
            titulo: proximo.titulo,
            quando: { dia: proximo.diaMundo, periodo: proximo.periodo },
            estado: proximo.estado,
          }
        : null,
    };
  });

  // Resgatar a recompensa de um marco liberado: gemas, energia cheia e, pelo worker, um personagem novo.
  app.post(
    '/v1/marcos/:id/resgatar',
    { schema: { params: z.object({ id: z.uuid() }), response: { 200: Conta } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const [m] = await ctx.db
        .select()
        .from(marco)
        .where(and(eq(marco.id, req.params.id), eq(marco.mundoId, sessao.mundo.id)));
      if (!m) throw naoEncontrado('Marco não encontrado.');
      if (!m.liberadoEm)
        throw new ErroApi(409, 'marco_bloqueado', 'Esse marco ainda não foi liberado.');
      if (m.resgatadoEm) throw new ErroApi(409, 'marco_resgatado', 'Você já resgatou esse marco.');
      await ctx.db.transaction(async (tx) => {
        // Só um resgate passa: o segundo pedido simultâneo não encontra a linha sem resgate.
        const [resgatado] = await tx
          .update(marco)
          .set({ resgatadoEm: sessao.agora })
          .where(and(eq(marco.id, m.id), isNull(marco.resgatadoEm)))
          .returning({ id: marco.id });
        if (!resgatado) throw new ErroApi(409, 'marco_resgatado', 'Você já resgatou esse marco.');
        await moverGemas(tx, sessao.usuario.id, m.recompensa.gemas, 'marco', sessao.agora);
        if (m.recompensa.energiaCheia)
          await recarregarEnergia(tx, sessao.usuario, 'marco', sessao.agora);
      });
      if (m.recompensa.personagemNovo) {
        await enfileirarLote(
          ctx,
          'ficha',
          { mundoId: sessao.mundo.id, marcoId: m.id },
          `ficha-${m.id}`,
        );
      }
      await enfileirarNovoAtoSeTerminou(ctx, sessao.mundo.id, m.ato, sessao.mundo.ato);
      const conta = await contaDto(ctx, await carregarSessao(ctx, req.usuarioId));
      await publicar(ctx, sessao.mundo.id, { tipo: 'energia', energia: conta.energia });
      return conta;
    },
  );

  // Resumo do dia atual (ou o mais recente), gerado pelo lote da madrugada.
  app.get('/v1/resumo-do-dia', { schema: { response: { 200: ResumoDia } } }, async (req) => {
    const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
    const { dia } = diaEPeriodo(sessao);
    const [r] = await ctx.db
      .select()
      .from(resumoDia)
      .where(and(eq(resumoDia.mundoId, sessao.mundo.id), lte(resumoDia.dia, dia)))
      .orderBy(desc(resumoDia.dia))
      .limit(1);
    if (!r) throw naoEncontrado('Ainda não há resumo do dia.');
    return { dia: r.dia, manchete: r.manchete, numeros: r.numeros, pendencias: r.pendencias };
  });
}
