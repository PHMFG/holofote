// Testes dos jobs do worker contra o Postgres do Docker (banco holofote_teste_worker), com o
// provedor falso (dublê de teste) ou roteirizado no lugar da IA e filas e Redis de mentira.
import {
  acao,
  alerta,
  and,
  chamadaLlm,
  conversa,
  criarDb,
  criarFixturePopBrasil,
  delta,
  eq,
  eventoAgendado,
  marco,
  memoria,
  mensagem,
  migrar,
  mundo,
  personagem,
  post,
  relacao,
  resumoDia,
  usuario,
  type ConexaoDb,
  type FixturePopBrasil,
} from '@holofote/db';
import { criarRng, numerosDoJogador } from '@holofote/engine';
import {
  criarProvedorFalso,
  criarProvedorRoteirizado,
  ErroJsonInvalido,
  ErroLimite,
  ErroProvedor,
  lerConfigLlm,
  type PedidoGeracao,
  type Provedor,
} from '@holofote/llm';
import { EventoTempoReal, FILAS } from '@holofote/shared';
import { DelayedError, UnrecoverableError } from 'bullmq';
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ContextoWorker } from './contexto';
import type { PedidoEntrega } from './infra/entrega';
import { criarMundo } from './jobs/criar-mundo';
import { diretor } from './jobs/diretor';
import { discurso } from './jobs/discurso';
import { dm } from './jobs/dm';
import { processarEntrega } from './jobs/entrega';
import { ficha } from './jobs/ficha';
import { agendarLotes, loteDiario } from './jobs/lote-diario';
import { MENSAGEM_LIMITE_MUNDO, processadores, type JobDaFila } from './processadores';

const URL_BANCO =
  process.env.DATABASE_URL_TESTE_WORKER ??
  'postgres://holofote:holofote@localhost:5432/holofote_teste_worker';
const AGORA = new Date('2026-10-16T15:00:00Z');

let conexao: ConexaoDb;

interface Adicionado {
  fila: string;
  nome: string;
  dados: unknown;
  opcoes?: Record<string, unknown>;
}

function montarCtx(provedor: Provedor = criarProvedorFalso(), agora: Date = AGORA) {
  const eventos: EventoTempoReal[] = [];
  const adicionados: Adicionado[] = [];
  const fila = (nomeFila: string) => ({
    add: async (nome: string, dados: unknown, opcoes?: Record<string, unknown>) => {
      adicionados.push({ fila: nomeFila, nome, dados, opcoes });
    },
  });
  const redis = {
    publish: async (_canal: string, mensagem: string) => {
      eventos.push(EventoTempoReal.parse(JSON.parse(mensagem)));
      return 1;
    },
  } as unknown as Redis;
  const ctx: ContextoWorker = {
    db: conexao.db,
    redis,
    filas: { entrega: fila(FILAS.entrega), lote: fila(FILAS.lote) },
    provedor,
    llm: lerConfigLlm({ LLM_PROVIDER: 'falso', LLM_DAILY_BUDGET_USD: '2' }),
    agoraReal: () => agora,
    log: { info: () => {}, warn: () => {}, error: () => {} },
  };
  return { ctx, eventos, adicionados };
}

beforeAll(async () => {
  if (!URL_BANCO.endsWith('_worker'))
    throw new Error('banco de teste do worker deve terminar em _worker');
  conexao = criarDb(URL_BANCO, { onnotice: () => {} });
  await conexao.sql.unsafe(
    'drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public',
  );
  await migrar(URL_BANCO);
});

afterAll(async () => {
  await conexao.fechar();
});

/** Mundo recém-pedido pela API: usuário, mundo em "criando" e o jogador. */
async function mundoNovo() {
  const [u] = await conexao.db
    .insert(usuario)
    .values({ aparelhoId: crypto.randomUUID(), criadoEm: AGORA })
    .returning();
  const [m] = await conexao.db
    .insert(mundo)
    .values({
      usuarioId: u!.id,
      universo: 'Cozinha de reality show',
      tomCaos: 60,
      estado: 'criando',
      criadoEm: AGORA,
    })
    .returning();
  const [j] = await conexao.db
    .insert(personagem)
    .values({
      mundoId: m!.id,
      papel: 'jogador',
      nome: 'Rita Sal',
      handle: 'ritasal',
      iniciais: 'RS',
      ficha: 'chef de bairro que quer provar que comida simples vence',
      ...numerosDoJogador(criarRng(`jogador:${m!.id}`)),
    })
    .returning();
  return { usuarioId: u!.id, mundoId: m!.id, jogadorId: j!.id };
}

