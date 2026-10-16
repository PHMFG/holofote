import Fastify, { type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { VERSAO_API } from '@holofote/shared';

/** Cada checador resolve se a dependência responde e rejeita se não. */
export interface Checadores {
  postgres: () => Promise<unknown>;
  redis: () => Promise<unknown>;
}

const estado = z.enum(['ok', 'erro']);

const respostaSaude = z.object({
  ok: z.boolean(),
  postgres: estado,
  redis: estado,
});

export interface OpcoesApp {
  fastify?: FastifyServerOptions;
  /** Tempo máximo de cada checador antes de contar como erro. */
  limiteChecagemMs?: number;
}

export function construirApp(
  checadores: Checadores,
  { fastify = {}, limiteChecagemMs = 2000 }: OpcoesApp = {},
) {
  const app = Fastify(fastify).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

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
