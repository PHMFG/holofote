// Testes da API contra o Postgres e o Redis do Docker (banco holofote_teste_api, Redis db 3).
import {
  acao as tabelaAcao,
  alerta,
  and,
  conversa,
  criarDb,
  criarFixturePopBrasil,
  eq,
  eventoAgendado,
  lancamentoEnergia,
  marco as tabelaMarco,
  mensagem,
  migrar,
  mundo as tabelaMundo,
  ne,
  post,
  type ConexaoDb,
} from '@holofote/db';
import { canalDoMundo, FILAS } from '@holofote/shared';
import { UnrecoverableError, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { construirApp } from './app';
import { lerConfig } from './config';
import { emitirToken } from './infra/auth';
import { Difusor } from './infra/difusor';
import { criarFilas, fecharFilas, type Filas } from './infra/filas';
import { REPETE_NOVO_ATO_MS, varrerPendentes } from './infra/varredor';

const URL_BANCO =
  process.env.DATABASE_URL_TESTE_API ??
  'postgres://holofote:holofote@localhost:5432/holofote_teste_api';
const URL_REDIS = `${process.env.REDIS_URL ?? 'redis://localhost:6379'}/3`;
const config = lerConfig({ AMBIENTE: 'teste', DATABASE_URL: URL_BANCO, REDIS_URL: URL_REDIS });
const AGORA = new Date('2026-10-16T15:00:00Z');

let conexao: ConexaoDb;
let redis: Redis;
let assinatura: Redis;
let filasRedis: Redis;
let filas: Filas;
let relogio = AGORA;
let app: ReturnType<typeof construirApp>;
let ctx: Parameters<typeof varrerPendentes>[0];

beforeAll(async () => {
  if (!URL_BANCO.endsWith('_api')) throw new Error('banco de teste da API deve terminar em _api');
  conexao = criarDb(URL_BANCO, { onnotice: () => {} });
  await conexao.sql.unsafe(
    'drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public',
  );
  await migrar(URL_BANCO);
  redis = new Redis(URL_REDIS, { maxRetriesPerRequest: null });
  await redis.flushdb();
  assinatura = new Redis(URL_REDIS, { maxRetriesPerRequest: null });
  filasRedis = new Redis(URL_REDIS, { maxRetriesPerRequest: null });
  filas = criarFilas(filasRedis);
  ctx = {
    config,
    db: conexao.db,
    redis,
    filas,
    difusor: new Difusor(assinatura),
    agoraReal: () => relogio,
  };
  app = construirApp({ postgres: async () => {}, redis: async () => {} }, { ctx });
  await app.listen({ port: 0, host: '127.0.0.1' });
});

afterAll(async () => {
  await app.close();
  await fecharFilas(filas);
  await Promise.allSettled([conexao.fechar(), redis.quit(), assinatura.quit(), filasRedis.quit()]);
});

async function mundoDeExemplo() {
  relogio = AGORA;
  const fixture = await criarFixturePopBrasil(conexao.db, { agora: AGORA });
  const token = await emitirToken(fixture.usuarioId, config.JWT_SEGREDO);
  return { ...fixture, token };
}

function pedir(
  token: string | null,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  payload?: unknown,
) {
  return app.inject({
    method,
    url,
    payload: payload as object | undefined,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const energiaDe = async (token: string) =>
  (await pedir(token, 'GET', '/v1/energia')).json().atual as number;

describe('autenticação e conta', () => {
  it('login anônimo cria a conta com energia cheia e 40 gemas, e o mesmo aparelho volta à mesma conta', async () => {
    const aparelhoId = crypto.randomUUID();
    const primeiro = await pedir(null, 'POST', '/v1/auth/anonimo', { aparelhoId });
    expect(primeiro.statusCode).toBe(200);
    const segundo = await pedir(null, 'POST', '/v1/auth/anonimo', { aparelhoId });
    expect(segundo.json().usuarioId).toBe(primeiro.json().usuarioId);

    const conta = (await pedir(primeiro.json().token, 'GET', '/v1/conta')).json();
    expect(conta).toMatchObject({
      plano: 'free',
      gemas: 40,
      energia: { atual: 12, max: 12 },
      mundoId: null,
    });
  });

  it('sem token responde 401 no formato do contrato', async () => {
    const r = await pedir(null, 'GET', '/v1/conta');
    expect(r.statusCode).toBe(401);
    expect(r.json()).toMatchObject({ erro: 'nao_autenticado' });
  });

  it('as rotas de atualização do app não pedem token', async () => {
    const manifesto = await app.inject({
      method: 'GET',
      url: '/v1/atualizacoes/manifesto',
      headers: { 'expo-platform': 'android' },
    });
    expect(manifesto.statusCode).toBe(400);
    const arquivo = await app.inject({
      method: 'GET',
      url: '/v1/atualizacoes/arquivo?caminho=../x',
    });
    expect(arquivo.statusCode).toBe(400);
  });

  it('Plus placebo dobra a energia máxima', async () => {
    const { token } = await pedir(null, 'POST', '/v1/auth/anonimo', {
      aparelhoId: crypto.randomUUID(),
    }).then((r) => r.json());
    const conta = (await pedir(token, 'POST', '/v1/conta/plus', { ativo: true })).json();
    expect(conta).toMatchObject({ plano: 'plus', energia: { max: 24 }, anunciosRestantesHoje: 0 });
  });
});

describe('mundo', () => {
  it('criar mundo grava o jogador, fica em "criando" e enfileira a IA', async () => {
    const { token } = await pedir(null, 'POST', '/v1/auth/anonimo', {
      aparelhoId: crypto.randomUUID(),
    }).then((r) => r.json());
    expect((await pedir(token, 'GET', '/v1/mundos/atual')).statusCode).toBe(404);
    const r = await pedir(token, 'POST', '/v1/mundos', {
      universo: 'Time de vôlei universitário',
      tomCaos: 40,
      persona: { nome: 'Lia Moura', handle: '@LiaMoura', descricao: 'levantadora reserva' },
      consentimentoIA: true,
    });
    expect(r.statusCode).toBe(201);
    const mundo = r.json();
    expect(mundo).toMatchObject({
      estado: 'criando',
      dia: 1,
      jogador: { handle: '@liamoura', iniciais: 'LM' },
    });
    const job = await filas.lote.getJob(`criar_mundo-${mundo.id}`);
    expect(job?.data).toEqual({ mundoId: mundo.id });
    // Ações esperam o mundo ficar pronto.
    const post = await pedir(token, 'POST', '/v1/posts', {
      texto: 'oi',
      tom: 'sincero',
      marcados: [],
    });
    expect(post.json()).toMatchObject({ erro: 'mundo_criando' });

    // Enquanto cria, um segundo pedido é recusado; depois de um erro da IA, o novo substitui.
    const pedido = {
      universo: 'Time de vôlei universitário',
      tomCaos: 40,
      persona: { nome: 'Lia Moura', handle: '@liamoura', descricao: 'levantadora reserva' },
      consentimentoIA: true,
    };
    expect((await pedir(token, 'POST', '/v1/mundos', pedido)).json()).toMatchObject({
      erro: 'mundo_existente',
    });
    await conexao.db
      .update(tabelaMundo)
      .set({ estado: 'erro' })
      .where(eq(tabelaMundo.id, mundo.id));
    const denovo = await pedir(token, 'POST', '/v1/mundos', pedido);
    expect(denovo.statusCode).toBe(201);
    expect(denovo.json().id).not.toBe(mundo.id);
  });

  it('recusa nome de pessoa real na persona', async () => {
    const { token } = await pedir(null, 'POST', '/v1/auth/anonimo', {
      aparelhoId: crypto.randomUUID(),
    }).then((r) => r.json());
    const r = await pedir(token, 'POST', '/v1/mundos', {
      universo: 'Pop Brasil',
      tomCaos: 50,
      persona: { nome: 'Anitta', handle: '@anitta', descricao: 'cantora' },
      consentimentoIA: true,
    });
    expect(r.statusCode).toBe(422);
  });

  it('feed mostra só posts entregues, sem respostas, com histórias ativas', async () => {
    const m = await mundoDeExemplo();
    const feed = (await pedir(m.token, 'GET', `/v1/mundos/${m.mundoId}/feed`)).json();
    expect(feed.itens.length).toBeGreaterThan(0);
    expect(feed.itens.every((p: { respondeA: string | null }) => p.respondeA === null)).toBe(true);
    expect(feed.historias.length).toBeGreaterThan(0);
  });

  it('feed com autor traz só os posts dele e nenhuma história', async () => {
    const m = await mundoDeExemplo();
    const r = await pedir(
      m.token,
      'GET',
      `/v1/mundos/${m.mundoId}/feed?autor=${m.personagens.vic}`,
    );
    expect(r.statusCode).toBe(200);
    const feed = r.json();
    expect(feed.itens.length).toBeGreaterThan(0);
    expect(
      feed.itens.every((p: { autor: { id: string } }) => p.autor.id === m.personagens.vic),
    ).toBe(true);
    expect(feed.historias).toEqual([]);
  });
});

describe('ações com energia', () => {
  it('publicar debita 1, aplica deltas do motor e enfileira o diretor', async () => {
    const m = await mundoDeExemplo();
    const antes = await energiaDe(m.token);
    const r = await pedir(m.token, 'POST', '/v1/posts', {
      texto: 'single novo sexta',
      tom: 'provocativo',
      marcados: [m.personagens.vic],
    });
    expect(r.statusCode).toBe(201);
    const { post: novo, consequencia } = r.json();
    expect(consequencia.energia.atual).toBe(antes - 1);
    expect(consequencia.reacoesPendentes).toBe(1);
    expect(
      consequencia.deltas.some((d: { alvo: string }) => d.alvo === `relacao:${m.personagens.vic}`),
    ).toBe(true);
    expect(consequencia.desfazivelAte).not.toBeNull();
    expect(novo).toMatchObject({ texto: 'single novo sexta', tom: 'provocativo' });
    expect(await filas.diretor.getJob(`diretor-${consequencia.eventoId}`)).toBeTruthy();
  });

  it('moderação barra com 422 e não debita', async () => {
    const m = await mundoDeExemplo();
    const antes = await energiaDe(m.token);
    const r = await pedir(m.token, 'POST', '/v1/posts', {
      texto: 'meu cpf é 123.456.789-09',
      tom: 'sincero',
      marcados: [],
    });
    expect(r.statusCode).toBe(422);
    expect(await energiaDe(m.token)).toBe(antes);
  });

  it('sem energia responde 409 e não grava nada', async () => {
    const m = await mundoDeExemplo();
    await conexao.db.insert(lancamentoEnergia).values({
      usuarioId: m.usuarioId,
      valor: -(await energiaDe(m.token)),
      motivo: 'acao',
      criadoEm: AGORA,
    });
    const posts = (await conexao.db.select().from(post).where(eq(post.mundoId, m.mundoId))).length;
    const r = await pedir(m.token, 'POST', '/v1/posts', {
      texto: 'mais um',
      tom: 'fofo',
      marcados: [],
    });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ erro: 'sem_energia' });
    expect((await conexao.db.select().from(post).where(eq(post.mundoId, m.mundoId))).length).toBe(
      posts,
    );

    const recarga = await pedir(m.token, 'POST', '/v1/energia/recarga', { via: 'debug' });
    expect(recarga.json().energia.atual).toBe(12);
  });

  it('gemas enchem a barra por 10', async () => {
    const m = await mundoDeExemplo();
    await pedir(m.token, 'POST', '/v1/posts', { texto: 'gasto um', tom: 'fofo', marcados: [] });
    const gemas = (await pedir(m.token, 'GET', '/v1/conta')).json().gemas as number;
    const r = (await pedir(m.token, 'POST', '/v1/energia/recarga', { via: 'gemas' })).json();
    expect(r).toMatchObject({ energia: { atual: 12 }, gemas: gemas - 10 });
    // Com a barra cheia, recarregar por gemas dá 409 e não cobra.
    const deNovo = await pedir(m.token, 'POST', '/v1/energia/recarga', { via: 'gemas' });
    expect(deNovo.statusCode).toBe(409);
    expect(deNovo.json()).toMatchObject({ erro: 'energia_cheia' });
    expect((await pedir(m.token, 'GET', '/v1/conta')).json().gemas).toBe(gemas - 10);
  });

  it('desfazer reverte os deltas, esconde o post e custa 2; depois de 60 min não dá mais', async () => {
    const m = await mundoDeExemplo();
    const jogadorAntes = (await pedir(m.token, 'GET', `/v1/personagens/${m.jogadorId}`)).json();
    const { post: novo, consequencia } = (
      await pedir(m.token, 'POST', '/v1/posts', {
        texto: 'vou apagar',
        tom: 'provocativo',
        marcados: [],
      })
    ).json();
    const desfeito = await pedir(m.token, 'POST', `/v1/acoes/${consequencia.eventoId}/desfazer`);
    expect(desfeito.statusCode).toBe(200);
    expect(desfeito.json().energia.atual).toBe(consequencia.energia.atual - 2);
    const jogadorDepois = (await pedir(m.token, 'GET', `/v1/personagens/${m.jogadorId}`)).json();
    expect(jogadorDepois).toMatchObject({
      polemica: jogadorAntes.polemica,
      seguidores: jogadorAntes.seguidores,
      fama: jogadorAntes.fama,
    });
    expect((await pedir(m.token, 'GET', `/v1/posts/${novo.id}`)).statusCode).toBe(404);
    expect(
      (await pedir(m.token, 'POST', `/v1/acoes/${consequencia.eventoId}/desfazer`)).json(),
    ).toMatchObject({
      erro: 'desfazer_expirado',
    });

    const outro = (
      await pedir(m.token, 'POST', '/v1/posts', { texto: 'fica', tom: 'fofo', marcados: [] })
    ).json();
    relogio = new Date(AGORA.getTime() + 61 * 60_000);
    const tarde = await pedir(m.token, 'POST', `/v1/acoes/${outro.consequencia.eventoId}/desfazer`);
    expect(tarde.statusCode).toBe(409);
  });

  it('responder um comentário e mandar DM debitam 1 cada e vão para a IA', async () => {
    const m = await mundoDeExemplo();
    const resposta = await pedir(m.token, 'POST', `/v1/posts/${m.posts.respostaDuda}/respostas`, {
      texto: 'valeu, duda',
    });
    expect(resposta.statusCode).toBe(201);
    expect(resposta.json().post.respondeA).toBe(m.posts.respostaDuda);

    const dm = await pedir(m.token, 'POST', `/v1/conversas/${m.conversas.duda}/mensagens`, {
      texto: 'bora gravar?',
    });
    expect(dm.statusCode).toBe(201);
    expect(dm.json().mensagem).toMatchObject({ minha: true, texto: 'bora gravar?' });
    expect(await filas.dm.getJob(`dm-${dm.json().consequencia.eventoId}`)).toBeTruthy();

    const thread = (await pedir(m.token, 'GET', `/v1/posts/${m.posts.lua}/respostas`)).json();
    expect(thread.respostas.some((p: { texto: string }) => p.texto === 'valeu, duda')).toBe(true);
  });

  it('curtir alterna e é grátis', async () => {
    const m = await mundoDeExemplo();
    const antes = await energiaDe(m.token);
    const uma = (await pedir(m.token, 'POST', `/v1/posts/${m.posts.vic}/curtir`)).json();
    const duas = (await pedir(m.token, 'POST', `/v1/posts/${m.posts.vic}/curtir`)).json();
    expect(uma.curtidoPorMim).toBe(true);
    expect(duas.curtidoPorMim).toBe(false);
    expect(duas.curtidas).toBe(uma.curtidas - 1);
    expect(await energiaDe(m.token)).toBe(antes);
  });
});

describe('jornada e evento', () => {
  it('resgatar o marco liberado dá 25 gemas e energia cheia, uma vez só', async () => {
    const m = await mundoDeExemplo();
    const jornada = (await pedir(m.token, 'GET', '/v1/jornada')).json();
    expect(jornada.marcos).toHaveLength(5);
    expect(jornada.marcos[0].estado).toBe('concluido');
    const gemas = (await pedir(m.token, 'GET', '/v1/conta')).json().gemas as number;
    const conta = (await pedir(m.token, 'POST', `/v1/marcos/${m.marcoIds[0]}/resgatar`)).json();
    expect(conta).toMatchObject({ gemas: gemas + 25, energia: { atual: 12 } });
    expect((await pedir(m.token, 'POST', `/v1/marcos/${m.marcoIds[0]}/resgatar`)).statusCode).toBe(
      409,
    );
  });

  it('campanha antes do evento, ao vivo na hora marcada e discurso com vencedor', async () => {
    const m = await mundoDeExemplo();
    const evento = (await pedir(m.token, 'GET', `/v1/eventos/${m.eventoId}`)).json();
    expect(evento.estado).toBe('campanha');
    expect(evento.discurso.find((o: { id: string }) => o.id === 'ousado').liberada).toBe(false);

    const campanha = (
      await pedir(m.token, 'POST', `/v1/eventos/${m.eventoId}/campanha`, { acaoId: 'ensaiar' })
    ).json();
    expect(campanha.evento.discurso.find((o: { id: string }) => o.id === 'ousado').liberada).toBe(
      true,
    );

    relogio = new Date(AGORA.getTime() + 3 * 24 * 3600_000);
    const aoVivo = (await pedir(m.token, 'GET', `/v1/eventos/${m.eventoId}`)).json();
    expect(aoVivo.estado).toBe('ao_vivo');
    expect(aoVivo.prazoAoVivo).not.toBeNull();

    const r = await pedir(m.token, 'POST', `/v1/eventos/${m.eventoId}/discurso`, {
      opcao: 'ousado',
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().evento).toMatchObject({ estado: 'encerrado' });
    expect(r.json().evento.vencedor).not.toBeNull();
    expect(await filas.discurso.getJob(`discurso-${r.json().consequencia.eventoId}`)).toBeTruthy();
  });
});

describe('tempo real', () => {
  it('o WebSocket recebe o que é publicado no canal do mundo', async () => {
    const m = await mundoDeExemplo();
    const endereco = app.server.address() as { port: number };
    const socket = new WebSocket(`ws://127.0.0.1:${endereco.port}/v1/tempo-real?token=${m.token}`);
    const recebido = new Promise<string>((resolver) =>
      socket.on('message', (d) => resolver(String(d))),
    );
    await new Promise((resolver) => socket.on('open', resolver));
    // Espera a assinatura do canal antes de publicar.
    await new Promise((resolver) => setTimeout(resolver, 100));
    await redis.publish(
      canalDoMundo(m.mundoId),
      JSON.stringify({ tipo: 'energia', energia: { atual: 1 } }),
    );
    expect(JSON.parse(await recebido)).toMatchObject({ tipo: 'energia' });
    const fechou = new Promise((resolver) => socket.on('close', resolver));
    socket.close();
    await fechou;
  });

  it('as filas existem com os nomes do contrato', () => {
    expect(Object.keys(filas).sort()).toEqual(Object.values(FILAS).sort());
  });
});

describe('concorrência', () => {
  it('dois desfazer em paralelo revertem uma vez só e cobram uma vez', async () => {
    const m = await mundoDeExemplo();
    const antes = (await pedir(m.token, 'GET', `/v1/personagens/${m.jogadorId}`)).json();
    const { consequencia } = (
      await pedir(m.token, 'POST', '/v1/posts', {
        texto: 'apaga duas vezes',
        tom: 'provocativo',
        marcados: [],
      })
    ).json();
    const respostas = await Promise.all([
      pedir(m.token, 'POST', `/v1/acoes/${consequencia.eventoId}/desfazer`),
      pedir(m.token, 'POST', `/v1/acoes/${consequencia.eventoId}/desfazer`),
    ]);
    expect(respostas.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(respostas.find((r) => r.statusCode === 409)!.json()).toMatchObject({
      erro: 'desfazer_expirado',
    });
    expect(await energiaDe(m.token)).toBe(consequencia.energia.atual - 2);
    const depois = (await pedir(m.token, 'GET', `/v1/personagens/${m.jogadorId}`)).json();
    expect(depois).toMatchObject({
      polemica: antes.polemica,
      seguidores: antes.seguidores,
      fama: antes.fama,
    });
    const desfazer = await conexao.db
      .select()
      .from(tabelaAcao)
      .where(and(eq(tabelaAcao.mundoId, m.mundoId), eq(tabelaAcao.tipo, 'desfazer')));
    expect(desfazer).toHaveLength(1);
  });

  it('dois resgates do mesmo marco em paralelo: um passa, o outro dá marco_resgatado', async () => {
    const m = await mundoDeExemplo();
    const gemas = (await pedir(m.token, 'GET', '/v1/conta')).json().gemas as number;
    const respostas = await Promise.all([
      pedir(m.token, 'POST', `/v1/marcos/${m.marcoIds[0]}/resgatar`),
      pedir(m.token, 'POST', `/v1/marcos/${m.marcoIds[0]}/resgatar`),
    ]);
    expect(respostas.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(respostas.find((r) => r.statusCode === 409)!.json()).toMatchObject({
      erro: 'marco_resgatado',
    });
    expect((await pedir(m.token, 'GET', '/v1/conta')).json().gemas).toBe(gemas + 25);
  });

  it('duas recargas por gemas em paralelo cobram uma vez; a segunda acha a barra cheia', async () => {
    const m = await mundoDeExemplo();
    await pedir(m.token, 'POST', '/v1/posts', { texto: 'gasto um', tom: 'fofo', marcados: [] });
    const gemas = (await pedir(m.token, 'GET', '/v1/conta')).json().gemas as number;
    const respostas = await Promise.all([
      pedir(m.token, 'POST', '/v1/energia/recarga', { via: 'gemas' }),
      pedir(m.token, 'POST', '/v1/energia/recarga', { via: 'gemas' }),
    ]);
    expect(respostas.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(respostas.find((r) => r.statusCode === 409)!.json()).toMatchObject({
      erro: 'energia_cheia',
    });
    expect((await pedir(m.token, 'GET', '/v1/conta')).json().gemas).toBe(gemas - 10);
    expect(await energiaDe(m.token)).toBe(12);
  });

  it('dois discursos em paralelo: só um por evento', async () => {
    const m = await mundoDeExemplo();
    relogio = new Date('2026-10-18T21:05:00Z');
    expect((await pedir(m.token, 'GET', `/v1/eventos/${m.eventoId}`)).json().estado).toBe(
      'ao_vivo',
    );
    const respostas = await Promise.all([
      pedir(m.token, 'POST', `/v1/eventos/${m.eventoId}/discurso`, { opcao: 'seguro' }),
      pedir(m.token, 'POST', `/v1/eventos/${m.eventoId}/discurso`, { opcao: 'seguro' }),
    ]);
    expect(respostas.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(respostas.find((r) => r.statusCode === 409)!.json()).toMatchObject({
      erro: 'evento_fora_do_ar',
    });
    const discursos = await conexao.db
      .select()
      .from(tabelaAcao)
      .where(and(eq(tabelaAcao.mundoId, m.mundoId), eq(tabelaAcao.tipo, 'discurso')));
    expect(discursos).toHaveLength(1);
    // Um GET depois não reabre o evento encerrado.
    expect((await pedir(m.token, 'GET', `/v1/eventos/${m.eventoId}`)).json().estado).toBe(
      'encerrado',
    );
  });
});

describe('evento ao vivo', () => {
  // Fixture: mundo criado em 11/10 12h (São Paulo), evento no dia 8 (18/10) à noite.
  it('à 00h30 do dia do evento ainda é campanha; às 18h05 entra ao vivo', async () => {
    const m = await mundoDeExemplo();
    relogio = new Date('2026-10-18T03:30:00Z');
    const madrugada = (await pedir(m.token, 'GET', `/v1/eventos/${m.eventoId}`)).json();
    expect(madrugada.estado).toBe('campanha');
    expect(madrugada.prazoAoVivo).toBeNull();
    relogio = new Date('2026-10-18T21:05:00Z');
    const noite = (await pedir(m.token, 'GET', `/v1/eventos/${m.eventoId}`)).json();
    expect(noite.estado).toBe('ao_vivo');
    expect(noite.prazoAoVivo).toBe('2026-10-18T21:05:30.000Z');
  });

  it('passados os 30 segundos, só o discurso seguro é aceito', async () => {
    const m = await mundoDeExemplo();
    await pedir(m.token, 'POST', `/v1/eventos/${m.eventoId}/campanha`, { acaoId: 'ensaiar' });
    relogio = new Date('2026-10-18T21:05:00Z');
    await pedir(m.token, 'GET', `/v1/eventos/${m.eventoId}`);
    relogio = new Date('2026-10-18T21:05:31Z');
    const ousado = await pedir(m.token, 'POST', `/v1/eventos/${m.eventoId}/discurso`, {
      opcao: 'ousado',
    });
    expect(ousado.statusCode).toBe(409);
    expect(ousado.json()).toEqual({ erro: 'discurso_bloqueado', mensagem: 'O tempo acabou.' });
    const seguro = await pedir(m.token, 'POST', `/v1/eventos/${m.eventoId}/discurso`, {
      opcao: 'seguro',
    });
    expect(seguro.statusCode).toBe(200);
  });

  it('a jornada mostra o próximo evento não encerrado', async () => {
    const m = await mundoDeExemplo();
    await conexao.db
      .update(eventoAgendado)
      .set({ estado: 'encerrado' })
      .where(eq(eventoAgendado.id, m.eventoId));
    const [outro] = await conexao.db
      .insert(eventoAgendado)
      .values({
        mundoId: m.mundoId,
        tipo: 'premio',
        titulo: 'Outro prêmio',
        categoria: 'Clipe do ano',
        diaMundo: 10,
        periodo: 'noite',
        indicados: [{ personagemId: m.jogadorId, base: 40 }],
        estado: 'anunciado',
      })
      .returning();
    const jornada = (await pedir(m.token, 'GET', '/v1/jornada')).json();
    expect(jornada.proximoEvento).toMatchObject({ id: outro!.id, estado: 'anunciado' });
  });
});

describe('desfazer e o que já chegou', () => {
  it('apaga os alertas futuros da ação e marca os entregues como lidos', async () => {
    const m = await mundoDeExemplo();
    const { consequencia } = (
      await pedir(m.token, 'POST', '/v1/posts', { texto: 'com alertas', tom: 'fofo', marcados: [] })
    ).json();
    const acaoId = consequencia.eventoId as string;
    const [entregue, futuro] = await conexao.db
      .insert(alerta)
      .values([
        {
          mundoId: m.mundoId,
          tipo: 'resposta',
          texto: 'Duda respondeu você',
          personagemId: m.personagens.duda,
          acaoId,
          destino: '/post/x/respostas',
          entregarEm: new Date(AGORA.getTime() - 60_000),
        },
        {
          mundoId: m.mundoId,
          tipo: 'mencao',
          texto: 'Vic comentou sobre você',
          personagemId: m.personagens.vic,
          acaoId,
          destino: '/post/y/respostas',
          entregarEm: new Date(AGORA.getTime() + 5 * 60_000),
        },
      ])
      .returning();
    expect((await pedir(m.token, 'POST', `/v1/acoes/${acaoId}/desfazer`)).statusCode).toBe(200);
    const [ficou] = await conexao.db.select().from(alerta).where(eq(alerta.id, entregue!.id));
    expect(ficou!.lidoEm).not.toBeNull();
    expect(await conexao.db.select().from(alerta).where(eq(alerta.id, futuro!.id))).toHaveLength(0);
  });

  it('desfazer uma DM com resposta já entregue tira a resposta das não lidas', async () => {
    const m = await mundoDeExemplo();
    const [antes] = await conexao.db
      .select()
      .from(conversa)
      .where(eq(conversa.id, m.conversas.vic));
    const dm = (
      await pedir(m.token, 'POST', `/v1/conversas/${m.conversas.vic}/mensagens`, {
        texto: 'bora de feat?',
      })
    ).json();
    // A resposta da Vic chegou e a entrega somou nas não lidas.
    await conexao.db.insert(mensagem).values({
      conversaId: m.conversas.vic,
      autorId: m.personagens.vic,
      texto: 'bora',
      acaoId: dm.consequencia.eventoId,
      entregarEm: AGORA,
      entregueEm: AGORA,
    });
    await conexao.db
      .update(conversa)
      .set({ naoLidas: antes!.naoLidas + 1 })
      .where(eq(conversa.id, m.conversas.vic));
    const r = await pedir(m.token, 'POST', `/v1/acoes/${dm.consequencia.eventoId}/desfazer`);
    expect(r.statusCode).toBe(200);
    const [depois] = await conexao.db
      .select()
      .from(conversa)
      .where(eq(conversa.id, m.conversas.vic));
    expect(depois!.naoLidas).toBe(antes!.naoLidas);
  });
});

describe('pedidos fora do formato', () => {
  it('JSON malformado, tipo de conteúdo errado e corpo grande respondem 4xx com invalido', async () => {
    const m = await mundoDeExemplo();
    const comCorpo = (payload: string, tipo: string) =>
      app.inject({
        method: 'POST',
        url: '/v1/posts',
        payload,
        headers: { authorization: `Bearer ${m.token}`, 'content-type': tipo },
      });
    const malformado = await comCorpo('{"texto":', 'application/json');
    expect(malformado.statusCode).toBe(400);
    expect(malformado.json()).toMatchObject({ erro: 'invalido' });
    const xml = await comCorpo('<post/>', 'application/xml');
    expect(xml.statusCode).toBe(415);
    expect(xml.json()).toMatchObject({ erro: 'invalido' });
    const grande = await comCorpo(
      JSON.stringify({ texto: 'a'.repeat(1_100_000) }),
      'application/json',
    );
    expect(grande.statusCode).toBe(413);
    expect(grande.json()).toMatchObject({ erro: 'invalido' });
  });

  it('cursor do feed com id que não é uuid dá 400', async () => {
    const m = await mundoDeExemplo();
    const cursor = encodeURIComponent('2026-10-16T14:00:00.000Z|nao-e-uuid');
    const r = await pedir(m.token, 'GET', `/v1/mundos/${m.mundoId}/feed?cursor=${cursor}`);
    expect(r.statusCode).toBe(400);
    expect(r.json()).toMatchObject({ erro: 'invalido' });
  });
});

describe('histórias', () => {
  it('história vencida dá 404 em abrir, votar e responder; história não aceita comentário', async () => {
    const m = await mundoDeExemplo();
    await conexao.db
      .update(post)
      .set({ expiraEm: new Date(AGORA.getTime() - 60_000) })
      .where(eq(post.id, m.posts.historiaVic));
    const id = m.posts.historiaVic;
    expect((await pedir(m.token, 'GET', `/v1/historias/${id}`)).statusCode).toBe(404);
    expect(
      (await pedir(m.token, 'POST', `/v1/historias/${id}/voto`, { opcao: 'o1' })).statusCode,
    ).toBe(404);
    expect(
      (await pedir(m.token, 'POST', `/v1/historias/${id}/resposta`, { texto: 'oi' })).statusCode,
    ).toBe(404);
    const comentario = await pedir(m.token, 'POST', `/v1/posts/${m.posts.historiaDuda}/respostas`, {
      texto: 'comentário em história',
    });
    expect(comentario.statusCode).toBe(404);
  });
});

describe('silenciar personagem', () => {
  it('silenciado some do feed (posts e histórias) e da lista de conversas; deixar de silenciar traz de volta', async () => {
    const m = await mundoDeExemplo();
    const feedAntes = (await pedir(m.token, 'GET', `/v1/mundos/${m.mundoId}/feed`)).json();
    expect(
      feedAntes.itens.some((p: { autor: { id: string } }) => p.autor.id === m.personagens.vic),
    ).toBe(true);
    expect(
      feedAntes.historias.some((h: { autor: { id: string } }) => h.autor.id === m.personagens.vic),
    ).toBe(true);
    const energia = await energiaDe(m.token);

    const silenciado = await pedir(
      m.token,
      'POST',
      `/v1/personagens/${m.personagens.vic}/silenciar`,
      {
        silenciado: true,
      },
    );
    expect(silenciado.statusCode).toBe(200);
    expect(silenciado.json()).toMatchObject({ id: m.personagens.vic, silenciado: true });
    expect(silenciado.json().relacao).not.toBeNull();
    expect(
      (await pedir(m.token, 'GET', `/v1/personagens/${m.personagens.vic}`)).json().silenciado,
    ).toBe(true);

    const feed = (await pedir(m.token, 'GET', `/v1/mundos/${m.mundoId}/feed`)).json();
    expect(feed.itens.length).toBeGreaterThan(0);
    expect(
      feed.itens.some((p: { autor: { id: string } }) => p.autor.id === m.personagens.vic),
    ).toBe(false);
    expect(
      feed.historias.some((h: { autor: { id: string } }) => h.autor.id === m.personagens.vic),
    ).toBe(false);
    expect(feed.historias.length).toBeGreaterThan(0);

    // A conversa continua existindo (abre pelo perfil), só marcada para o app tirar da lista.
    const conversas = (await pedir(m.token, 'GET', '/v1/conversas')).json() as {
      id: string;
      silenciada: boolean;
    }[];
    expect(conversas.find((c) => c.id === m.conversas.vic)?.silenciada).toBe(true);
    expect(conversas.find((c) => c.id === m.conversas.duda)?.silenciada).toBe(false);

    const volta = await pedir(m.token, 'POST', `/v1/personagens/${m.personagens.vic}/silenciar`, {
      silenciado: false,
    });
    expect(volta.json()).toMatchObject({ silenciado: false });
    const feedDepois = (await pedir(m.token, 'GET', `/v1/mundos/${m.mundoId}/feed`)).json();
    expect(
      feedDepois.itens.some((p: { autor: { id: string } }) => p.autor.id === m.personagens.vic),
    ).toBe(true);
    expect(await energiaDe(m.token)).toBe(energia);
  });

  it('corpo inválido dá 400 e o jogador não se silencia', async () => {
    const m = await mundoDeExemplo();
    const url = `/v1/personagens/${m.personagens.vic}/silenciar`;
    expect((await pedir(m.token, 'POST', url, { silenciado: 'sim' })).statusCode).toBe(400);
    expect((await pedir(m.token, 'POST', url, {})).statusCode).toBe(400);
    const eu = await pedir(m.token, 'POST', `/v1/personagens/${m.jogadorId}/silenciar`, {
      silenciado: true,
    });
    expect(eu.statusCode).toBe(400);
    expect(eu.json()).toMatchObject({ erro: 'invalido' });
  });
});

describe('virada de ato', () => {
  const idDoJob = (mundoId: string, ato: number) => `novo_ato-${mundoId}-${ato}`;
  const resgatarOutros = (mundoId: string, quando: Date = AGORA) =>
    conexao.db
      .update(tabelaMarco)
      .set({ liberadoEm: quando, resgatadoEm: quando })
      .where(and(eq(tabelaMarco.mundoId, mundoId), ne(tabelaMarco.ordem, 1)));

  it('resgatar um marco que não é o último não enfileira o novo_ato nem mexe na jornada', async () => {
    const m = await mundoDeExemplo();
    await pedir(m.token, 'POST', `/v1/marcos/${m.marcoIds[0]}/resgatar`);
    expect(await filas.lote.getJob(idDoJob(m.mundoId, 2))).toBeUndefined();
    const jornada = (await pedir(m.token, 'GET', '/v1/jornada')).json();
    expect(jornada.ato).toBe(1);
    expect(jornada).not.toHaveProperty('proximoAto');
  });

  it('resgatar o 5º marco enfileira o novo_ato do ato seguinte e a jornada avisa que ele chega', async () => {
    const m = await mundoDeExemplo();
    await resgatarOutros(m.mundoId);
    const conta = await pedir(m.token, 'POST', `/v1/marcos/${m.marcoIds[0]}/resgatar`);
    expect(conta.statusCode).toBe(200);
    const job = await filas.lote.getJob(idDoJob(m.mundoId, 2));
    expect(job?.name).toBe('novo_ato');
    expect(job?.data).toEqual({ mundoId: m.mundoId, ato: 2 });

    const jornada = (await pedir(m.token, 'GET', '/v1/jornada')).json();
    expect(jornada).toMatchObject({ ato: 1, progressoAto: 1, proximoAto: { ato: 2 } });
    expect(jornada.marcos.every((x: { resgatado: boolean }) => x.resgatado)).toBe(true);
  });

  it('com o job fora do ar o resgate continua valendo', async () => {
    const m = await mundoDeExemplo();
    await resgatarOutros(m.mundoId);
    const antes = ctx.filas.lote.add;
    ctx.filas.lote.add = async () => {
      throw new Error('redis fora');
    };
    try {
      const r = await pedir(m.token, 'POST', `/v1/marcos/${m.marcoIds[0]}/resgatar`);
      expect(r.statusCode).toBe(200);
    } finally {
      ctx.filas.lote.add = antes;
    }
    expect(await filas.lote.getJob(idDoJob(m.mundoId, 2))).toBeUndefined();
    // O varredor enfileira depois de 2 minutos.
    await conexao.db
      .update(tabelaMarco)
      .set({ resgatadoEm: new Date(AGORA.getTime() - 3 * 60_000) })
      .where(eq(tabelaMarco.mundoId, m.mundoId));
    await varrerPendentes(ctx);
    expect((await filas.lote.getJob(idDoJob(m.mundoId, 2)))?.data).toEqual({
      mundoId: m.mundoId,
      ato: 2,
    });
  });

  it('o ato novo aparece na jornada quando o mundo avança, sem o aviso de chegada', async () => {
    const m = await mundoDeExemplo();
    await resgatarOutros(m.mundoId);
    await pedir(m.token, 'POST', `/v1/marcos/${m.marcoIds[0]}/resgatar`);
    await conexao.db
      .update(tabelaMundo)
      .set({ ato: 2, objetivoAto: 'Ato dois' })
      .where(eq(tabelaMundo.id, m.mundoId));
    await conexao.db.insert(tabelaMarco).values({
      mundoId: m.mundoId,
      ato: 2,
      ordem: 1,
      titulo: 'Fama posta à prova',
      descricao: 'Provar que a fama fica.',
      requisitos: [{ chave: 'seguidores', rotulo: 'Seguidores', alvo: 500_000 }],
      recompensa: { gemas: 25, energiaCheia: true, personagemNovo: true, acaoNova: 'Enquete' },
    });
    const jornada = (await pedir(m.token, 'GET', '/v1/jornada')).json();
    expect(jornada).toMatchObject({ ato: 2, objetivo: 'Ato dois' });
    expect(jornada.marcos).toHaveLength(1);
    expect(jornada.marcos[0]).toMatchObject({ titulo: 'Fama posta à prova', estado: 'atual' });
    expect(jornada).not.toHaveProperty('proximoAto');
  });

  it('varredor: reenfileira o ato terminado há mais de 2 min sem job; o recente e o que tem job ficam', async () => {
    const velho = await mundoDeExemplo();
    const recente = await mundoDeExemplo();
    const comJob = await mundoDeExemplo();
    for (const [mundo, minutos] of [
      [velho, 3],
      [recente, 1],
      [comJob, 5],
    ] as const) {
      await resgatarOutros(mundo.mundoId, new Date(AGORA.getTime() - minutos * 60_000));
      await conexao.db
        .update(tabelaMarco)
        .set({ resgatadoEm: new Date(AGORA.getTime() - minutos * 60_000) })
        .where(and(eq(tabelaMarco.mundoId, mundo.mundoId), eq(tabelaMarco.ordem, 1)));
    }
    await filas.lote.add(
      'novo_ato',
      { mundoId: comJob.mundoId, ato: 2 },
      { jobId: idDoJob(comJob.mundoId, 2), delay: 60_000 },
    );
    relogio = AGORA;
    await varrerPendentes(ctx);
    expect((await filas.lote.getJob(idDoJob(velho.mundoId, 2)))?.data).toEqual({
      mundoId: velho.mundoId,
      ato: 2,
    });
    expect(await filas.lote.getJob(idDoJob(recente.mundoId, 2))).toBeUndefined();
    expect((await filas.lote.getJob(idDoJob(comJob.mundoId, 2)))?.opts.delay).toBe(60_000);
  });

  it('varredor: job que falhou de vez só volta depois do intervalo de repetição', async () => {
    const m = await mundoDeExemplo();
    await resgatarOutros(m.mundoId, new Date(AGORA.getTime() - 60 * 60_000));
    await conexao.db
      .update(tabelaMarco)
      .set({ resgatadoEm: new Date(AGORA.getTime() - 60 * 60_000) })
      .where(eq(tabelaMarco.mundoId, m.mundoId));
    const jobId = idDoJob(m.mundoId, 2);
    await filas.lote.add('novo_ato', { mundoId: m.mundoId, ato: 2 }, { jobId });
    const conexaoWorker = new Redis(URL_REDIS, { maxRetriesPerRequest: null });
    const trabalhador = new Worker(
      FILAS.lote,
      async () => {
        throw new UnrecoverableError('IA fora do ar');
      },
      { connection: conexaoWorker },
    );
    try {
      for (
        let i = 0;
        i < 100 && (await filas.lote.getJob(jobId).then((j) => j?.getState())) !== 'failed';
        i++
      ) {
        await new Promise((r) => setTimeout(r, 50));
      }
      const falhou = (await filas.lote.getJob(jobId))!;
      expect(await falhou.getState()).toBe('failed');
    } finally {
      await trabalhador.close();
      await conexaoWorker.quit();
    }

    // Terminou há pouco: espera.
    relogio = new Date(Date.now() + 60_000);
    await varrerPendentes(ctx);
    expect(await (await filas.lote.getJob(jobId))!.getState()).toBe('failed');

    // Passado o intervalo: o job antigo sai e entra um novo, na fila.
    relogio = new Date(Date.now() + REPETE_NOVO_ATO_MS + 60_000);
    const resultado = await varrerPendentes(ctx);
    expect(resultado.reenfileirados).toBeGreaterThanOrEqual(1);
    expect(await (await filas.lote.getJob(jobId))!.getState()).toBe('waiting');
    await (await filas.lote.getJob(jobId))!.remove();
    relogio = AGORA;
  });
});

describe('autorização entre mundos', () => {
  it('ids de outro mundo dão 404', async () => {
    const a = await mundoDeExemplo();
    const b = await mundoDeExemplo();
    const pedidos: [Parameters<typeof pedir>[1], string, unknown?][] = [
      ['GET', `/v1/posts/${b.posts.lua}`],
      ['POST', `/v1/posts/${b.posts.lua}/curtir`],
      ['GET', `/v1/posts/${b.posts.lua}/respostas`],
      ['POST', `/v1/posts/${b.posts.lua}/respostas`, { texto: 'oi' }],
      ['GET', `/v1/historias/${b.posts.historiaVic}`],
      ['GET', `/v1/conversas/${b.conversas.vic}/mensagens`],
      ['POST', `/v1/conversas/${b.conversas.vic}/mensagens`, { texto: 'oi' }],
      ['GET', `/v1/personagens/${b.personagens.vic}`],
      ['POST', `/v1/personagens/${b.personagens.vic}/conversa`],
      ['POST', `/v1/personagens/${b.personagens.vic}/silenciar`, { silenciado: true }],
      ['GET', `/v1/eventos/${b.eventoId}`],
      ['POST', `/v1/eventos/${b.eventoId}/campanha`, { acaoId: 'ensaiar' }],
      ['POST', `/v1/marcos/${b.marcoIds[0]}/resgatar`],
      ['POST', `/v1/acoes/${b.acaoId}/desfazer`],
      ['GET', `/v1/mundos/${b.mundoId}/feed`],
    ];
    const energia = await energiaDe(a.token);
    for (const [metodo, url, corpo] of pedidos) {
      const r = await pedir(a.token, metodo, url, corpo);
      expect({ url, status: r.statusCode }).toEqual({ url, status: 404 });
    }
    expect(await energiaDe(a.token)).toBe(energia);
  });
});

describe('varredor', () => {
  it('reenfileira a ação que espera a IA há mais de 2 min sem job; a recente fica', async () => {
    const m = await mundoDeExemplo();
    const nova = (minutos: number) =>
      conexao.db
        .insert(tabelaAcao)
        .values({
          mundoId: m.mundoId,
          tipo: 'post',
          entrada: { texto: 'sem job', tom: 'fofo', marcados: [] },
          iaPendente: 1,
          criadoEm: new Date(AGORA.getTime() - minutos * 60_000),
        })
        .returning()
        .then((l) => l[0]!);
    const velha = await nova(3);
    const recente = await nova(1);
    const resultado = await varrerPendentes(ctx);
    expect(resultado.reenfileirados).toBeGreaterThanOrEqual(1);
    expect((await filas.diretor.getJob(`diretor-${velha.id}`))?.data).toEqual({
      acaoId: velha.id,
    });
    expect(await filas.diretor.getJob(`diretor-${recente.id}`)).toBeUndefined();
  });
});
