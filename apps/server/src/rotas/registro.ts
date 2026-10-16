import { randomUUID } from 'node:crypto';
import {
  acao as tabelaAcao,
  alerta,
  and,
  conversa,
  count,
  delta as tabelaDelta,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  memoria,
  mensagem,
  ne,
  personagem,
  personagensPorId,
  post,
  relacao,
  sql,
  type LinhaAcao,
} from '@holofote/db';
import {
  criarRng,
  custoDe,
  desfazivelAte,
  inverterDeltas,
  lembraDoDesfazer,
  podeDesfazer,
  type Delta,
} from '@holofote/engine';
import { Consequencia, ItemRegistro } from '@holofote/shared';
import { z } from 'zod';
import { publicar, type Contexto } from '../contexto';
import { ErroApi, naoEncontrado } from '../infra/erros';
import { TIPOS_DESFAZIVEIS, aplicarDeltas, consequenciaDto, ehUltimaAcao } from '../servicos/acoes';
import { debitarEnergia } from '../servicos/carteira';
import { carregarSessao, diaEPeriodo, exigirMundo } from '../servicos/sessao';
import type { Executor } from '../servicos/tipos';
import type { AppZod } from './tipos';

const MOTIVOS_DESFAZER = {
  ja_desfeita: 'Essa ação já foi desfeita.',
  nao_e_ultima: 'Só dá para desfazer a última ação.',
  desfazer_expirado: 'Passou de uma hora; não dá mais para desfazer.',
} as const;

const trecho = (texto: unknown) => {
  const t = String(texto ?? '');
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
};

/** Frase curta de interface para o registro (não é fala de personagem). */
function resumoDaAcao(a: LinhaAcao, nomes: Map<string, string>): string {
  const e = a.entrada as Record<string, unknown>;
  const nome = nomes.get(String(e.personagemId ?? '')) ?? 'alguém';
  switch (a.tipo) {
    case 'post':
      return `Publicou: "${trecho(e.texto)}"`;
    case 'resposta':
      return `Respondeu: "${trecho(e.texto)}"`;
    case 'dm':
      return `Mensagem para ${nome}`;
    case 'historia':
      return `Respondeu à história de ${nome}`;
    case 'campanha':
      return `Campanha: ${String(e.rotulo ?? e.acaoCampanha ?? '')}`;
    case 'discurso':
      return e.venceu ? `Discurso ${String(e.opcao)} · venceu` : `Discurso ${String(e.opcao)}`;
    case 'desfazer':
      return 'Desfez a ação anterior';
  }
}

