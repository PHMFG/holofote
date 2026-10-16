// lote_diario: a virada do dia do mundo. O motor fecha os números (variação do dia, queda da
// polêmica, quem pode puxar conversa); a IA escreve o feed do dia, histórias com enquete, o resumo
// da manhã, memórias resumidas e, quando o motor deixa, uma conversa puxada por alguém.
import {
  acao as tabelaAcao,
  alerta,
  and,
  delta as tabelaDelta,
  desc,
  eq,
  eventoAgendado,
  gte,
  inArray,
  isNull,
  isNotNull,
  lte,
  marco,
  memoria,
  mundo as tabelaMundo,
  ne,
  personagem,
  post,
  resumoDia,
  sql,
  type LinhaAcao,
  type LinhaPersonagem,
} from '@holofote/db';
import {
  criarRng,
  decairPolemica,
  diaDoMundo,
  aplicarDeslocamento,
  espalharEntregas,
} from '@holofote/engine';
import type { ItemMemoria } from '@holofote/llm';
import type { ContextoWorker } from '../contexto';
import {
  carregarCena,
  jogadorAtual,
  jogadorPrompt,
  pessoaCurta,
  personagemPrompt,
  personagensDoMundo,
  relacoesDoJogador,
  type Cena,
} from '../infra/cena';
import {
  agendarEntregas,
  gravarFeed,
  gravarResumo,
  numerosDoResumo,
  parDeMemoria,
} from '../infra/feed';
import { gerar } from '../infra/ia';
import type { Executor } from '../infra/relacoes';

const HORA = 3600_000;
/** Posts do dia (o plano pede de 15 a 25). */
export const POSTS_DO_DIA = 15;
/** Parte do feed que já aparece na hora; o resto chega ao longo do dia. */
const POSTS_IMEDIATOS = 6;
/** Memórias com mais fatos que isso são resumidas no lote. */
const FATOS_PARA_RESUMIR = 8;

export interface PedidoLoteDiario {
  mundoId: string;
  dia: number;
  /** Veio do agendamento das 04h30 (não repete o dia); a rota de dev força. */
  agendado?: boolean;
}

type Variacao = Partial<Record<'seguidores' | 'fama' | 'carisma' | 'polemica', number>>;

function descreverAcao(a: LinhaAcao, nomes: ReadonlyMap<string, string>): string | null {
  const e = a.entrada as Record<string, unknown>;
  const texto = typeof e.texto === 'string' ? `"${e.texto.slice(0, 140)}"` : '';
  switch (a.tipo) {
    case 'post':
      return `postou ${texto}${e.tom ? ` (tom ${String(e.tom)})` : ''}`;
    case 'resposta':
      return `comentou ${texto}`;
    case 'dm':
    case 'historia': {
      const nome = nomes.get(String(e.personagemId)) ?? 'alguém';
      return `mandou mensagem para ${nome}: ${texto}`;
    }
    case 'campanha':
      return `fez campanha: ${String(e.rotulo ?? '')}`;
    case 'discurso':
      return `fez o discurso ${String(e.opcao)} no evento e ${e.venceu ? 'venceu' : 'não venceu'}`;
    default:
      return null;
  }
}

