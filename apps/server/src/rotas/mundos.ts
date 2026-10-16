import {
  and,
  desc,
  eq,
  gt,
  historiaVista,
  iniciaisDe,
  isNull,
  lt,
  lte,
  mundo as tabelaMundo,
  normalizarHandle,
  or,
  personagem,
  personagemResumoDto,
  post,
  postsDto,
} from '@holofote/db';
import { criarRng, moderarTexto, numerosDoJogador, pareceNomeDePessoaReal } from '@holofote/engine';
import { Mundo, PedidoCriarMundo, RespostaFeed } from '@holofote/shared';
import { z } from 'zod';
import type { Contexto } from '../contexto';
import { violouUnicidade } from '../infra/banco';
import { ErroApi, naoEncontrado } from '../infra/erros';
import { enfileirarLote } from '../infra/filas';
import { mundoDto } from '../servicos/dto';
import { carregarSessao, exigirMundo } from '../servicos/sessao';
import type { Tx } from '../servicos/tipos';
import type { AppZod } from './tipos';

const TAMANHO_PAGINA = 20;

/** Barra texto pelo filtro local antes de qualquer gasto (422, nada é debitado). */
export function moderar(...textos: string[]) {
  for (const texto of textos) {
    const resultado = moderarTexto(texto);
    if (!resultado.ok) throw new ErroApi(422, 'moderacao', resultado.motivo);
  }
}

/** Cursor da paginação do feed: instante de entrega e id do último item. */
const codificarCursor = (entregarEm: Date, id: string) => `${entregarEm.toISOString()}|${id}`;
function decodificarCursor(cursor: string | undefined) {
  if (!cursor) return null;
  const [instante, id, ...resto] = cursor.split('|');
  const data = new Date(instante ?? '');
  if (resto.length > 0 || !z.uuid().safeParse(id).success || Number.isNaN(data.getTime())) {
    throw new ErroApi(400, 'invalido', 'Cursor inválido.');
  }
  return { data, id: id! };
}

/**
 * Transação da criação do mundo. Dois pedidos simultâneos passam pela checagem da sessão e um
 * esbarra no índice único `mundo_ativo_por_usuario`: responde 409 em vez de 500.
 */
async function criarMundoUnico(ctx: Contexto, gravar: (tx: Tx) => Promise<string>) {
  try {
    return await ctx.db.transaction(gravar);
  } catch (erro) {
    if (violouUnicidade(erro, 'mundo_ativo_por_usuario')) {
      throw new ErroApi(409, 'mundo_existente', 'Você já tem um mundo ativo.');
    }
    throw erro;
  }
}

