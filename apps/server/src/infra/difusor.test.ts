import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { Difusor } from './difusor';

class RedisFalso extends EventEmitter {
  subscribe = vi.fn(async () => 1);
  unsubscribe = vi.fn(async () => 0);
}

describe('Difusor', () => {
  it('assina o canal uma vez, repassa a todos e libera no último', async () => {
    const redis = new RedisFalso();
    const difusor = new Difusor(redis as never);
    const a = { enviar: vi.fn() };
    const b = { enviar: vi.fn() };
    await difusor.entrar('mundo:1', a);
    await difusor.entrar('mundo:1', b);
    expect(redis.subscribe).toHaveBeenCalledTimes(1);

    redis.emit('message', 'mundo:1', '{"tipo":"energia"}');
    expect(a.enviar).toHaveBeenCalledWith('{"tipo":"energia"}');
    expect(b.enviar).toHaveBeenCalledWith('{"tipo":"energia"}');

    redis.emit('message', 'mundo:2', 'outro');
    expect(a.enviar).toHaveBeenCalledTimes(1);

    await difusor.sair('mundo:1', a);
    expect(redis.unsubscribe).not.toHaveBeenCalled();
    await difusor.sair('mundo:1', b);
    expect(redis.unsubscribe).toHaveBeenCalledWith('mundo:1');
    expect(difusor.totalDeAssinantes('mundo:1')).toBe(0);
  });

  it('se a assinatura falha, não guarda o canal e o próximo socket tenta de novo', async () => {
    const redis = new RedisFalso();
    redis.subscribe.mockRejectedValueOnce(new Error('redis fora'));
    const difusor = new Difusor(redis as never);
    await expect(difusor.entrar('mundo:1', { enviar: vi.fn() })).rejects.toThrow('redis fora');
    expect(difusor.totalDeAssinantes('mundo:1')).toBe(0);
    await difusor.entrar('mundo:1', { enviar: vi.fn() });
    expect(redis.subscribe).toHaveBeenCalledTimes(2);
    expect(difusor.totalDeAssinantes('mundo:1')).toBe(1);
  });

  it('um socket que lança ao enviar não impede os outros', async () => {
    const redis = new RedisFalso();
    const difusor = new Difusor(redis as never);
    const quebrado = {
      enviar: vi.fn(() => {
        throw new Error('socket fechando');
      }),
    };
    const bom = { enviar: vi.fn() };
    await difusor.entrar('mundo:1', quebrado);
    await difusor.entrar('mundo:1', bom);
    redis.emit('message', 'mundo:1', 'oi');
    expect(bom.enviar).toHaveBeenCalledWith('oi');
  });
});