export async function loteDiario(ctx: ContextoWorker, pedido: PedidoLoteDiario): Promise<void> {
  const cena = await carregarCena(ctx, pedido.mundoId);
  if (!cena || cena.mundo.estado !== 'pronto' || !cena.mundo.ativo) return;
  // O resumo do dia é a marca de que o lote do dia já rodou.
  const jaRodou = await temResumo(ctx.db, cena);
  if (pedido.agendado && jaRodou) return;

  const desde = new Date(cena.agora.getTime() - 24 * HORA);
  const personagens = await personagensDoMundo(ctx.db, cena.mundo.id);
  const nomes = new Map(personagens.map((p) => [p.id, p.nome]));
  const acoes = await ctx.db
    .select()
    .from(tabelaAcao)
    .where(
      and(
        eq(tabelaAcao.mundoId, cena.mundo.id),
        gte(tabelaAcao.criadoEm, desde),
        isNull(tabelaAcao.desfeitaEm),
        ne(tabelaAcao.tipo, 'desfazer'),
      ),
    )
    .orderBy(tabelaAcao.criadoEm);
  const ontem = acoes
    .map((a) => descreverAcao(a, nomes))
    .filter((t): t is string => !!t)
    .slice(-15);

  // Variação do dia pelos deltas das ações (o que o desfazer anulou já foi descontado).
  const variacao: Variacao = {};
  if (acoes.length > 0) {
    const deltas = await ctx.db
      .select()
      .from(tabelaDelta)
      .where(
        inArray(
          tabelaDelta.acaoId,
          acoes.map((a) => a.id),
        ),
      );
    for (const d of deltas) {
      if (
        d.alvo === 'seguidores' ||
        d.alvo === 'fama' ||
        d.alvo === 'carisma' ||
        d.alvo === 'polemica'
      ) {
        variacao[d.alvo] = (variacao[d.alvo] ?? 0) + d.valor;
      }
    }
  }

  // Polêmica cai um dia se o jogador não provocou ninguém nas últimas 24 h. Aqui só entra nos
  // números do prompt; a gravação fica na transação do feed, uma vez por dia (marca: resumo_dia),
  // para uma repetição do job não decair de novo.
  let jogador = await jogadorAtual(ctx.db, cena);
  const provocou = acoes.some(
    (a) => a.tipo === 'post' && (a.entrada as { tom?: string }).tom === 'provocativo',
  );
  const decai = !provocou && !jaRodou;
  if (decai) {
    const polemica = decairPolemica(jogador.polemica, 1);
    if (polemica !== jogador.polemica) {
      variacao.polemica = (variacao.polemica ?? 0) + (polemica - jogador.polemica);
      jogador = { ...jogador, polemica };
    }
  }
  const numeros = numerosDoResumo(jogador, variacao);

  const relacoes = await relacoesDoJogador(ctx.db, jogador.id);
  const recentes = await ctx.db
    .select({ id: post.id, autorId: post.autorId, texto: post.texto })
    .from(post)
    .where(
      and(
        eq(post.mundoId, cena.mundo.id),
        eq(post.tipo, 'post'),
        eq(post.oculto, false),
        isNull(post.respondeA),
        gte(post.entregarEm, desde),
        lte(post.entregarEm, cena.agora),
      ),
    )
    .orderBy(desc(post.entregarEm))
    .limit(8);
  const evento = await proximoEvento(ctx, cena);
  const memoriasParaResumir = await memoriasLongas(ctx, jogador, personagens);
  const podePuxar = await podePuxarConversa(ctx, cena, desde);

  const { dados } = await gerar(ctx, {
    job: 'lote_diario',
    mundo: cena.mundo,
    entrada: {
      momento: { dia: cena.dia, periodo: cena.periodo },
      resumoEstado: cena.mundo.resumoEstado,
      jogador: jogadorPrompt(jogador),
      personagens: personagens.map((p) => ({
        ...personagemPrompt(p),
        relacao: relacoes.has(p.id) ? { ...relacoes.get(p.id)!, tipoVinculo: p.tipoVinculo } : null,
      })),
      ontem,
      numerosDia: numeros.map((n) => ({
        rotulo: n.rotulo,
        valor:
          n.variacao === null || n.variacao === 0
            ? n.valor
            : `${n.valor} (${n.variacao > 0 ? '+' : ''}${n.variacao} desde ontem)`,
      })),
      objetivoAto: cena.mundo.objetivoAto,
      evento: evento
        ? {
            titulo: evento.titulo,
            categoria: evento.categoria,
            quando: `dia ${evento.diaMundo}, à noite`,
          }
        : null,
      postsRecentes: recentes,
      memoriasParaResumir,
      podePuxarConversa: podePuxar,
      quantidadePosts: POSTS_DO_DIA,
    },
    idsValidos: {
      personagens: personagens.map((p) => p.id),
      sobre: [jogador.id, ...personagens.map((p) => p.id)],
      posts: recentes.map((p) => p.id),
    },
  });

  const autores = new Map(personagens.map((p) => [p.id, p]));
  const rng = criarRng(`lote:${cena.mundo.id}:${cena.dia}:${cena.agora.getTime()}`);
  const entregas = await ctx.db.transaction(async (tx) => {
    // Trava o mundo: dois lotes do mesmo dia (agendado e o da rota de dev) entram em fila aqui.
    await tx
      .select({ id: tabelaMundo.id })
      .from(tabelaMundo)
      .where(eq(tabelaMundo.id, cena.mundo.id))
      .for('update');
    if (decai && !(await temResumo(tx, cena))) {
      const [atual] = await tx
        .select({ polemica: personagem.polemica })
        .from(personagem)
        .where(eq(personagem.id, jogador.id))
        .for('update');
      const polemica = decairPolemica(atual!.polemica, 1);
      if (polemica !== atual!.polemica) {
        await tx.update(personagem).set({ polemica }).where(eq(personagem.id, jogador.id));
      }
    }
    const futuras = await gravarFeed(tx, cena, dados, {
      instantes: (n) => {
        const agora = Math.min(n, POSTS_IMEDIATOS);
        return [
          ...espalharEntregas(new Date(cena.agora.getTime() - HORA), HORA, agora, rng),
          ...espalharEntregas(
            new Date(cena.agora.getTime() + 20 * 60_000),
            10 * HORA,
            n - agora,
            rng,
          ),
        ];
      },
      autores,
      rng,
      origem: 'lote',
      podePuxarConversa: podePuxar,
      memoriasPedidas: new Set(
        memoriasParaResumir.map((m) => parDeMemoria(m.personagem.id, m.sobre.id)),
      ),
    });
    if (dados.resumo) {
      await gravarResumo(tx, cena, dados.resumo, numeros, autores);
      await tx.insert(alerta).values({
        mundoId: cena.mundo.id,
        tipo: 'resumo',
        texto: `Resumo do dia ${cena.dia}`,
        destino: '/resumo-do-dia',
        entregarEm: cena.agora,
      });
      const estado = [
        `dia ${cena.dia}. ${dados.resumo.manchete}`,
        ...dados.resumo.pendencias.map((p) => p.texto),
      ]
        .join(' ')
        .slice(0, 800);
      await tx
        .update(tabelaMundo)
        .set({ resumoEstado: estado })
        .where(eq(tabelaMundo.id, cena.mundo.id));
    }
    return futuras;
  });
  await agendarEntregas(ctx, cena, entregas);
  ctx.log.info({ mundoId: cena.mundo.id, dia: cena.dia, posts: dados.posts.length }, 'lote do dia');
}

