// Testes contra o Postgres do Docker (banco holofote_teste). O schema public é recriado do zero no
// início deste arquivo; não crie outro arquivo de teste que mexa no banco sem coordenar com este.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { asc, eq, sql as sqlDrizzle } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarDb } from './cliente';
import { criarFixturePopBrasil, type FixturePopBrasil } from './fixtures/pop-brasil';
import { migrar } from './migrar';
import * as s from './schema';

const URL_TESTE =
  process.env.DATABASE_URL_TESTE ?? 'postgres://holofote:holofote@localhost:5432/holofote_teste';

// Trava de segurança: este arquivo apaga o schema public inteiro.
if (!new URL(URL_TESTE).pathname.endsWith('_teste')) {
  throw new Error(`DATABASE_URL_TESTE precisa apontar para um banco *_teste (recebi ${URL_TESTE})`);
}

const conexao = criarDb(URL_TESTE, { max: 4, onnotice: () => {} });
const { db, sql } = conexao;

const TABELAS = [
  'acao',
  'alerta',
  'chamada_llm',
  'conversa',
  'curtida',
  'delta',
  'evento_agendado',
  'historia_vista',
  'lancamento_energia',
  'lancamento_gemas',
  'marco',
  'memoria',
  'mensagem',
  'mundo',
  'personagem',
  'post',
  'relacao',
  'resumo_dia',
  'usuario',
  'voto',
];

/** Erro do Postgres por trás do erro do Drizzle (que embrulha a causa). */
async function erroDoBanco(
  consulta: PromiseLike<unknown>,
): Promise<{ code?: string; constraint_name?: string }> {
  try {
    await consulta;
  } catch (erro) {
    const causa = (erro as { cause?: unknown }).cause ?? erro;
    return causa as { code?: string; constraint_name?: string };
  }
  throw new Error('a consulta deveria ter falhado');
}

async function contarTudo(): Promise<Record<string, number>> {
  const contagens: Record<string, number> = {};
  for (const tabela of TABELAS) {
    const [linha] = await sql<{ n: number }[]>`select count(*)::int as n from ${sql(tabela)}`;
    contagens[tabela] = linha?.n ?? 0;
  }
  return contagens;
}

beforeAll(async () => {
  await sql.unsafe(`
    drop schema if exists drizzle cascade;
    drop schema if exists public cascade;
    create schema public;
  `);
  await migrar(URL_TESTE);
});

afterAll(async () => {
  await conexao.fechar();
});

