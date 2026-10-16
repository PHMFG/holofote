import websocket from '@fastify/websocket';
import { VERSAO_API } from '@holofote/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Contexto } from './contexto';
import { tokenDoCabecalho, verificarToken } from './infra/auth';
import { erroParaLog } from './infra/banco';
import { ErroApi } from './infra/erros';
import { rotasConta } from './rotas/conta';
import { rotasDev } from './rotas/dev';
import { rotasEventos } from './rotas/eventos';
import { rotasJornada } from './rotas/jornada';
import { rotasMensagens } from './rotas/mensagens';
import { rotasMundos } from './rotas/mundos';
import { rotasPessoas } from './rotas/pessoas';
import { rotasPosts } from './rotas/posts';
import { rotasRegistro } from './rotas/registro';
import { rotasTempoReal } from './rotas/tempo-real';

declare module 'fastify' {
  interface FastifyRequest {
    /** Preenchido pelo hook de autenticação em toda rota protegida. */
    usuarioId: string;
  }
}

/** Cada checador resolve se a dependência responde e rejeita se não. */
export interface Checadores {
  postgres: () => Promise<unknown>;
  redis: () => Promise<unknown>;
}

const estado = z.enum(['ok', 'erro']);
const respostaSaude = z.object({ ok: z.boolean(), postgres: estado, redis: estado });

/** Rotas sem token: login, saúde e o WebSocket (que lê o token da query). */
const PUBLICAS = new Set([
  `/${VERSAO_API}/auth/anonimo`,
  `/${VERSAO_API}/saude`,
  `/${VERSAO_API}/tempo-real`,
]);

export interface OpcoesApp {
  fastify?: FastifyServerOptions;
  /** Tempo máximo de cada checador antes de contar como erro. */
  limiteChecagemMs?: number;
  /** Sem contexto, só a rota de saúde existe (testes da saúde). */
  ctx?: Contexto;
}

/** Caminho sem a query string: o WebSocket leva o token em `?token=` e ele não pode ir ao log. */
export const semQuery = (url: string) => url.split('?')[0] ?? url;

interface PedidoNoLog {
  method: string;
  url: string;
  host?: string;
  ip?: string;
}

/** Serializer do pedido no log do Fastify, sem a query string. */
export function serializarPedido(req: PedidoNoLog) {
  return { method: req.method, url: semQuery(req.url), host: req.host, remoteAddress: req.ip };
}

export function construirApp(
  checadores: Checadores,
  { fastify = {}, limiteChecagemMs = 2000, ctx }: OpcoesApp = {},
) {
  const logger =
    fastify.logger && typeof fastify.logger === 'object'
      ? {
          ...fastify.logger,
          serializers: { ...fastify.logger.serializers, req: serializarPedido },
        }
      : fastify.logger;
  const app = Fastify({ ...fastify, logger }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorateRequest('usuarioId', '');
  if (ctx) ctx.log ??= app.log;

  // Erros no formato do contrato: { erro, mensagem } com código estável.
  app.setErrorHandler((erro, req, reply) => {
    if (erro instanceof ErroApi) {
      return reply.code(erro.status).send({ erro: erro.codigo, mensagem: erro.message });
    }
    if (hasZodFastifySchemaValidationErrors(erro)) {
      return reply
        .code(400)
        .send({ erro: 'invalido', mensagem: 'Pedido fora do formato esperado.' });
    }
    // Erros do próprio Fastify com status 4xx: JSON malformado, tipo de conteúdo errado (415),
    // corpo grande demais (413). O pedido é que está errado, não o servidor.
    const status = (erro as { statusCode?: unknown }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply
        .code(status)
        .send({ erro: 'invalido', mensagem: 'Pedido fora do formato esperado.' });
    }
    if (isResponseSerializationError(erro)) {
      req.log.error({ erro, rota: semQuery(req.url) }, 'resposta fora do contrato');
    } else {
      req.log.error({ ...erroParaLog(erro), rota: semQuery(req.url) }, 'erro inesperado');
    }
    return reply.code(500).send({ erro: 'interno', mensagem: 'Algo deu errado. Tente de novo.' });
  });

  app.addHook('onRequest', async (req) => {
    const caminho = semQuery(req.url);
    if (PUBLICAS.has(caminho) || !ctx) return;
    req.usuarioId = await verificarToken(
      tokenDoCabecalho(req.headers.authorization),
      ctx.config.JWT_SEGREDO,
    );
  });

  app.get(
    `/${VERSAO_API}/saude`,
    { schema: { response: { 200: respostaSaude, 503: respostaSaude } } },
    async (_req, reply) => {
      const [postgres, redis] = await Promise.all([
        checar(checadores.postgres, limiteChecagemMs),
        checar(checadores.redis, limiteChecagemMs),
      ]);
      const ok = postgres === 'ok' && redis === 'ok';
      return reply.code(ok ? 200 : 503).send({ ok, postgres, redis });
    },
  );

  if (ctx) {
    void app.register(websocket);
    void app.register(async (escopo) => {
      const api = escopo.withTypeProvider<ZodTypeProvider>();
      rotasConta(api, ctx);
      rotasMundos(api, ctx);
      rotasPosts(api, ctx);
      rotasMensagens(api, ctx);
      rotasPessoas(api, ctx);
      rotasJornada(api, ctx);
      rotasEventos(api, ctx);
      rotasRegistro(api, ctx);
      rotasTempoReal(api, ctx);
      if (ctx.config.AMBIENTE !== 'producao') rotasDev(api, ctx);
    });
  }

  return app;
}

// Sem limite, um Redis ou Postgres travado deixaria a rota pendurada e
// seguraria o app.close() no encerramento.
async function checar(
  checador: () => Promise<unknown>,
  limiteMs: number,
): Promise<z.infer<typeof estado>> {
  let relogio: NodeJS.Timeout | undefined;
  const estourou = new Promise<never>((_, rejeitar) => {
    relogio = setTimeout(() => rejeitar(new Error('tempo esgotado')), limiteMs);
  });
  try {
    await Promise.race([checador(), estourou]);
    return 'ok';
  } catch {
    return 'erro';
  } finally {
    clearTimeout(relogio);
  }
}