async function temResumo(db: Executor, cena: Cena): Promise<boolean> {
  const [ja] = await db
    .select({ dia: resumoDia.dia })
    .from(resumoDia)
    .where(and(eq(resumoDia.mundoId, cena.mundo.id), eq(resumoDia.dia, cena.dia)));
  return !!ja;
}

async function proximoEvento(ctx: ContextoWorker, cena: Cena) {
  const [e] = await ctx.db
    .select()
    .from(eventoAgendado)
    .where(
      and(
        eq(eventoAgendado.mundoId, cena.mundo.id),
        ne(eventoAgendado.estado, 'encerrado'),
        gte(eventoAgendado.diaMundo, cena.dia),
      ),
    )
    .orderBy(eventoAgendado.diaMundo)
    .limit(1);
  return e ?? null;
}

/** Memórias sobre o jogador que cresceram demais e vão ser resumidas pela IA. */
async function memoriasLongas(
  ctx: ContextoWorker,
  jogador: LinhaPersonagem,
  personagens: readonly LinhaPersonagem[],
): Promise<ItemMemoria[]> {
  const porId = new Map(personagens.map((p) => [p.id, p]));
  const linhas = await ctx.db.select().from(memoria).where(eq(memoria.sobreId, jogador.id));
  return linhas
    .map((m) => ({ m, fatos: m.fatos.split('\n').filter(Boolean) }))
    .filter(({ m, fatos }) => fatos.length >= FATOS_PARA_RESUMIR && porId.has(m.personagemId))
    .map(({ m, fatos }) => ({
      personagem: pessoaCurta(porId.get(m.personagemId)!),
      sobre: pessoaCurta(jogador),
      fatosAtuais: fatos.slice(0, -4).join('\n'),
      eventosNovos: fatos.slice(-4),
    }));
}