/** Post novo do jogador como a API grava: ação pendente de IA e o post ligado a ela. */
async function postDoJogador(f: FixturePopBrasil, texto = 'ensaio aberto hoje, quem vem?') {
  const [a] = await conexao.db
    .insert(acao)
    .values({
      mundoId: f.mundoId,
      tipo: 'post',
      entrada: { texto, tom: 'fofo', marcados: [f.personagens.bento] },
      consequencia: { seguidoresGanhos: 40, curtidasSimuladas: 90, marcoLiberadoId: null },
      iaPendente: 1,
      criadoEm: AGORA,
    })
    .returning();
  const [p] = await conexao.db
    .insert(post)
    .values({
      mundoId: f.mundoId,
      autorId: f.jogadorId,
      texto,
      tom: 'fofo',
      origem: 'jogador',
      acaoId: a!.id,
      marcados: [f.personagens.bento],
      entregarEm: AGORA,
    })
    .returning();
  return { acaoId: a!.id, postId: p!.id };
}

describe('criar_mundo', () => {
  it('a IA escreve o mundo e o motor dá os números; o mundo fica pronto com feed', async () => {
    const { ctx, eventos } = montarCtx();
    const novo = await mundoNovo();
    await criarMundo(ctx, { mundoId: novo.mundoId });

    const [m] = await conexao.db.select().from(mundo).where(eq(mundo.id, novo.mundoId));
    expect(m!.estado).toBe('pronto');
    expect(m!.biblia).toBeTruthy();
    expect(m!.objetivoAto).toBeTruthy();

    const pessoas = await conexao.db
      .select()
      .from(personagem)
      .where(eq(personagem.mundoId, novo.mundoId));
    expect(pessoas.filter((p) => p.papel === 'elenco')).toHaveLength(5);
    expect(pessoas.filter((p) => p.papel === 'figurante')).toHaveLength(4);
    for (const p of pessoas) {
      expect(p.fama).toBeGreaterThanOrEqual(0);
      expect(p.handle).toMatch(/^[a-z0-9_.]{2,24}$/);
    }
    const relacoes = await conexao.db
      .select()
      .from(relacao)
      .where(eq(relacao.deId, novo.jogadorId));
    expect(relacoes).toHaveLength(9);

    const marcos = await conexao.db
      .select()
      .from(marco)
      .where(eq(marco.mundoId, novo.mundoId))
      .orderBy(marco.ordem);
    expect(marcos.map((x) => x.ordem)).toEqual([1, 2, 3, 4, 5]);
    expect(marcos[0]!.requisitos.some((r) => r.chave === 'seguidores')).toBe(true);
    expect(marcos[0]!.recompensa.gemas).toBeGreaterThan(0);

    const [evento] = await conexao.db
      .select()
      .from(eventoAgendado)
      .where(eq(eventoAgendado.mundoId, novo.mundoId));
    expect(evento!.indicados).toHaveLength(3);
    expect(evento!.indicados[0]!.personagemId).toBe(novo.jogadorId);

    const feed = await conexao.db.select().from(post).where(eq(post.mundoId, novo.mundoId));
    expect(feed.filter((p) => p.tipo === 'post').length).toBeGreaterThanOrEqual(5);
    expect(feed.every((p) => p.entregarEm <= AGORA)).toBe(true);
    const [resumo] = await conexao.db
      .select()
      .from(resumoDia)
      .where(eq(resumoDia.mundoId, novo.mundoId));
    expect(resumo!.manchete).toBeTruthy();

    const chamadas = await conexao.db
      .select()
      .from(chamadaLlm)
      .where(eq(chamadaLlm.mundoId, novo.mundoId));
    expect(chamadas.map((c) => c.job).sort()).toEqual(['criar_mundo', 'feed_inicial']);
    expect(eventos.find((e) => e.tipo === 'mundo')).toMatchObject({ mundo: { estado: 'pronto' } });

    // Repetir não gera nada de novo.
    await criarMundo(ctx, { mundoId: novo.mundoId });
    const depois = await conexao.db
      .select()
      .from(chamadaLlm)
      .where(eq(chamadaLlm.mundoId, novo.mundoId));
    expect(depois).toHaveLength(2);
  });

  it('universo recusado pela IA deixa o mundo em erro com o motivo', async () => {
    const provedor = criarProvedorRoteirizado([
      { moderacao: { ok: false, motivo: 'O Holofote só tem pessoas inventadas.' } },
    ]);
    const { ctx, eventos } = montarCtx(provedor);
    const novo = await mundoNovo();
    await criarMundo(ctx, { mundoId: novo.mundoId });
    const [m] = await conexao.db.select().from(mundo).where(eq(mundo.id, novo.mundoId));
    expect(m!.estado).toBe('erro');
    expect(m!.erro).toContain('inventadas');
    expect(eventos.find((e) => e.tipo === 'mundo')).toMatchObject({ mundo: { estado: 'erro' } });
  });

  it('se a IA falha de vez, o mundo fica em erro (sem texto pronto)', async () => {
    const provedor = criarProvedorRoteirizado([
      new ErroProvedor('m', 500, 'fora'),
      new ErroProvedor('r', 500, 'fora'),
    ]);
    const { ctx } = montarCtx(provedor);
    const novo = await mundoNovo();
    const job = jobFalso('criar_mundo', { mundoId: novo.mundoId }, { tentativas: 8, feitas: 7 });
    await expect(processadores(ctx)[FILAS.lote](job)).rejects.toBeInstanceOf(ErroProvedor);
    const [m] = await conexao.db.select().from(mundo).where(eq(mundo.id, novo.mundoId));
    expect(m!.estado).toBe('erro');
    const pessoas = await conexao.db
      .select()
      .from(personagem)
      .where(eq(personagem.mundoId, novo.mundoId));
    expect(pessoas).toHaveLength(1);
  });
});

