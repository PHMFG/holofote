import { canalDoMundo } from '@holofote/shared';
import { z } from 'zod';
import type { Contexto } from '../contexto';
import { verificarToken } from '../infra/auth';
import { carregarSessao } from '../servicos/sessao';
import type { AppZod } from './tipos';

/**
 * WS /v1/tempo-real?token=: repassa o canal Redis do mundo do usuário (EventoTempoReal do
 * contrato). O token vem na query porque o WebSocket do React Native não manda cabeçalho; o
 * serializer de pedido do app.ts tira a query do log.
 */
export function rotasTempoReal(app: AppZod, ctx: Contexto) {
  app.get(
    '/v1/tempo-real',
    { websocket: true, schema: { querystring: z.object({ token: z.string().min(1) }) } },
    async (socket, req) => {
      let canal: string | null = null;
      let fechado = false;
      const assinante = { enviar: (mensagem: string) => socket.send(mensagem) };
      socket.on('close', () => {
        fechado = true;
        if (canal) void ctx.difusor.sair(canal, assinante);
      });
      try {
        const usuarioId = await verificarToken(req.query.token, ctx.config.JWT_SEGREDO);
        const sessao = await carregarSessao(ctx, usuarioId);
        // O app pode ter fechado o socket enquanto a sessão carregava: não assina nada.
        if (fechado || socket.readyState !== socket.OPEN) return;
        if (!sessao.mundo) {
          socket.close(4404, 'sem mundo');
          return;
        }
        canal = canalDoMundo(sessao.mundo.id);
        await ctx.difusor.entrar(canal, assinante);
        // Fechou durante a assinatura: o 'close' pode ter rodado antes de o assinante entrar.
        if (fechado) await ctx.difusor.sair(canal, assinante);
      } catch {
        canal = null;
        if (!fechado) socket.close(4401, 'sessao invalida');
      }
    },
  );
}
