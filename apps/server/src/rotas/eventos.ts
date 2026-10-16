import { randomUUID } from 'node:crypto';
import {
  acao as tabelaAcao,
  alerta,
  and,
  eq,
  eventoAgendado,
  isNotNull,
  marco,
  personagem,
  personagensPorId,
  personagemResumoDto,
  relacao,
  type LinhaEventoAgendado,
  type LinhaPersonagem,
} from '@holofote/db';
import {
  CATALOGO_CAMPANHA,
  PERIODOS,
  acaoDeCampanha,
  baseIndicado,
  bonusDaCampanha,
  chancesIndicados,
  criarRng,
  dataLocal,
  efeitosDiscurso,
  ensaiou,
  idDoAlvoRelacao,
  limitarDeltaRelacao,
  opcoesDiscurso,
  sortearVencedor,
} from '@holofote/engine';
import {
  EventoAgendado,
  PedidoCampanha,
  PedidoDiscurso,
  RespostaEventoComConsequencia,
} from '@holofote/shared';
import { z } from 'zod';
import { publicar, type Contexto } from '../contexto';
import { ErroApi, naoEncontrado } from '../infra/erros';
import { enfileirarIa } from '../infra/filas';
import { aplicarDeltas, consequenciaDto, verificarMarco } from '../servicos/acoes';
import { debitarEnergia, moverGemas, travarUsuario } from '../servicos/carteira';
import { carregarSessao, diaEPeriodo, exigirMundo, type SessaoComMundo } from '../servicos/sessao';
import type { Executor } from '../servicos/tipos';
import type { AppZod } from './tipos';

const parametroId = z.object({ id: z.uuid() });
/** 30 segundos para escolher o discurso no ao vivo (plano, eventos agendados). */
const PRAZO_AO_VIVO_MS = 30_000;
/** O discurso especial exige o marco 2 da jornada. */
const ORDEM_MARCO_ESPECIAL = 2;

const MOTIVOS = {
  precisa_ensaiar: 'Ensaie o discurso na campanha.',
  precisa_marco: 'Libere o marco 2 da jornada.',
} as const;

async function carregarEvento(db: Executor, sessao: SessaoComMundo, id: string) {
  const [e] = await db
    .select()
    .from(eventoAgendado)
    .where(and(eq(eventoAgendado.id, id), eq(eventoAgendado.mundoId, sessao.mundo.id)));
  if (!e) throw naoEncontrado('Evento não encontrado.');
  return e;
}

/** Evento travado até o fim da transação (campanha e discurso concorrentes entram em fila). */
async function travarEvento(tx: Executor, sessao: SessaoComMundo, id: string) {
  const [e] = await tx
    .select()
    .from(eventoAgendado)
    .where(and(eq(eventoAgendado.id, id), eq(eventoAgendado.mundoId, sessao.mundo.id)))
    .for('update');
  if (!e) throw naoEncontrado('Evento não encontrado.');
  return e;
}

/**
 * O evento já começou? Depois do dia marcado, sim; no dia, a partir da hora local em que o período
 * começa (noite = 18h). O período "noite" do motor também cobre 0h a 6h, que no dia do evento
 * ainda é a madrugada antes dele.
 */
export function eventoComecou(
  sessao: SessaoComMundo,
  e: Pick<LinhaEventoAgendado, 'diaMundo' | 'periodo'>,
) {
  const { dia } = diaEPeriodo(sessao);
  if (dia !== e.diaMundo) return dia > e.diaMundo;
  return dataLocal(sessao.agora, sessao.usuario.fuso).hora >= PERIODOS[e.periodo].inicio;
}

/**
 * Avança o estado pelo relógio do mundo: campanha antes da hora, ao vivo na hora marcada. Grava só
 * se o estado lido ainda é o do banco, para um GET concorrente não reabrir um evento encerrado.
 */
