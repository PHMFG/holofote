import { describe, expect, it } from 'vitest';
import { construirApp } from './app';

const ok = () => Promise.resolve();
const falha = () => Promise.reject(new Error('fora do ar'));
const travado = () => new Promise(() => {});

describe('GET /v1/saude', () => {
  it('responde 200 quando Postgres e Redis respondem', async () => {
    const app = construirApp({ postgres: ok, redis: ok });
    const resposta = await app.inject({ method: 'GET', url: '/v1/saude' });
    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ ok: true, postgres: 'ok', redis: 'ok' });
  });

  it('responde 503 e aponta a dependência que caiu', async () => {
    const app = construirApp({ postgres: falha, redis: ok });
    const resposta = await app.inject({ method: 'GET', url: '/v1/saude' });
    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual({ ok: false, postgres: 'erro', redis: 'ok' });
  });

  it('responde 503 quando uma dependência não responde dentro do limite', async () => {
    const app = construirApp({ postgres: ok, redis: travado }, { limiteChecagemMs: 20 });
    const resposta = await app.inject({ method: 'GET', url: '/v1/saude' });
    expect(resposta.statusCode).toBe(503);
    expect(resposta.json()).toEqual({ ok: false, postgres: 'ok', redis: 'erro' });
  });
});

describe('log', () => {
  it('o pedido vai para o log sem a query string (token do WebSocket)', async () => {
    const linhas: string[] = [];
    const app = construirApp(
      { postgres: ok, redis: ok },
      { fastify: { logger: { level: 'info', stream: { write: (l: string) => linhas.push(l) } } } },
    );
    await app.inject({ method: 'GET', url: '/v1/saude?token=segredo-do-jogador' });
    expect(linhas.some((l) => l.includes('"url":"/v1/saude"'))).toBe(true);
    expect(linhas.join('\n')).not.toContain('segredo-do-jogador');
  });
});