describe('diretor', () => {
  let f: FixturePopBrasil;
  beforeEach(async () => {
    f = await criarFixturePopBrasil(conexao.db, { agora: AGORA });
  });

  it('agenda reações no futuro, grava o cartão e avisa pelo tempo real', async () => {
    const { ctx, eventos, adicionados } = montarCtx();
    const { acaoId, postId } = await postDoJogador(f);
    await diretor(ctx, { acaoId });

    const [a] = await conexao.db.select().from(acao).where(eq(acao.id, acaoId));
    expect(a!.iaPendente).toBe(0);
    expect(a!.cartao?.titulo).toBeTruthy();

    const reacoes = await conexao.db
      .select()
      .from(post)
      .where(and(eq(post.acaoId, acaoId), eq(post.origem, 'diretor')));
    expect(reacoes.length).toBeGreaterThan(0);
    expect(reacoes.every((r) => r.entregarEm > AGORA)).toBe(true);
    expect(reacoes.filter((r) => r.respondeA === postId).length).toBeGreaterThan(0);

    expect(eventos.map((e) => e.tipo)).toEqual(expect.arrayContaining(['digitando', 'cartao']));
    const entregas = adicionados.filter((x) => x.fila === FILAS.entrega);
    expect(entregas.length).toBeGreaterThanOrEqual(reacoes.length);
    expect(entregas.every((x) => Number(x.opcoes?.delay) > 0)).toBe(true);

    const [chamada] = await conexao.db
      .select()
      .from(chamadaLlm)
      .where(eq(chamadaLlm.acaoId, acaoId));
    expect(chamada!.ok).toBe(true);

    // Repetir (job duplicado) não gera reações em dobro.
    await diretor(ctx, { acaoId });
    const denovo = await conexao.db
      .select()
      .from(post)
      .where(and(eq(post.acaoId, acaoId), eq(post.origem, 'diretor')));
    expect(denovo).toHaveLength(reacoes.length);
  });

  it('não chama a IA para uma ação desfeita', async () => {
    const provedor = criarProvedorRoteirizado([]);
    const { ctx } = montarCtx(provedor);
    const { acaoId } = await postDoJogador(f);
    await conexao.db.update(acao).set({ desfeitaEm: AGORA }).where(eq(acao.id, acaoId));
    await diretor(ctx, { acaoId });
    expect(provedor.pedidos).toHaveLength(0);
  });

  it('com o teto diário estourado, o job espera a virada do dia sem gastar tentativa', async () => {
    const { ctx } = montarCtx();
    const { acaoId } = await postDoJogador(f);
    await conexao.db.insert(chamadaLlm).values({
      job: 'diretor',
      modelo: 'x',
      custoUsd: 5,
      latenciaMs: 1,
      ok: true,
      criadoEm: AGORA,
    });
    try {
      const job = jobFalso('diretor', { acaoId });
      await expect(processadores(ctx)[FILAS.diretor](job, 'token')).rejects.toBeInstanceOf(
        DelayedError,
      );
      // Decisão do dono: com o teto estourado, as reações esperam a virada do dia (UTC).
      expect(job.adiadoPara).toBe(Date.UTC(2026, 9, 17));
      expect(job.data).toMatchObject({ adiamentos: 1 });
      const [a] = await conexao.db.select().from(acao).where(eq(acao.id, acaoId));
      expect(a!.iaPendente).toBe(1);
    } finally {
      await conexao.db.delete(chamadaLlm).where(eq(chamadaLlm.modelo, 'x'));
    }
  });

  it('na última tentativa sem resposta, a ação para de esperar e fica sem texto', async () => {
    const provedor = criarProvedorRoteirizado([
      new ErroProvedor('m', 503, 'fora'),
      new ErroProvedor('r', 503, 'fora'),
    ]);
    const { ctx } = montarCtx(provedor);
    const { acaoId } = await postDoJogador(f);
    const job = jobFalso('diretor', { acaoId }, { tentativas: 8, feitas: 7 });
    await expect(processadores(ctx)[FILAS.diretor](job)).rejects.toBeInstanceOf(ErroProvedor);
    const [a] = await conexao.db.select().from(acao).where(eq(acao.id, acaoId));
    expect(a!.iaPendente).toBe(0);
    expect(a!.cartao).toBeNull();
  });
});

