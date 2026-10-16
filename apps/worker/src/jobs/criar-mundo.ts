// criar_mundo: a IA escreve a bíblia, o elenco (só personalidades), o objetivo e os marcos do ato
// e o evento; o motor dá os números (atributos, afinidades, requisitos, recompensas, chances).
// Depois, uma segunda chamada escreve o feed inicial. Só então o mundo fica pronto.
// Cada etapa confere o que já está gravado, então o job pode ser repetido depois de uma falha.
import {
  eq,
  eventoAgendado,
  iniciaisDe,
  marco,
  mundo as tabelaMundo,
  normalizarHandle,
  personagem,
  post,
  relacao,
  type LinhaPersonagem,
} from '@holofote/db';
import {
  ACOES_NOVAS,
  baseIndicado,
  criarRng,
  espalharEntregas,
  numerosDoPersonagem,
  recompensaDoMarco,
  requisitosDoMarco,
  rotuloRelacao,
} from '@holofote/engine';
import { mundoFoiRecusado, type MundoGerado } from '@holofote/llm';
import type { ContextoWorker } from '../contexto';
import {
  carregarCena,
  jogadorPrompt,
  personagemPrompt,
  personagensDoMundo,
  publicarMundo,
  type Cena,
} from '../infra/cena';
import { agendarEntregas, gravarFeed, gravarResumo, numerosDoResumo } from '../infra/feed';
import { gerar } from '../infra/ia';
import { vinculoDoRotulo } from '../infra/relacoes';

const HORA = 3600_000;
/** Posts do feed inicial (o plano pede 12). */
export const POSTS_FEED_INICIAL = 12;
/** O evento do ato acontece alguns dias depois da criação, à noite. */
export const DIAS_ATE_O_EVENTO = 3;

/** Figurantes que vivem de notícia e fofoca reagem mais e lembram do que foi desfeito. */
const TIPO_FOFOQUEIRO = /fofoc|portal|not[ií]cia|jornal|paparazz|f[oó]rum/i;

export interface PedidoCriarMundo {
  mundoId: string;
}

export async function criarMundo(ctx: ContextoWorker, pedido: PedidoCriarMundo): Promise<void> {
  let cena = await carregarCena(ctx, pedido.mundoId);
  if (!cena || cena.mundo.estado === 'pronto') return;

  if (!cena.mundo.biblia) {
    const { dados } = await gerar(ctx, {
      job: 'criar_mundo',
      mundo: cena.mundo,
      entrada: {
        universo: cena.mundo.universo,
        tomCaos: cena.mundo.tomCaos,
        persona: {
          nome: cena.jogador.nome,
          handle: `@${cena.jogador.handle}`,
          descricao: cena.jogador.ficha,
        },
      },
    });
    if (mundoFoiRecusado(dados)) {
      await ctx.db
        .update(tabelaMundo)
        .set({ estado: 'erro', erro: dados.moderacao.motivo })
        .where(eq(tabelaMundo.id, cena.mundo.id));
      await publicarMundo(ctx, cena.mundo.id);
      return;
    }
    await gravarMundo(ctx, cena, dados);
    cena = await carregarCena(ctx, pedido.mundoId);
    if (!cena) return;
  }

  await escreverFeedInicial(ctx, cena);
  await ctx.db
    .update(tabelaMundo)
    .set({ estado: 'pronto', erro: null })
    .where(eq(tabelaMundo.id, cena.mundo.id));
  await publicarMundo(ctx, cena.mundo.id);
  ctx.log.info({ mundoId: cena.mundo.id }, 'mundo pronto');
}