async function atualizarEstado(db: Executor, sessao: SessaoComMundo, e: LinhaEventoAgendado) {
  if (e.estado === 'encerrado' || e.estado === 'ao_vivo') return e;
  const chegou = eventoComecou(sessao, e);
  const estado = chegou ? 'ao_vivo' : 'campanha';
  if (estado === e.estado) return e;
  const [novo] = await db
    .update(eventoAgendado)
    .set({
      estado,
      prazoAoVivo: chegou ? new Date(sessao.agora.getTime() + PRAZO_AO_VIVO_MS) : null,
    })
    .where(and(eq(eventoAgendado.id, e.id), eq(eventoAgendado.estado, e.estado)))
    .returning();
  // Outro pedido mudou o estado no meio do caminho: vale o que está gravado.
  return novo ?? carregarEvento(db, sessao, e.id);
}

/** Chances dos indicados; a base do jogador sai dos números atuais dele, não da criação. */
function chancesDoEvento(e: LinhaEventoAgendado, jogador: LinhaPersonagem) {
  return chancesIndicados(
    e.indicados.map((i) => ({
      id: i.personagemId,
      base: i.personagemId === jogador.id ? baseIndicado(jogador, true) : i.base,
    })),
    bonusDaCampanha(e.campanha),
    jogador.id,
  );
}

async function marcoEspecialLiberado(db: Executor, sessao: SessaoComMundo) {
  const [especial] = await db
    .select({ id: marco.id })
    .from(marco)
    .where(
      and(
        eq(marco.mundoId, sessao.mundo.id),
        eq(marco.ordem, ORDEM_MARCO_ESPECIAL),
        isNotNull(marco.liberadoEm),
      ),
    );
  return !!especial;
}

async function eventoDto(
  db: Executor,
  sessao: SessaoComMundo,
  e: LinhaEventoAgendado,
): Promise<z.infer<typeof EventoAgendado>> {
  const pessoas = await personagensPorId(db, [
    ...e.indicados.map((i) => i.personagemId),
    ...(e.vencedorId ? [e.vencedorId] : []),
  ]);
  const chances = chancesDoEvento(e, sessao.jogador);
  const especial = await marcoEspecialLiberado(db, sessao);
  const vencedor = e.vencedorId ? pessoas.get(e.vencedorId) : undefined;
  return {
    id: e.id,
    tipo: e.tipo,
    titulo: e.titulo,
    categoria: e.categoria,
    quando: { dia: e.diaMundo, periodo: e.periodo },
    estado: e.estado,
    indicados: chances.flatMap((c) => {
      const p = pessoas.get(c.id);
      return p ? [{ personagem: personagemResumoDto(p), chance: c.chance }] : [];
    }),
    acoes: CATALOGO_CAMPANHA.map((a) => ({
      id: a.id,
      titulo: a.rotulo,
      descricao: a.geraPost
        ? 'Gera um post e reações do mundo.'
        : a.efeito.tipo === 'liberaOusado'
          ? 'Libera o discurso ousado.'
          : 'Aumenta a sua chance.',
      custo: a.custo,
      feita: e.campanha.includes(a.id),
    })),
    discurso: opcoesDiscurso({
      ensaiou: ensaiou(e.campanha),
      marcoEspecialCumprido: especial,
    }).map((o) => ({
      id: o.id,
      titulo: o.rotulo,
      liberada: o.liberada,
      motivo: o.motivo ? MOTIVOS[o.motivo] : null,
    })),
    vencedor: vencedor ? personagemResumoDto(vencedor) : null,
    prazoAoVivo: e.prazoAoVivo?.toISOString() ?? null,
  };
}