export function rotasMundos(app: AppZod, ctx: Contexto) {
  app.post(
    '/v1/mundos',
    { schema: { body: PedidoCriarMundo, response: { 201: Mundo } } },
    async (req, reply) => {
      const sessao = await carregarSessao(ctx, req.usuarioId);
      if (sessao.mundo && sessao.mundo.estado !== 'erro') {
        throw new ErroApi(409, 'mundo_existente', 'Você já tem um mundo ativo.');
      }
      const { universo, tomCaos, persona } = req.body;
      moderar(universo, persona.nome, persona.descricao);
      if (pareceNomeDePessoaReal(persona.nome)) {
        throw new ErroApi(
          422,
          'moderacao',
          'O Holofote só tem pessoas inventadas. Escolha outro nome.',
        );
      }
      const handle = normalizarHandle(persona.handle);

      const mundoId = await criarMundoUnico(ctx, async (tx) => {
        // Um mundo que a IA não conseguiu criar (ou recusou) é trocado pelo novo pedido.
        if (sessao.mundo) await tx.delete(tabelaMundo).where(eq(tabelaMundo.id, sessao.mundo.id));
        const [novo] = await tx
          .insert(tabelaMundo)
          .values({ usuarioId: sessao.usuario.id, universo, tomCaos, estado: 'criando' })
          .returning();
        const numeros = numerosDoJogador(criarRng(`jogador:${novo!.id}`));
        await tx.insert(personagem).values({
          mundoId: novo!.id,
          papel: 'jogador',
          nome: persona.nome,
          handle,
          iniciais: iniciaisDe(persona.nome),
          tomAvatar: 'escuro',
          ficha: persona.descricao,
          ...numeros,
        });
        return novo!.id;
      });
      // A IA gera bíblia, elenco, marcos, evento e feed; o worker avisa pelo tempo real.
      await enfileirarLote(ctx, 'criar_mundo', { mundoId }, `criar_mundo-${mundoId}`);

      const criada = exigirMundo(await carregarSessao(ctx, req.usuarioId), { pronto: false });
      return reply.code(201).send(await mundoDto(ctx.db, criada));
    },
  );

  app.get('/v1/mundos/atual', { schema: { response: { 200: Mundo } } }, async (req) => {
    const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId), { pronto: false });
    return mundoDto(ctx.db, sessao);
  });

  // Recomeçar: apaga o mundo atual (tudo em cascata). Energia e gemas são da conta e ficam.
  app.delete('/v1/mundos/atual', async (req, reply) => {
    const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId), { pronto: false });
    await ctx.db.delete(tabelaMundo).where(eq(tabelaMundo.id, sessao.mundo.id));
    return reply.code(204).send();
  });

  app.get(
    '/v1/mundos/:id/feed',
    {
      schema: {
        params: z.object({ id: z.uuid() }),
        querystring: z.object({ cursor: z.string().optional() }),
        response: { 200: RespostaFeed },
      },
    },
    async (req) => {
      const sessao = exigirMundo(await carregarSessao(ctx, req.usuarioId));
      if (req.params.id !== sessao.mundo.id) throw naoEncontrado('Mundo não encontrado.');
      const cursor = decodificarCursor(req.query.cursor);
      const visiveis = and(
        eq(post.mundoId, sessao.mundo.id),
        eq(post.oculto, false),
        lte(post.entregarEm, sessao.agora),
      );

      const linhas = await ctx.db
        .select()
        .from(post)
        .where(
          and(
            visiveis,
            eq(post.tipo, 'post'),
            isNull(post.respondeA),
            cursor
              ? or(
                  lt(post.entregarEm, cursor.data),
                  and(eq(post.entregarEm, cursor.data), lt(post.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(post.entregarEm), desc(post.id))
        .limit(TAMANHO_PAGINA + 1);
      const pagina = linhas.slice(0, TAMANHO_PAGINA);
      const ultimo = pagina.at(-1);

      // Histórias ativas: a mais recente de cada autor, marcando se o jogador já viu.
      const historias = cursor
        ? []
        : await ctx.db
            .select({ post, vista: historiaVista.postId, autor: personagem })
            .from(post)
            .innerJoin(personagem, eq(personagem.id, post.autorId))
            .leftJoin(
              historiaVista,
              and(
                eq(historiaVista.postId, post.id),
                eq(historiaVista.personagemId, sessao.jogador.id),
              ),
            )
            .where(and(visiveis, eq(post.tipo, 'historia'), gt(post.expiraEm, sessao.agora)))
            .orderBy(desc(post.entregarEm));
      const porAutor = new Map<string, (typeof historias)[number]>();
      for (const h of historias) if (!porAutor.has(h.autor.id)) porAutor.set(h.autor.id, h);

      return {
        itens: await postsDto(ctx.db, pagina, sessao.jogador.id),
        proximoCursor:
          linhas.length > TAMANHO_PAGINA && ultimo
            ? codificarCursor(ultimo.entregarEm, ultimo.id)
            : null,
        historias: [...porAutor.values()].map((h) => ({
          id: h.post.id,
          autor: personagemResumoDto(h.autor),
          vista: h.vista !== null,
        })),
      };
    },
  );
}
