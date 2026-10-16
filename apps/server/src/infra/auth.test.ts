import { describe, expect, it } from 'vitest';
import { emitirToken, tokenDoCabecalho, verificarToken } from './auth';

const segredo = 'x'.repeat(40);

describe('auth', () => {
  it('emite e verifica o token do usuário', async () => {
    const token = await emitirToken('usuario-1', segredo);
    await expect(verificarToken(token, segredo)).resolves.toBe('usuario-1');
  });

  it('recusa token de outro segredo e cabeçalho sem Bearer', async () => {
    const token = await emitirToken('usuario-1', segredo);
    await expect(verificarToken(token, 'y'.repeat(40))).rejects.toMatchObject({
      codigo: 'nao_autenticado',
    });
    expect(() => tokenDoCabecalho('Basic abc')).toThrow();
    expect(tokenDoCabecalho('Bearer abc')).toBe('abc');
  });
});