export function rotasRegistro(app: AppZod, ctx: Contexto) {
  app.get('/v1/registro', { schema: { response: { 200: z.array(ItemRegistro) } } }, async (req) => {
    const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
    const acoes = await ctx.db
      .select()
      .from(tabelaAcao)
      .where(eq(tabelaAcao.mundoId, sessao.mundo.id))
      .orderBy(desc(tabelaAcao.criadoEm))
      .limit(50);
    const deltas =
      acoes.length === 0
        ? []
        : await ctx.db
            .select()
            .from(tabelaDelta)
            .where(
              inArray(
                tabelaDelta.acaoId,
                acoes.map((a) => a.id),
              ),
            );
    const pessoas = await personagensPorId(
      ctx.db,
      acoes.flatMap((a) => {
        const id = (a.entrada as Record<string, unknown>).personagemId;
        return typeof id === 'string' ? [id] : [];
      }),
    );
    const nomes = new Map([...pessoas].map(([id, p]) => [id, p.nome]));
    const ultima = acoes.find((a) => TIPOS_DESFAZIVEIS.has(a.tipo) && !a.desfeitaEm);
    return acoes.map((a) => ({
      eventoId: a.id,
      tipo: a.tipo,
      resumo: resumoDaAcao(a, nomes),
      criadoEm: a.criadoEm.toISOString(),
      deltas: deltas
        .filter((d) => d.acaoId === a.id)
        .map((d) => ({ alvo: d.alvo, valor: d.valor })),
      desfazivel: a.id === ultima?.id && desfazivelAte(a.criadoEm) > sessao.agora,
      desfeito: a.desfeitaEm !== null,
    }));
  });

  app.post(
    '/v1/acoes/:id/desfazer',
    { schema: { params: z.object({ id: z.uuid() }), response: { 200: Consequencia } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const [original] = await ctx.db
        .select()
        .from(tabelaAcao)
        .where(and(eq(tabelaAcao.id, req.params.id), eq(tabelaAcao.mundoId, sessao.mundo.id)));
      if (!original) throw naoEncontrado('Ação não encontrada.');
      if (!TIPOS_DESFAZIVEIS.has(original.tipo)) {
        throw new ErroApi(409, 'desfazer_expirado', 'Essa ação não pode ser desfeita.');
      }
      // Checagem barata antes de debitar; a que vale é a de dentro da transação.
      exigirDesfazivel(original, sessao.agora, await ehUltimaAcao(ctx.db, original));

      const desfazerId = randomUUID();
      const { dia } = diaEPeriodo(sessao);
      await ctx.db.transaction(async (tx) => {
        // Debitar trava a linha do usuário: dois desfazer da mesma conta entram em fila aqui.
        await debitarEnergia(tx, sessao.usuario, custoDe('desfazer'), sessao.agora, 'desfazer');
        // Relê a ação com trava (o worker trava a mesma linha antes de gravar reações) e revalida:
        // outro desfazer pode ter passado enquanto este esperava a trava.
        const [travada] = await tx
          .select()
          .from(tabelaAcao)
          .where(eq(tabelaAcao.id, original.id))
          .for('update');
        if (!travada) throw naoEncontrado('Ação não encontrada.');
        exigirDesfazivel(travada, sessao.agora, await ehUltimaAcao(tx, travada));

        const deltas = await tx
          .select({ alvo: tabelaDelta.alvo, valor: tabelaDelta.valor })
          .from(tabelaDelta)
          .where(eq(tabelaDelta.acaoId, original.id));
        await tx.insert(tabelaAcao).values({
          id: desfazerId,
          mundoId: sessao.mundo.id,
          tipo: 'desfazer',
          entrada: { acaoId: original.id },
          consequencia: { seguidoresGanhos: 0, curtidasSimuladas: 0, marcoLiberadoId: null },
          criadoEm: sessao.agora,
        });
        await aplicarDeltas(tx, desfazerId, sessao.jogador, inverterDeltas(deltas as Delta[]));
        await tx
          .update(tabelaAcao)
          .set({ desfeitaEm: sessao.agora, iaPendente: 0 })
          .where(eq(tabelaAcao.id, original.id));

        // Sem nova chamada de IA: o que já chegou some da tela; o que ainda não chegou é apagado.
        const doPost = and(eq(post.acaoId, original.id), eq(post.mundoId, sessao.mundo.id));
        const somem = await tx
          .update(post)
          .set({ oculto: true })
          .where(and(doPost, lte(post.entregarEm, sessao.agora)))
          .returning();
        await tx.delete(post).where(and(doPost, gt(post.entregarEm, sessao.agora)));
        // O contador de respostas só tem o que já foi somado: a resposta do próprio jogador (na
        // hora) e as reações que a fila de entrega já publicou. As apagadas nunca contaram.
        for (const p of somem) {
          if (p.respondeA && (p.autorId === sessao.jogador.id || p.entregueEm !== null)) {
            await tx
              .update(post)
              .set({ respostas: sql`greatest(0, ${post.respostas} - 1)` })
              .where(eq(post.id, p.respondeA));
          }
        }
        const ocultas = await tx
          .update(mensagem)
          .set({ oculto: true })
          .where(and(eq(mensagem.acaoId, original.id), lte(mensagem.entregarEm, sessao.agora)))
          .returning();
        await tx
          .delete(mensagem)
          .where(and(eq(mensagem.acaoId, original.id), gt(mensagem.entregarEm, sessao.agora)));
        for (const conversaId of new Set(ocultas.map((m) => m.conversaId))) {
          const contadas = ocultas.filter(
            (m) =>
              m.conversaId === conversaId &&
              m.autorId !== sessao.jogador.id &&
              m.entregueEm !== null,
          ).length;
          await recalcularNaoLidas(tx, conversaId, sessao.jogador.id, sessao.agora, contadas);
        }

        // Alertas das reações: os futuros somem; os já entregues ficam lidos.
        await tx
          .delete(alerta)
          .where(and(eq(alerta.acaoId, original.id), gt(alerta.entregarEm, sessao.agora)));
        await tx
          .update(alerta)
          .set({ lidoEm: sessao.agora })
          .where(and(eq(alerta.acaoId, original.id), isNull(alerta.lidoEm)));

        // Desafetos e perfis de fofoca podem "lembrar" que o post foi apagado (plano, desfazer).
        const testemunhas = await tx
          .select({ personagem, afinidade: relacao.afinidade })
          .from(relacao)
          .innerJoin(personagem, eq(personagem.id, relacao.paraId))
          .where(eq(relacao.deId, sessao.jogador.id));
        const rng = criarRng(`lembra:${desfazerId}`);
        for (const t of testemunhas) {
          if (
            !lembraDoDesfazer({
              afinidade: t.afinidade,
              perfilFofoca: t.personagem.perfilFofoca,
              rng,
            })
          )
            continue;
          const fato = `Dia ${dia} · viu ${sessao.jogador.nome} apagar ${original.tipo === 'dm' ? 'uma mensagem' : 'um post'}`;
          await tx
            .insert(memoria)
            .values({ personagemId: t.personagem.id, sobreId: sessao.jogador.id, fatos: fato, dia })
            .onConflictDoUpdate({
              target: [memoria.personagemId, memoria.sobreId],
              set: {
                fatos: sql`${memoria.fatos} || E'\n' || ${fato}`,
                dia,
                atualizadoEm: sessao.agora,
              },
            });
        }
      });

      // Jobs de IA da ação desfeita: tira da fila se ainda não rodaram (o worker também confere).
      await Promise.allSettled(
        (['diretor', 'dm'] as const).map((fila) =>
          ctx.filas[fila].remove(`${fila}-${original.id}`),
        ),
      );
      const [gravada] = await ctx.db.select().from(tabelaAcao).where(eq(tabelaAcao.id, desfazerId));
      const consequencia = await consequenciaDto(ctx.db, gravada!, sessao.usuario, sessao.agora);
      await publicar(ctx, sessao.mundo.id, { tipo: 'energia', energia: consequencia.energia });
      return consequencia;
    },
  );
}

function exigirDesfazivel(a: LinhaAcao, agora: Date, ehUltima: boolean) {
  const veredito = podeDesfazer({
    criadaEm: a.criadoEm,
    agora,
    ehUltimaAcao: ehUltima,
    jaDesfeita: a.desfeitaEm !== null,
  });
  if (!veredito.ok) throw new ErroApi(409, 'desfazer_expirado', MOTIVOS_DESFAZER[veredito.motivo]);
}

/**
 * Não lidas depois de esconder mensagens já entregues. Tira as escondidas que a entrega tinha
 * somado e limita ao que o jogador pode não ter visto: mensagens do personagem visíveis depois da
 * última mensagem visível do próprio jogador.
 */
async function recalcularNaoLidas(
  tx: Executor,
  conversaId: string,
  jogadorId: string,
  agora: Date,
  contadas: number,
) {
  const [c] = await tx.select().from(conversa).where(eq(conversa.id, conversaId)).for('update');
  if (!c) return;
  const visiveis = and(
    eq(mensagem.conversaId, conversaId),
    eq(mensagem.oculto, false),
    lte(mensagem.entregarEm, agora),
  );
  const [minha] = await tx
    .select({ entregarEm: mensagem.entregarEm })
    .from(mensagem)
    .where(and(visiveis, eq(mensagem.autorId, jogadorId)))
    .orderBy(desc(mensagem.entregarEm))
    .limit(1);
  const [depois] = await tx
    .select({ total: count() })
    .from(mensagem)
    .where(
      and(
        visiveis,
        ne(mensagem.autorId, jogadorId),
        minha ? gt(mensagem.entregarEm, minha.entregarEm) : undefined,
      ),
    );
  const naoLidas = Math.min(Math.max(0, c.naoLidas - contadas), depois?.total ?? 0);
  if (naoLidas !== c.naoLidas) {
    await tx.update(conversa).set({ naoLidas }).where(eq(conversa.id, conversaId));
  }
}