describe('dm, discurso, lote diário e ficha', () => {
  let f: FixturePopBrasil;
  beforeEach(async () => {
    f = await criarFixturePopBrasil(conexao.db, { agora: AGORA });
  });

  it('dm: o personagem responde com digitando, mensagens no futuro e resumo novo', async () => {
    const { ctx, eventos, adicionados } = montarCtx();
    const [a] = await conexao.db
      .insert(acao)
      .values({
        mundoId: f.mundoId,
        tipo: 'dm',
        entrada: {
          texto: 'e o feat, vai sair?',
          conversaId: f.conversas.vic,
          personagemId: f.personagens.vic,
        },
        iaPendente: 1,
        criadoEm: AGORA,
      })
      .returning();
    await conexao.db.insert(mensagem).values({
      conversaId: f.conversas.vic,
      autorId: f.jogadorId,
      texto: 'e o feat, vai sair?',
      entregarEm: AGORA,
      acaoId: a!.id,
    });
    await dm(ctx, { acaoId: a!.id });

    const respostas = await conexao.db
      .select()
      .from(mensagem)
      .where(and(eq(mensagem.acaoId, a!.id), eq(mensagem.autorId, f.personagens.vic)));
    expect(respostas.length).toBeGreaterThanOrEqual(1);
    expect(respostas.every((m) => m.entregarEm > AGORA)).toBe(true);
    const [c] = await conexao.db.select().from(conversa).where(eq(conversa.id, f.conversas.vic));
    expect(c!.resumo).toBeTruthy();
    expect(eventos[0]).toMatchObject({ tipo: 'digitando', conversaId: f.conversas.vic });
    expect(adicionados.filter((x) => x.fila === FILAS.entrega)).toHaveLength(respostas.length);
  });

  it('discurso: manchete vira o cartão e as reações entram no feed', async () => {
    const { ctx, eventos } = montarCtx();
    const [a] = await conexao.db
      .insert(acao)
      .values({
        mundoId: f.mundoId,
        tipo: 'discurso',
        entrada: {
          eventoId: f.eventoId,
          opcao: 'seguro',
          venceu: false,
          vencedorId: f.personagens.vic,
        },
        iaPendente: 1,
        criadoEm: AGORA,
      })
      .returning();
    await discurso(ctx, { acaoId: a!.id });
    const [gravada] = await conexao.db.select().from(acao).where(eq(acao.id, a!.id));
    const [e] = await conexao.db
      .select()
      .from(eventoAgendado)
      .where(eq(eventoAgendado.id, f.eventoId));
    expect(gravada!.cartao?.titulo).toBe(e!.titulo);
    const posts = await conexao.db.select().from(post).where(eq(post.acaoId, a!.id));
    expect(posts.every((p) => p.origem === 'discurso')).toBe(true);
    expect(eventos.some((x) => x.tipo === 'cartao')).toBe(true);
  });

  it('lote diário: feed do dia, histórias, resumo e alerta; o agendado não repete o dia', async () => {
    const { ctx, adicionados } = montarCtx();
    await loteDiario(ctx, { mundoId: f.mundoId, dia: 6 });
    const resumos = await conexao.db
      .select()
      .from(resumoDia)
      .where(eq(resumoDia.mundoId, f.mundoId));
    expect(resumos.map((r) => r.dia)).toContain(6);
    const doLote = await conexao.db
      .select()
      .from(post)
      .where(and(eq(post.mundoId, f.mundoId), eq(post.origem, 'lote'), eq(post.criadoEm, AGORA)));
    expect(doLote.some((p) => p.tipo === 'historia' && p.expiraEm! > AGORA)).toBe(true);
    expect(doLote.some((p) => p.entregarEm > AGORA)).toBe(true);
    expect(adicionados.some((x) => x.fila === FILAS.entrega)).toBe(true);
    const avisos = await conexao.db
      .select()
      .from(alerta)
      .where(and(eq(alerta.mundoId, f.mundoId), eq(alerta.tipo, 'resumo')));
    expect(avisos.length).toBeGreaterThan(0);

    const provedor = criarProvedorRoteirizado([]);
    const outro = montarCtx(provedor);
    await loteDiario(outro.ctx, { mundoId: f.mundoId, dia: 6, agendado: true });
    expect(provedor.pedidos).toHaveLength(0);
  });

  it('o agendamento das 04h30 cria um lote por mundo pronto', async () => {
    const { ctx, adicionados } = montarCtx();
    const total = await agendarLotes(ctx);
    expect(total).toBeGreaterThan(0);
    const lotes = adicionados.filter((x) => x.nome === 'lote_diario');
    expect(lotes).toHaveLength(total);
    expect(lotes.some((x) => (x.dados as { mundoId: string }).mundoId === f.mundoId)).toBe(true);
  });

  it('ficha: personagem novo com números do motor, relação e alerta', async () => {
    const { ctx } = montarCtx();
    await ficha(ctx, { mundoId: f.mundoId, marcoId: f.marcoIds[0]! });
    const pessoas = await conexao.db
      .select()
      .from(personagem)
      .where(eq(personagem.mundoId, f.mundoId));
    expect(pessoas).toHaveLength(9);
    const novo = pessoas.find(
      (p) => p.criadoEm.getTime() === AGORA.getTime() && p.papel === 'elenco',
    );
    expect(novo).toBeDefined();
    const [rel] = await conexao.db
      .select()
      .from(relacao)
      .where(and(eq(relacao.deId, f.jogadorId), eq(relacao.paraId, novo!.id)));
    expect(rel!.rotulo).toBeTruthy();
  });
});