/** Bíblia, elenco, figurantes, relações, marcos e evento numa transação só. */
async function gravarMundo(ctx: ContextoWorker, cena: Cena, gerado: MundoGerado): Promise<void> {
  const rng = criarRng(`mundo:${cena.mundo.id}`);
  const { mundo: m, jogador } = cena;

  await ctx.db.transaction(async (tx) => {
    const criados: LinhaPersonagem[] = [];
    for (const p of gerado.elenco) {
      const n = numerosDoPersonagem({
        tipoVinculo: p.tipoVinculo,
        papel: 'elenco',
        tomCaos: m.tomCaos,
        rng,
      });
      const [linha] = await tx
        .insert(personagem)
        .values({
          mundoId: m.id,
          papel: 'elenco',
          nome: p.nome,
          handle: normalizarHandle(p.handle),
          iniciais: iniciaisDe(p.nome),
          tomAvatar: p.tomAvatar,
          verificado: p.verificado,
          ficha: p.ficha,
          tipoVinculo: p.tipoVinculo,
          perfilFofoca: p.tipoVinculo === 'fofoca',
          fama: n.fama,
          carisma: n.carisma,
          polemica: n.polemica,
          seguidores: n.seguidores,
        })
        .returning();
      await tx.insert(relacao).values({
        deId: jogador.id,
        paraId: linha!.id,
        afinidade: n.afinidade,
        rotulo: rotuloRelacao(n.afinidade, vinculoDoRotulo(p.tipoVinculo)),
      });
      criados.push(linha!);
    }

    for (const f of gerado.figurantes) {
      // Figurante não tem vínculo no banco; os números saem do perfil neutro ("interesse").
      const n = numerosDoPersonagem({
        tipoVinculo: 'interesse',
        papel: 'figurante',
        tomCaos: m.tomCaos,
        rng,
      });
      const [linha] = await tx
        .insert(personagem)
        .values({
          mundoId: m.id,
          papel: 'figurante',
          nome: f.nome,
          handle: normalizarHandle(f.handle),
          iniciais: iniciaisDe(f.nome),
          tomAvatar: rng() < 0.5 ? 'claro' : 'medio',
          ficha: `${f.tipo}. ${f.ficha}`,
          perfilFofoca: TIPO_FOFOQUEIRO.test(f.tipo),
          fama: n.fama,
          carisma: n.carisma,
          polemica: n.polemica,
          seguidores: n.seguidores,
        })
        .returning();
      await tx.insert(relacao).values({
        deId: jogador.id,
        paraId: linha!.id,
        afinidade: n.afinidade,
        rotulo: rotuloRelacao(n.afinidade, 'amizade'),
      });
    }

    const inicial = {
      seguidores: jogador.seguidores,
      fama: jogador.fama,
      carisma: jogador.carisma,
    };
    await tx.insert(marco).values(
      gerado.marcos.map((g, i) => {
        const ordem = i + 1;
        const recompensa = recompensaDoMarco(ordem);
        return {
          mundoId: m.id,
          ato: 1,
          ordem,
          titulo: g.titulo,
          descricao: g.descricao,
          requisitos: requisitosDoMarco(ordem, inicial, rng),
          recompensa: {
            gemas: recompensa.gemas,
            energiaCheia: recompensa.energiaCheia,
            personagemNovo: recompensa.personagemNovo,
            acaoNova: ACOES_NOVAS.find((a) => a.id === recompensa.acaoNova)?.rotulo ?? null,
          },
        };
      }),
    );

    await tx.insert(eventoAgendado).values({
      mundoId: m.id,
      tipo: gerado.evento.tipo,
      titulo: gerado.evento.titulo,
      categoria: gerado.evento.categoria,
      diaMundo: cena.dia + DIAS_ATE_O_EVENTO,
      periodo: 'noite',
      indicados: indicadosDoEvento(jogador, criados),
      estado: 'anunciado',
    });

    await tx
      .update(tabelaMundo)
      .set({ biblia: gerado.biblia, objetivoAto: gerado.objetivoAto })
      .where(eq(tabelaMundo.id, m.id));
  });
}

/** Jogador, o rival e o mais famoso do resto do elenco (sem o perfil de fofoca). */
function indicadosDoEvento(jogador: LinhaPersonagem, elenco: LinhaPersonagem[]) {
  const rival = elenco.find((p) => p.tipoVinculo === 'rival');
  const outros = elenco
    .filter((p) => p.id !== rival?.id && p.tipoVinculo !== 'fofoca')
    .sort((a, b) => b.fama - a.fama);
  const concorrentes = [rival, outros[0]].filter((p): p is LinhaPersonagem => !!p);
  return [
    { personagemId: jogador.id, base: baseIndicado(jogador, true) },
    ...concorrentes.map((p) => ({ personagemId: p.id, base: baseIndicado(p, false) })),
  ];
}

async function escreverFeedInicial(ctx: ContextoWorker, cena: Cena): Promise<void> {
  const [jaTem] = await ctx.db
    .select({ id: post.id })
    .from(post)
    .where(eq(post.mundoId, cena.mundo.id))
    .limit(1);
  if (jaTem) return;

  const personagens = await personagensDoMundo(ctx.db, cena.mundo.id);
  const [primeiro] = await ctx.db
    .select()
    .from(marco)
    .where(eq(marco.mundoId, cena.mundo.id))
    .orderBy(marco.ordem)
    .limit(1);
  const [evento] = await ctx.db
    .select()
    .from(eventoAgendado)
    .where(eq(eventoAgendado.mundoId, cena.mundo.id))
    .limit(1);

  const { dados } = await gerar(ctx, {
    job: 'feed_inicial',
    mundo: cena.mundo,
    entrada: {
      jogador: jogadorPrompt(cena.jogador),
      personagens: personagens.map(personagemPrompt),
      objetivoAto: cena.mundo.objetivoAto ?? '',
      marcoAtual: primeiro?.titulo ?? null,
      evento: evento
        ? {
            titulo: evento.titulo,
            categoria: evento.categoria,
            quando: `dia ${evento.diaMundo}, à noite`,
          }
        : null,
      momento: { dia: cena.dia, periodo: cena.periodo },
      quantidadePosts: POSTS_FEED_INICIAL,
    },
  });

  const autores = new Map(personagens.map((p) => [p.id, p]));
  const rng = criarRng(`feed_inicial:${cena.mundo.id}`);
  const entregas = await ctx.db.transaction(async (tx) => {
    const futuras = await gravarFeed(tx, cena, dados, {
      // O mundo "já existia": os posts se espalham pelas últimas horas.
      instantes: (n) =>
        espalharEntregas(new Date(cena.agora.getTime() - 5 * HORA), 5 * HORA - 5 * 60_000, n, rng),
      autores,
      rng,
      origem: 'lote',
      // No feed inicial ninguém puxa conversa e não há memória para resumir.
      podePuxarConversa: false,
      memoriasPedidas: new Set(),
    });
    if (dados.resumo) {
      await gravarResumo(tx, cena, dados.resumo, numerosDoResumo(cena.jogador), autores);
    }
    return futuras;
  });
  await agendarEntregas(ctx, cena, entregas);
}