describe('migrações', () => {
  it('criam do zero a extensão vector, as 20 tabelas e o índice HNSW', async () => {
    const extensoes = await sql<{ extname: string }[]>`select extname from pg_extension`;
    expect(extensoes.map((e) => e.extname)).toContain('vector');

    const tabelas = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`;
    expect(tabelas.map((t) => t.table_name)).toEqual(TABELAS);

    const [hnsw] = await sql<{ indexdef: string }[]>`
      select indexdef from pg_indexes where indexname = 'memoria_embedding_hnsw'`;
    expect(hnsw?.indexdef).toMatch(/USING hnsw \(embedding vector_cosine_ops\)/);
  });

  it('colunas em snake_case no banco', async () => {
    const colunas = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'personagem'`;
    const nomes = colunas.map((c) => c.column_name);
    expect(nomes).toEqual(expect.arrayContaining(['mundo_id', 'tom_avatar', 'perfil_fofoca']));
    expect(nomes.every((n) => n === n.toLowerCase())).toBe(true);
  });

  it('são idempotentes', async () => {
    await migrar(URL_TESTE);
    const [aplicadas] = await sql<{ n: number }[]>`
      select count(*)::int as n from drizzle.__drizzle_migrations`;
    const diario = JSON.parse(
      readFileSync(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'),
    ) as { entries: unknown[] };
    expect(aplicadas?.n).toBe(diario.entries.length);
  });
});

describe('fixture Pop Brasil', () => {
  let f: FixturePopBrasil;

  beforeAll(async () => {
    f = await criarFixturePopBrasil(db, { agora: new Date('2026-10-16T21:40:00-03:00') });
  });

  it('a jogadora tem 7,1 mil seguidores e os atributos do perfil', async () => {
    const lua = await db.query.personagem.findFirst({ where: eq(s.personagem.id, f.jogadorId) });
    expect(lua).toMatchObject({
      nome: 'Lua Prado',
      handle: 'luaprado',
      papel: 'jogador',
      tipoVinculo: null,
      seguidores: 7_100,
      fama: 24,
      carisma: 61,
      polemica: 18,
    });
    const compacto = new Intl.NumberFormat('pt-BR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
    // O Intl separa com espaço não separável (U+00A0).
    expect(compacto.format(lua?.seguidores ?? 0).replace(/\s/g, ' ')).toBe('7,1 mil');
  });

  it('reproduz as afinidades das telas (Vic 38, Duda 72, Bento 88, fofocalizei 20)', async () => {
    const relacoes = await db.query.relacao.findMany({
      where: eq(s.relacao.deId, f.jogadorId),
      with: { para: true },
    });
    const porHandle = Object.fromEntries(relacoes.map((r) => [r.para.handle, r]));
    expect(porHandle.vicferraz).toMatchObject({ afinidade: 38, rotulo: 'Rivais com respeito' });
    expect(porHandle.dudamarques).toMatchObject({ afinidade: 72, rotulo: 'Parceria criativa' });
    expect(porHandle.bentolima).toMatchObject({ afinidade: 88, rotulo: 'Melhor amigo' });
    expect(porHandle.fofocalizei?.afinidade).toBe(20);
    expect(porHandle.vicferraz?.para.tipoVinculo).toBe('rival');
    expect(porHandle.dudamarques?.para.tipoVinculo).toBe('parceria');
    expect(porHandle.bentolima?.para.tipoVinculo).toBe('amizade');
    expect(porHandle.fofocalizei?.para.tipoVinculo).toBe('fofoca');
  });

  it('elenco e figurantes no mesmo mundo, um jogador só', async () => {
    const elenco = await db.query.personagem.findMany({
      where: eq(s.personagem.mundoId, f.mundoId),
    });
    const porPapel = (papel: string) => elenco.filter((p) => p.papel === papel).length;
    expect(porPapel('jogador')).toBe(1);
    expect(porPapel('elenco')).toBe(4);
    expect(porPapel('figurante')).toBeGreaterThanOrEqual(2);
  });

  it('energia e gemas saem dos lançamentos (+12 e +40 iniciais)', async () => {
    const energia = await db.query.lancamentoEnergia.findMany({
      where: eq(s.lancamentoEnergia.usuarioId, f.usuarioId),
    });
    expect(energia.find((l) => l.motivo === 'inicial')?.valor).toBe(12);
    expect(energia.reduce((soma, l) => soma + l.valor, 0)).toBe(11);

    const [gemas] = await db
      .select({ saldo: sqlDrizzle<number>`sum(${s.lancamentoGemas.valor})::int` })
      .from(s.lancamentoGemas)
      .where(eq(s.lancamentoGemas.usuarioId, f.usuarioId));
    expect(gemas?.saldo).toBe(40);
  });

  it('Ato 1 com cinco marcos; o segundo é "Primeiro show lotado"', async () => {
    const m = await db.query.mundo.findFirst({ where: eq(s.mundo.id, f.mundoId) });
    expect(m).toMatchObject({ ato: 1, objetivoAto: 'Dominar o pop nacional', estado: 'pronto' });
    expect(m?.biblia).toContain('@vicferraz');

    const marcos = await db.query.marco.findMany({
      where: eq(s.marco.mundoId, f.mundoId),
      orderBy: asc(s.marco.ordem),
    });
    expect(marcos.map((x) => x.ordem)).toEqual([1, 2, 3, 4, 5]);
    expect(marcos.map((x) => x.id)).toEqual(f.marcoIds);
    const show = marcos[1];
    expect(show?.titulo).toBe('Primeiro show lotado');
    expect(Object.fromEntries(show?.requisitos.map((r) => [r.chave, r.alvo]) ?? [])).toEqual({
      escandalos: 4,
      carisma: 70,
      seguidores: 10_000,
    });
    expect(marcos[0]?.liberadoEm).toBeInstanceOf(Date);
    expect(marcos[0]?.resgatadoEm).toBeNull();
  });

  it('Prêmio Holofote agendado com três indicados', async () => {
    const evento = await db.query.eventoAgendado.findFirst({
      where: eq(s.eventoAgendado.id, f.eventoId),
    });
    expect(evento).toMatchObject({
      titulo: 'Prêmio Holofote',
      tipo: 'premio',
      categoria: 'Revelação do ano',
      diaMundo: 8,
      periodo: 'noite',
      estado: 'campanha',
      campanha: [],
      vencedorId: null,
    });
    expect(evento?.indicados.map((i) => i.personagemId)).toEqual([
      f.personagens.vic,
      f.jogadorId,
      f.personagens.nina,
    ]);
  });

  it('posts com respostas aninhadas, história com enquete e a ação que os originou', async () => {
    const thread = await db.query.post.findFirst({
      where: eq(s.post.id, f.posts.lua),
      with: {
        autor: true,
        respostasDiretas: { with: { autor: true, respostasDiretas: true } },
        acao: { with: { deltas: true } },
      },
    });
    expect(thread?.autor.handle).toBe('luaprado');
    expect(thread?.marcados).toEqual([f.personagens.duda]);
    expect(thread?.respostasDiretas.map((r) => r.autor.handle).sort()).toEqual([
      'carol_fa',
      'dudamarques',
    ]);
    const duda = thread?.respostasDiretas.find((r) => r.autor.handle === 'dudamarques');
    expect(duda?.respostasDiretas.map((r) => r.id)).toEqual([f.posts.respostaBento]);
    expect(thread?.acao?.cartao?.titulo).toBe('O refrão pegou');
    expect(thread?.acao?.deltas.map((d) => d.alvo).sort()).toEqual(
      ['carisma', `relacao:${f.personagens.duda}`, 'seguidores'].sort(),
    );

    const historia = await db.query.post.findFirst({
      where: eq(s.post.id, f.posts.historiaVic),
      with: { votos: true },
    });
    expect(historia?.tipo).toBe('historia');
    expect(historia?.enquete?.opcoes.map((o) => o.id)).toEqual(['brilho', 'couro']);
    expect(historia?.votos.map((v) => v.opcao)).toEqual(['brilho']);
    expect(historia?.expiraEm).toBeInstanceOf(Date);

    const [{ n } = { n: 0 }] = await db
      .select({ n: sqlDrizzle<number>`count(*)::int` })
      .from(s.post)
      .where(eq(s.post.mundoId, f.mundoId));
    expect(n).toBeGreaterThanOrEqual(6);
  });

  it('conversa com a Vic na ordem de entrega', async () => {
    const c = await db.query.conversa.findFirst({
      where: eq(s.conversa.id, f.conversas.vic),
      with: { mensagens: { orderBy: asc(s.mensagem.entregarEm), with: { autor: true } } },
    });
    expect(c?.mensagens).toHaveLength(5);
    expect(c?.mensagens[0]).toMatchObject({ texto: 'vi a indireta. criativo.' });
    expect(c?.mensagens[0]?.autor.handle).toBe('vicferraz');
    expect(c?.mensagens.at(-1)?.autor.handle).toBe('luaprado');

    const duda = await db.query.conversa.findFirst({ where: eq(s.conversa.id, f.conversas.duda) });
    expect(duda).toMatchObject({ puxouConversa: true, naoLidas: 1 });
  });

  it('memórias e custo da chamada de IA', async () => {
    const lembra = await db.query.memoria.findFirst({
      where: eq(s.memoria.personagemId, f.personagens.duda),
    });
    expect(lembra?.fatos.split('\n')).toEqual([
      'Dia 2 · elogiou o clipe dela',
      'Dia 6 · topou o estúdio na quinta',
    ]);
    expect(lembra?.embedding).toBeNull();

    const chamada = await db.query.chamadaLlm.findFirst({
      where: eq(s.chamadaLlm.acaoId, f.acaoId),
    });
    expect(chamada?.custoUsd).toBeCloseTo(0.000832, 6);
  });

  it('guarda e lê um embedding de 1024 dimensões', async () => {
    const embedding = Array.from({ length: 1024 }, (_, i) => (i % 7) / 7);
    await db
      .update(s.memoria)
      .set({ embedding })
      .where(eq(s.memoria.personagemId, f.personagens.vic));
    const lida = await db.query.memoria.findFirst({
      where: eq(s.memoria.personagemId, f.personagens.vic),
    });
    expect(lida?.embedding).toHaveLength(1024);
    expect(lida?.embedding?.[6]).toBeCloseTo(6 / 7, 5);
  });

  describe('restrições', () => {
    it('aparelhoId é único', async () => {
      const [u] = await db
        .select({ aparelhoId: s.usuario.aparelhoId })
        .from(s.usuario)
        .where(eq(s.usuario.id, f.usuarioId));
      const erro = await erroDoBanco(
        db.insert(s.usuario).values({ aparelhoId: u?.aparelhoId ?? randomUUID() }),
      );
      expect(erro).toMatchObject({ code: '23505', constraint_name: 'usuario_aparelho_id_unico' });
    });

    it('handle é único por mundo, mas pode repetir em outro mundo', async () => {
      const base = {
        papel: 'figurante' as const,
        nome: 'Outra Vic',
        handle: 'vicferraz',
        iniciais: 'OV',
        ficha: 'imitadora.',
      };
      const erro = await erroDoBanco(
        db.insert(s.personagem).values({ ...base, mundoId: f.mundoId }),
      );
      expect(erro).toMatchObject({ code: '23505', constraint_name: 'personagem_handle_por_mundo' });

      const outroMundo = await db
        .insert(s.mundo)
        .values({
          usuarioId: f.usuarioId,
          universo: 'Faculdade de magia',
          tomCaos: 10,
          ativo: false,
        })
        .returning({ id: s.mundo.id });
      const mundoId = outroMundo[0]?.id ?? '';
      await expect(db.insert(s.personagem).values({ ...base, mundoId })).resolves.toBeDefined();
      await db.delete(s.mundo).where(eq(s.mundo.id, mundoId));
    });

    it('handle sem "@" e em minúsculas', async () => {
      const erro = await erroDoBanco(
        db.insert(s.personagem).values({
          mundoId: f.mundoId,
          papel: 'figurante',
          nome: 'Errado',
          handle: '@Errado',
          iniciais: 'ER',
          ficha: '-',
        }),
      );
      expect(erro).toMatchObject({ code: '23514', constraint_name: 'personagem_handle_formato' });
    });

    it('um mundo ativo por usuário', async () => {
      const erro = await erroDoBanco(
        db
          .insert(s.mundo)
          .values({ usuarioId: f.usuarioId, universo: 'Reality show', tomCaos: 50 }),
      );
      expect(erro).toMatchObject({ code: '23505', constraint_name: 'mundo_ativo_por_usuario' });
    });

    it('um jogador por mundo', async () => {
      const erro = await erroDoBanco(
        db.insert(s.personagem).values({
          mundoId: f.mundoId,
          papel: 'jogador',
          nome: 'Segunda Lua',
          handle: 'segundalua',
          iniciais: 'SL',
          ficha: '-',
        }),
      );
      expect(erro).toMatchObject({
        code: '23505',
        constraint_name: 'personagem_um_jogador_por_mundo',
      });
    });

    it('uma memória por par e uma conversa por personagem', async () => {
      const memoriaRepetida = await erroDoBanco(
        db.insert(s.memoria).values({
          personagemId: f.personagens.duda,
          sobreId: f.jogadorId,
          fatos: 'repetida',
          dia: 6,
        }),
      );
      expect(memoriaRepetida).toMatchObject({ code: '23505', constraint_name: 'memoria_por_par' });

      const conversaRepetida = await erroDoBanco(
        db.insert(s.conversa).values({ mundoId: f.mundoId, personagemId: f.personagens.vic }),
      );
      expect(conversaRepetida).toMatchObject({
        code: '23505',
        constraint_name: 'conversa_por_personagem',
      });
    });

    it('afinidade e atributos ficam entre 0 e 100', async () => {
      const afinidade = await erroDoBanco(
        db.update(s.relacao).set({ afinidade: 101 }).where(eq(s.relacao.paraId, f.personagens.vic)),
      );
      expect(afinidade).toMatchObject({
        code: '23514',
        constraint_name: 'relacao_afinidade_faixa',
      });

      const fama = await erroDoBanco(
        db.update(s.personagem).set({ fama: -1 }).where(eq(s.personagem.id, f.jogadorId)),
      );
      expect(fama).toMatchObject({ code: '23514', constraint_name: 'personagem_fama_faixa' });
    });

    it('delta só aceita os alvos conhecidos', async () => {
      const erro = await erroDoBanco(
        db.insert(s.delta).values({ acaoId: f.acaoId, alvo: 'dinheiro', valor: 10 }),
      );
      expect(erro).toMatchObject({ code: '23514', constraint_name: 'delta_alvo_formato' });
    });
  });

  describe('exclusão de conta', () => {
    it('apagar o usuário apaga tudo dele em todas as tabelas, sem tocar nos outros', async () => {
      const antes = await contarTudo();
      const outro = await criarFixturePopBrasil(db);
      const comOutro = await contarTudo();
      for (const tabela of TABELAS) {
        expect(comOutro[tabela], `a fixture preenche ${tabela}`).toBeGreaterThan(
          antes[tabela] ?? 0,
        );
      }

      await db.delete(s.usuario).where(eq(s.usuario.id, outro.usuarioId));

      expect(await contarTudo()).toEqual(antes);
      const restante = await db.query.mundo.findFirst({ where: eq(s.mundo.id, f.mundoId) });
      expect(restante?.id).toBe(f.mundoId);
    });
  });
});