describe('entrega', () => {
  it('publica o post na hora, conta a resposta e pula o que foi desfeito', async () => {
    const f = await criarFixturePopBrasil(conexao.db, { agora: AGORA });
    const { ctx, eventos } = montarCtx();
    const [antes] = await conexao.db.select().from(post).where(eq(post.id, f.posts.lua));
    const [resposta] = await conexao.db
      .insert(post)
      .values({
        mundoId: f.mundoId,
        autorId: f.personagens.duda,
        respondeA: f.posts.lua,
        texto: 'vem refrão',
        origem: 'diretor',
        entregarEm: AGORA,
      })
      .returning();
    const pedido: PedidoEntrega = { tipo: 'post', id: resposta!.id, mundoId: f.mundoId };
    await processarEntrega(ctx.db, ctx.redis, pedido);
    expect(eventos[0]).toMatchObject({ tipo: 'post', post: { id: resposta!.id } });
    const [depois] = await conexao.db.select().from(post).where(eq(post.id, f.posts.lua));
    expect(depois!.respostas).toBe(antes!.respostas + 1);

    await conexao.db.update(post).set({ oculto: true }).where(eq(post.id, resposta!.id));
    await processarEntrega(ctx.db, ctx.redis, pedido);
    expect(eventos).toHaveLength(1);
  });

  it('mensagem de personagem conta como não lida', async () => {
    const f = await criarFixturePopBrasil(conexao.db, { agora: AGORA });
    const { ctx, eventos } = montarCtx();
    const [c] = await conexao.db.select().from(conversa).where(eq(conversa.id, f.conversas.duda));
    const [msg] = await conexao.db
      .insert(mensagem)
      .values({
        conversaId: f.conversas.duda,
        autorId: f.personagens.duda,
        texto: 'oi',
        entregarEm: AGORA,
      })
      .returning();
    await processarEntrega(ctx.db, ctx.redis, {
      tipo: 'mensagem',
      id: msg!.id,
      mundoId: f.mundoId,
    });
    const [depois] = await conexao.db
      .select()
      .from(conversa)
      .where(eq(conversa.id, f.conversas.duda));
    expect(depois!.naoLidas).toBe(c!.naoLidas + 1);
    expect(eventos[0]).toMatchObject({ tipo: 'mensagem', mensagem: { minha: false } });
  });
});

/** Provedor falso com a saída mexida, e um gancho que roda antes de responder. */
function falsoAlterado(
  mudar: (dados: Record<string, unknown>) => Record<string, unknown> = (d) => d,
  antes?: (pedido: PedidoGeracao) => Promise<void>,
): Provedor {
  const falso = criarProvedorFalso();
  return {
    nome: 'alterado',
    async gerar(pedido) {
      await antes?.(pedido);
      const r = await falso.gerar(pedido);
      return { ...r, texto: JSON.stringify(mudar(JSON.parse(r.texto) as Record<string, unknown>)) };
    },
  };
}

