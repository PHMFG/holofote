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