export function rotasEventos(app: AppZod, ctx: Contexto) {
  app.get(
    '/v1/eventos/:id',
    { schema: { params: parametroId, response: { 200: EventoAgendado } } },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const e = await atualizarEstado(
        ctx.db,
        sessao,
        await carregarEvento(ctx.db, sessao, req.params.id),
      );
      return eventoDto(ctx.db, sessao, e);
    },
  );

  app.post(
    '/v1/eventos/:id/campanha',
    {
      schema: {
        params: parametroId,
        body: PedidoCampanha,
        response: { 200: RespostaEventoComConsequencia },
      },
    },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      const e = await atualizarEstado(
        ctx.db,
        sessao,
        await carregarEvento(ctx.db, sessao, req.params.id),
      );
      if (e.estado !== 'anunciado' && e.estado !== 'campanha') {
        throw new ErroApi(409, 'campanha_encerrada', 'A campanha deste evento já acabou.');
      }
      const acaoCampanha = acaoDeCampanha(req.body.acaoId);
      if (!acaoCampanha) throw new ErroApi(400, 'invalido', 'Ação de campanha desconhecida.');
      if (e.campanha.includes(acaoCampanha.id)) {
        throw new ErroApi(409, 'campanha_feita', 'Você já fez essa ação de campanha.');
      }
      const acaoId = randomUUID();
      await ctx.db.transaction(async (tx) => {
        // Relê o evento travado: duas campanhas simultâneas não fazem a mesma ação duas vezes, e o
        // ao vivo pode ter começado entre a leitura e aqui.
        const travado = await travarEvento(tx, sessao, e.id);
        if (
          (travado.estado !== 'anunciado' && travado.estado !== 'campanha') ||
          eventoComecou(sessao, travado)
        ) {
          throw new ErroApi(409, 'campanha_encerrada', 'A campanha deste evento já acabou.');
        }
        if (travado.campanha.includes(acaoCampanha.id)) {
          throw new ErroApi(409, 'campanha_feita', 'Você já fez essa ação de campanha.');
        }
        await debitarEnergia(tx, sessao.usuario, acaoCampanha.custo, sessao.agora);
        await tx
          .update(eventoAgendado)
          .set({ campanha: [...travado.campanha, acaoCampanha.id] })
          .where(eq(eventoAgendado.id, e.id));
        await tx.insert(tabelaAcao).values({
          id: acaoId,
          mundoId: sessao.mundo.id,
          tipo: 'campanha',
          entrada: { eventoId: e.id, acaoCampanha: acaoCampanha.id, rotulo: acaoCampanha.rotulo },
          consequencia: { seguidoresGanhos: 0, curtidasSimuladas: 0, marcoLiberadoId: null },
          iaPendente: acaoCampanha.geraPost ? 1 : 0,
          criadoEm: sessao.agora,
        });
      });
      // Só as ações que geram post chamam a IA (plano, tabela de energia).
      if (acaoCampanha.geraPost) await enfileirarIa(ctx, 'diretor', acaoId);
      const [gravada] = await ctx.db.select().from(tabelaAcao).where(eq(tabelaAcao.id, acaoId));
      const consequencia = await consequenciaDto(ctx.db, gravada!, sessao.usuario, sessao.agora);
      await publicar(ctx, sessao.mundo.id, { tipo: 'energia', energia: consequencia.energia });
      return {
        evento: await eventoDto(ctx.db, sessao, await carregarEvento(ctx.db, sessao, e.id)),
        consequencia,
      };
    },
  );

  app.post(
    '/v1/eventos/:id/discurso',
    {
      schema: {
        params: parametroId,
        body: PedidoDiscurso,
        response: { 200: RespostaEventoComConsequencia },
      },
    },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      // O relógio pode abrir o ao vivo agora; a checagem que vale é a de dentro da transação.
      await atualizarEstado(ctx.db, sessao, await carregarEvento(ctx.db, sessao, req.params.id));
      const opcao = req.body.opcao;
      const acaoId = randomUUID();
      await ctx.db.transaction(async (tx) => {
        // Evento travado: só um discurso por evento, e um GET concorrente não o reabre.
        const e = await travarEvento(tx, sessao, req.params.id);
        if (e.estado !== 'ao_vivo') {
          throw new ErroApi(409, 'evento_fora_do_ar', 'O evento não está ao vivo.');
        }
        // Passados os 30 segundos, só o discurso seguro continua valendo.
        if (opcao !== 'seguro' && e.prazoAoVivo && sessao.agora > e.prazoAoVivo) {
          throw new ErroApi(409, 'discurso_bloqueado', 'O tempo acabou.');
        }
        const liberada = opcoesDiscurso({
          ensaiou: ensaiou(e.campanha),
          marcoEspecialCumprido: await marcoEspecialLiberado(tx, sessao),
        }).find((o) => o.id === opcao)?.liberada;
        if (!liberada) {
          throw new ErroApi(409, 'discurso_bloqueado', 'Esse discurso ainda não foi liberado.');
        }
        // Mesma ordem de travas das outras ações (usuário antes do jogador): sem deadlock.
        await travarUsuario(tx, sessao.usuario.id);
        const [jogador] = await tx
          .select()
          .from(personagem)
          .where(eq(personagem.id, sessao.jogador.id));
        const pessoas = await personagensPorId(
          tx,
          e.indicados.map((i) => i.personagemId),
        );
        const rng = criarRng(`discurso:${e.id}`);
        const vencedorId = sortearVencedor(
          chancesDoEvento(e, jogador!).filter((c) => pessoas.has(c.id)),
          rng,
        );
        const venceu = vencedorId === sessao.jogador.id;
        const aliados = await tx
          .select({ id: relacao.paraId, afinidade: relacao.afinidade })
          .from(relacao)
          .where(eq(relacao.deId, sessao.jogador.id));
        const efeito = efeitosDiscurso(
          opcao,
          venceu,
          rng,
          aliados.filter((a) => a.afinidade >= 80).map((a) => a.id),
        );
        // Em evento, o limite de delta de relação é ±12.
        const deltas = efeito.deltas.map((d) =>
          idDoAlvoRelacao(d.alvo) ? { ...d, valor: limitarDeltaRelacao(d.valor, 'evento') } : d,
        );
        await tx.insert(tabelaAcao).values({
          id: acaoId,
          mundoId: sessao.mundo.id,
          tipo: 'discurso',
          entrada: { eventoId: e.id, opcao, venceu, vencedorId },
          iaPendente: 1,
          criadoEm: sessao.agora,
        });
        await aplicarDeltas(tx, acaoId, sessao.jogador, deltas);
        if (efeito.gemas > 0)
          await moverGemas(tx, sessao.usuario.id, efeito.gemas, 'evento', sessao.agora);
        await tx
          .update(eventoAgendado)
          .set({ estado: 'encerrado', vencedorId, discursoEscolhido: opcao })
          .where(eq(eventoAgendado.id, e.id));
        await tx.insert(alerta).values({
          mundoId: sessao.mundo.id,
          tipo: 'evento',
          texto: venceu ? `Você venceu: ${e.titulo}` : `${e.titulo}: resultado saiu`,
          personagemId: venceu ? null : vencedorId,
          acaoId,
          destino: `/evento/${e.id}`,
          entregarEm: sessao.agora,
        });
        const marcoLiberado = await verificarMarco(
          tx,
          sessao.mundo,
          sessao.jogador.id,
          sessao.agora,
        );
        await tx
          .update(tabelaAcao)
          .set({
            consequencia: {
              seguidoresGanhos: 0,
              curtidasSimuladas: 0,
              marcoLiberadoId: marcoLiberado?.id ?? null,
            },
          })
          .where(eq(tabelaAcao.id, acaoId));
      });
      // Só a reação ao discurso chama o modelo principal.
      await enfileirarIa(ctx, 'discurso', acaoId);
      const [gravada] = await ctx.db.select().from(tabelaAcao).where(eq(tabelaAcao.id, acaoId));
      const consequencia = await consequenciaDto(ctx.db, gravada!, sessao.usuario, sessao.agora);
      const evento = await eventoDto(
        ctx.db,
        sessao,
        await carregarEvento(ctx.db, sessao, req.params.id),
      );
      await publicar(ctx, sessao.mundo.id, { tipo: 'evento', evento });
      return { evento, consequencia };
    },
  );
}