describe('diretor: desfazer, alertas, moderação e repetição', () => {
  let f: FixturePopBrasil;
  beforeEach(async () => {
    f = await criarFixturePopBrasil(conexao.db, { agora: AGORA });
  });

  it('ação desfeita entre a chamada da IA e a gravação não grava nada', async () => {
    let acaoId = '';
    // O "desfazer" da API acontece enquanto a IA escreve.
    const provedor = falsoAlterado(undefined, async () => {
      await conexao.db
        .update(acao)
        .set({ desfeitaEm: AGORA, iaPendente: 0 })
        .where(eq(acao.id, acaoId));
    });
    const { ctx, eventos, adicionados } = montarCtx(provedor);
    ({ acaoId } = await postDoJogador(f));
    const memoriasAntes = await conexao.db.select().from(memoria);
    await diretor(ctx, { acaoId });

    expect(await conexao.db.select().from(post).where(eq(post.acaoId, acaoId))).toHaveLength(1);
    expect(await conexao.db.select().from(alerta).where(eq(alerta.acaoId, acaoId))).toHaveLength(0);
    expect(
      await conexao.db.select().from(mensagem).where(eq(mensagem.acaoId, acaoId)),
    ).toHaveLength(0);
    expect(await conexao.db.select().from(delta).where(eq(delta.acaoId, acaoId))).toHaveLength(0);
    expect(await conexao.db.select().from(memoria)).toEqual(memoriasAntes);
    const [a] = await conexao.db.select().from(acao).where(eq(acao.id, acaoId));
    expect(a!.cartao).toBeNull();
    expect(eventos.some((e) => e.tipo === 'cartao')).toBe(false);
    expect(adicionados.filter((x) => x.fila === FILAS.entrega)).toHaveLength(0);
  });

  it('os alertas das reações levam o acaoId, e o alerta de ação desfeita não sai', async () => {
    const { ctx, eventos } = montarCtx();
    const { acaoId } = await postDoJogador(f);
    await diretor(ctx, { acaoId });
    const reacoes = await conexao.db
      .select()
      .from(post)
      .where(and(eq(post.acaoId, acaoId), eq(post.origem, 'diretor')));
    const avisos = await conexao.db.select().from(alerta).where(eq(alerta.acaoId, acaoId));
    expect(avisos.length).toBe(reacoes.length);
    expect(avisos.length).toBeGreaterThan(0);

    await conexao.db.update(acao).set({ desfeitaEm: AGORA }).where(eq(acao.id, acaoId));
    const antes = eventos.length;
    await processarEntrega(ctx.db, ctx.redis, {
      tipo: 'alerta',
      id: avisos[0]!.id,
      mundoId: f.mundoId,
    });
    expect(eventos).toHaveLength(antes);
  });

  it('moderação recusada: o post some, sem reação, delta ou memória, e fica o cartão da IA', async () => {
    const cartao = { titulo: 'Post removido', texto: 'O mundo não engoliu essa.' };
    const provedor = falsoAlterado((d) => ({
      ...d,
      cartao,
      moderacao: { ok: false, motivo: 'ataque a pessoa real' },
    }));
    const { ctx, eventos, adicionados } = montarCtx(provedor);
    const { acaoId, postId } = await postDoJogador(f);
    const memoriasAntes = await conexao.db.select().from(memoria);
    await diretor(ctx, { acaoId });

    const [meu] = await conexao.db.select().from(post).where(eq(post.id, postId));
    expect(meu!.oculto).toBe(true);
    const [a] = await conexao.db.select().from(acao).where(eq(acao.id, acaoId));
    expect(a).toMatchObject({ cartao, iaPendente: 0 });
    expect(
      await conexao.db
        .select()
        .from(post)
        .where(and(eq(post.acaoId, acaoId), eq(post.origem, 'diretor'))),
    ).toHaveLength(0);
    expect(await conexao.db.select().from(delta).where(eq(delta.acaoId, acaoId))).toHaveLength(0);
    expect(await conexao.db.select().from(memoria)).toEqual(memoriasAntes);
    expect(adicionados.filter((x) => x.fila === FILAS.entrega)).toHaveLength(0);
    expect(eventos.find((e) => e.tipo === 'cartao')).toMatchObject({ cartao });
  });

  it('se agendar as entregas falha depois do commit, a repetição reagenda pelas linhas', async () => {
    const { ctx, eventos, adicionados } = montarCtx();
    let redisFora = true;
    ctx.filas.entrega = {
      add: async (nome, dados, opcoes) => {
        if (redisFora) throw new Error('redis fora');
        adicionados.push({ fila: FILAS.entrega, nome, dados, opcoes });
      },
    };
    const { acaoId } = await postDoJogador(f);
    await expect(diretor(ctx, { acaoId })).rejects.toThrow('redis fora');
    const [gravada] = await conexao.db.select().from(acao).where(eq(acao.id, acaoId));
    expect(gravada!.iaPendente).toBe(0);
    expect(eventos.some((e) => e.tipo === 'cartao')).toBe(false);
    const reacoes = await conexao.db
      .select()
      .from(post)
      .where(and(eq(post.acaoId, acaoId), eq(post.origem, 'diretor')));
    const avisos = await conexao.db.select().from(alerta).where(eq(alerta.acaoId, acaoId));

    redisFora = false;
    await diretor(ctx, { acaoId });
    const ids = adicionados.map((x) => (x.dados as PedidoEntrega).id).sort();
    expect(ids).toEqual(expect.arrayContaining([...reacoes, ...avisos].map((x) => x.id)));
    expect(eventos.find((e) => e.tipo === 'cartao')).toMatchObject({ eventoId: acaoId });
    // Nada foi gravado de novo.
    expect(
      await conexao.db
        .select()
        .from(post)
        .where(and(eq(post.acaoId, acaoId), eq(post.origem, 'diretor'))),
    ).toHaveLength(reacoes.length);
  });

  it('JSON inválido desiste na 3ª tentativa sem esperar as 8', async () => {
    const quebrado = () => criarProvedorRoteirizado(Array.from({ length: 12 }, () => '{}'));
    const { acaoId } = await postDoJogador(f);

    const primeira = montarCtx(quebrado());
    await expect(
      processadores(primeira.ctx)[FILAS.diretor](jobFalso('diretor', { acaoId }, { feitas: 0 })),
    ).rejects.toBeInstanceOf(ErroJsonInvalido);
    const [esperando] = await conexao.db.select().from(acao).where(eq(acao.id, acaoId));
    expect(esperando!.iaPendente).toBe(1);

    const terceira = montarCtx(quebrado());
    await expect(
      processadores(terceira.ctx)[FILAS.diretor](jobFalso('diretor', { acaoId }, { feitas: 2 })),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    const [desistiu] = await conexao.db.select().from(acao).where(eq(acao.id, acaoId));
    expect(desistiu!.iaPendente).toBe(0);
  });

  it('ação com mais de 6 h e teto estourado continua esperando a virada do dia', async () => {
    const seteHorasDepois = new Date(AGORA.getTime() + 7 * 3600_000);
    const { ctx } = montarCtx(criarProvedorFalso(), seteHorasDepois);
    const { acaoId } = await postDoJogador(f);
    await conexao.db.insert(chamadaLlm).values({
      job: 'diretor',
      modelo: 'x',
      custoUsd: 5,
      latenciaMs: 1,
      ok: true,
      criadoEm: seteHorasDepois,
    });
    try {
      const job = jobFalso('diretor', { acaoId });
      await expect(processadores(ctx)[FILAS.diretor](job, 'token')).rejects.toBeInstanceOf(
        DelayedError,
      );
      expect(job.adiadoPara).toBe(Date.UTC(2026, 9, 17));
      const [a] = await conexao.db.select().from(acao).where(eq(acao.id, acaoId));
      expect(a!.iaPendente).toBe(1);
    } finally {
      await conexao.db.delete(chamadaLlm).where(eq(chamadaLlm.modelo, 'x'));
    }
  });

  it('ação com mais de 6 h esperando o limite do provedor desiste', async () => {
    const seteHorasDepois = new Date(AGORA.getTime() + 7 * 3600_000);
    const provedor = criarProvedorRoteirizado([
      new ErroLimite('m', 429, 'limite'),
      new ErroLimite('r', 429, 'limite'),
    ]);
    const { ctx } = montarCtx(provedor, seteHorasDepois);
    const { acaoId } = await postDoJogador(f);
    const job = jobFalso('diretor', { acaoId });
    await expect(processadores(ctx)[FILAS.diretor](job)).resolves.toBeUndefined();
    expect(job.adiadoPara).toBeUndefined();
    const [a] = await conexao.db.select().from(acao).where(eq(acao.id, acaoId));
    expect(a!.iaPendente).toBe(0);
  });
});

describe('criar_mundo com o teto estourado', () => {
  it('o mundo fica em erro com a mensagem de limite, sem esperar a virada do dia', async () => {
    const { ctx, eventos } = montarCtx();
    const novo = await mundoNovo();
    await conexao.db.insert(chamadaLlm).values({
      job: 'criar_mundo',
      modelo: 'x',
      custoUsd: 5,
      latenciaMs: 1,
      ok: true,
      criadoEm: AGORA,
    });
    try {
      const job = jobFalso('criar_mundo', { mundoId: novo.mundoId });
      await expect(processadores(ctx)[FILAS.lote](job)).resolves.toBeUndefined();
      expect(job.adiadoPara).toBeUndefined();
      const [m] = await conexao.db.select().from(mundo).where(eq(mundo.id, novo.mundoId));
      expect(m).toMatchObject({ estado: 'erro', erro: MENSAGEM_LIMITE_MUNDO });
      expect(eventos.find((e) => e.tipo === 'mundo')).toMatchObject({ mundo: { estado: 'erro' } });
    } finally {
      await conexao.db.delete(chamadaLlm).where(eq(chamadaLlm.modelo, 'x'));
    }
  });
});

describe('lote diário: uma vez por dia e só o que o motor deixou', () => {
  let f: FixturePopBrasil;
  // A fixture já tem o resumo do dia 6; o lote destes testes é o do dia 7.
  const DIA_SEGUINTE = new Date(AGORA.getTime() + 24 * 3600_000);
  beforeEach(async () => {
    f = await criarFixturePopBrasil(conexao.db, { agora: AGORA });
    await conexao.db.update(personagem).set({ polemica: 50 }).where(eq(personagem.id, f.jogadorId));
  });
  const polemica = async () =>
    (await conexao.db.select().from(personagem).where(eq(personagem.id, f.jogadorId)))[0]!.polemica;

  it('a polêmica cai uma vez só, mesmo com falha da IA e repetição do job', async () => {
    const falha = montarCtx(
      criarProvedorRoteirizado([
        new ErroProvedor('m', 503, 'fora'),
        new ErroProvedor('r', 503, 'fora'),
      ]),
      DIA_SEGUINTE,
    );
    await expect(loteDiario(falha.ctx, { mundoId: f.mundoId, dia: 7 })).rejects.toBeInstanceOf(
      ErroProvedor,
    );
    expect(await polemica()).toBe(50);

    const { ctx } = montarCtx(criarProvedorFalso(), DIA_SEGUINTE);
    await loteDiario(ctx, { mundoId: f.mundoId, dia: 7 });
    const depois = await polemica();
    expect(depois).toBeLessThan(50);
    // A rota de dev força outro lote do mesmo dia: a polêmica não cai de novo.
    await loteDiario(ctx, { mundoId: f.mundoId, dia: 7 });
    expect(await polemica()).toBe(depois);
  });

  it('descarta a conversa puxada sem permissão do motor e a memória de par não pedido', async () => {
    const provedor = falsoAlterado((d) => ({
      ...d,
      puxaConversa: { personagemId: f.personagens.vic, texto: 'conversa que o motor não deixou' },
      memorias: [
        ...((d.memorias as unknown[]) ?? []),
        {
          personagemId: f.personagens.vic,
          sobreId: f.personagens.duda,
          fatos: 'memória inventada',
        },
      ],
    }));
    const { ctx } = montarCtx(provedor, DIA_SEGUINTE);
    await loteDiario(ctx, { mundoId: f.mundoId, dia: 7 });
    expect(
      await conexao.db
        .select()
        .from(mensagem)
        .where(eq(mensagem.texto, 'conversa que o motor não deixou')),
    ).toHaveLength(0);
    expect(
      await conexao.db.select().from(memoria).where(eq(memoria.fatos, 'memória inventada')),
    ).toHaveLength(0);
  });
});

describe('ficha e entrega repetidas', () => {
  let f: FixturePopBrasil;
  beforeEach(async () => {
    f = await criarFixturePopBrasil(conexao.db, { agora: AGORA });
  });

  it('ficha repetida não cria um segundo personagem para o mesmo marco', async () => {
    const { ctx } = montarCtx();
    await ficha(ctx, { mundoId: f.mundoId, marcoId: f.marcoIds[0]! });
    await ficha(ctx, { mundoId: f.mundoId, marcoId: f.marcoIds[0]! });
    const doMarco = await conexao.db
      .select()
      .from(personagem)
      .where(eq(personagem.marcoId, f.marcoIds[0]!));
    expect(doMarco).toHaveLength(1);
  });

  it('handle repetido na ficha vira erro para a fila tentar de novo', async () => {
    // Outra ficha do mesmo mundo grava o mesmo handle enquanto a IA escrevia esta.
    const falso = criarProvedorFalso();
    const provedor: Provedor = {
      nome: 'corrida',
      async gerar(pedido) {
        const r = await falso.gerar(pedido);
        const dados = JSON.parse(r.texto) as { nome: string; handle: string };
        await conexao.db.insert(personagem).values({
          mundoId: f.mundoId,
          papel: 'elenco',
          nome: `${dados.nome} Outra`,
          handle: dados.handle.replace('@', ''),
          iniciais: 'OO',
          ficha: 'gravada por outra ficha',
        });
        return r;
      },
    };
    const { ctx } = montarCtx(provedor);
    await expect(ficha(ctx, { mundoId: f.mundoId, marcoId: f.marcoIds[0]! })).rejects.toThrow(
      /handle repetido/,
    );
    expect(
      await conexao.db.select().from(personagem).where(eq(personagem.marcoId, f.marcoIds[0]!)),
    ).toHaveLength(0);
  });

  it('entrega repetida republica sem somar o contador de novo', async () => {
    const { ctx, eventos } = montarCtx();
    const [antes] = await conexao.db.select().from(post).where(eq(post.id, f.posts.lua));
    const [resposta] = await conexao.db
      .insert(post)
      .values({
        mundoId: f.mundoId,
        autorId: f.personagens.duda,
        respondeA: f.posts.lua,
        texto: 'chegou duas vezes',
        origem: 'diretor',
        entregarEm: AGORA,
      })
      .returning();
    const pedido: PedidoEntrega = { tipo: 'post', id: resposta!.id, mundoId: f.mundoId };
    await processarEntrega(ctx.db, ctx.redis, pedido);
    await processarEntrega(ctx.db, ctx.redis, pedido);
    const [depois] = await conexao.db.select().from(post).where(eq(post.id, f.posts.lua));
    expect(depois!.respostas).toBe(antes!.respostas + 1);
    expect(eventos.filter((e) => e.tipo === 'post')).toHaveLength(2);
  });

  it('o agendamento das 04h30 pula mundo abandonado', async () => {
    const abandonado = await criarFixturePopBrasil(conexao.db, {
      agora: new Date(AGORA.getTime() - 4 * 24 * 3600_000),
    });
    const { ctx, adicionados } = montarCtx();
    await agendarLotes(ctx);
    const mundos = adicionados.map((x) => (x.dados as { mundoId: string }).mundoId);
    expect(mundos).toContain(f.mundoId);
    expect(mundos).not.toContain(abandonado.mundoId);
  });
});

/** Job do BullMQ de mentira: guarda o adiamento e os dados atualizados. */
function jobFalso(
  name: string,
  data: Record<string, unknown>,
  { tentativas = 8, feitas = 0 } = {},
): JobDaFila & { adiadoPara?: number } {
  const job: JobDaFila & { adiadoPara?: number } = {
    id: `${name}-teste`,
    name,
    data,
    attemptsMade: feitas,
    opts: { attempts: tentativas },
    updateData: async (dados) => {
      job.data = dados;
    },
    moveToDelayed: async (instante) => {
      job.adiadoPara = instante;
    },
  };
  return job;
}