/** Alguém puxa conversa no Plus, ou depois de um marco liberado ou de um evento encerrado. */
async function podePuxarConversa(ctx: ContextoWorker, cena: Cena, desde: Date): Promise<boolean> {
  if (cena.usuario.plano === 'plus') return true;
  const [liberado] = await ctx.db
    .select({ id: marco.id })
    .from(marco)
    .where(
      and(
        eq(marco.mundoId, cena.mundo.id),
        isNotNull(marco.liberadoEm),
        gte(marco.liberadoEm, desde),
      ),
    )
    .limit(1);
  if (liberado) return true;
  const [encerrado] = await ctx.db
    .select({ id: eventoAgendado.id })
    .from(eventoAgendado)
    .where(
      and(
        eq(eventoAgendado.mundoId, cena.mundo.id),
        eq(eventoAgendado.estado, 'encerrado'),
        gte(eventoAgendado.diaMundo, cena.dia - 1),
      ),
    )
    .limit(1);
  return !!encerrado;
}

/** Sem ação do jogador há mais que isso, o mundo não ganha lote (e não gasta IA). */
export const ABANDONO_MS = 3 * 24 * HORA;
/** Mundo recém-criado já tem o feed inicial; o primeiro lote espera um pouco. */
export const MUNDO_NOVO_MS = 6 * HORA;

/**
 * Agendamento das 04h30 (UTC): um lote por mundo pronto, sem repetir o dia. Pula mundos
 * abandonados (sem ação há mais de 3 dias) e os criados há menos de 6 h. Devolve quantos agendou.
 */
export async function agendarLotes(ctx: ContextoWorker): Promise<number> {
  const mundos = await ctx.db
    .select({
      id: tabelaMundo.id,
      criadoEm: tabelaMundo.criadoEm,
      deslocamentoMin: tabelaMundo.deslocamentoMin,
    })
    .from(tabelaMundo)
    .where(and(eq(tabelaMundo.estado, 'pronto'), eq(tabelaMundo.ativo, true)));
  if (mundos.length === 0) return 0;
  const ultimas = await ctx.db
    .select({
      mundoId: tabelaAcao.mundoId,
      ultima: sql<Date>`max(${tabelaAcao.criadoEm})`.mapWith(tabelaAcao.criadoEm),
    })
    .from(tabelaAcao)
    .where(
      inArray(
        tabelaAcao.mundoId,
        mundos.map((m) => m.id),
      ),
    )
    .groupBy(tabelaAcao.mundoId);
  const ultimaPorMundo = new Map(ultimas.map((u) => [u.mundoId, u.ultima]));

  let agendados = 0;
  for (const m of mundos) {
    const agora = aplicarDeslocamento(ctx.agoraReal(), m.deslocamentoMin);
    if (agora.getTime() - m.criadoEm.getTime() < MUNDO_NOVO_MS) continue;
    const ultima = ultimaPorMundo.get(m.id);
    const atividade = Math.max(m.criadoEm.getTime(), ultima ? ultima.getTime() : 0);
    if (agora.getTime() - atividade > ABANDONO_MS) continue;
    // O dia exato sai do fuso do usuário dentro do job; aqui só serve para o id não repetir.
    const dia = diaDoMundo(m.criadoEm, agora, 'UTC');
    await ctx.filas.lote.add(
      'lote_diario',
      { mundoId: m.id, dia, agendado: true } satisfies PedidoLoteDiario,
      { jobId: `lote_diario-${m.id}-${dia}` },
    );
    agendados++;
  }
  return agendados;
}
