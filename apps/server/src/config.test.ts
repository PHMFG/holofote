import { describe, expect, it } from 'vitest';
import { lerConfig } from './config';

describe('lerConfig', () => {
  it('usa os padrões locais quando nada é definido', () => {
    const config = lerConfig({});
    expect(config.PORT).toBe(3333);
    expect(config.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('escuta só em 127.0.0.1 por padrão', () => {
    expect(lerConfig({}).HOST).toBe('127.0.0.1');
  });

  it('atualizações por ar: pasta padrão e URL pública opcional', () => {
    const padrao = lerConfig({});
    expect(padrao.ATUALIZACOES_DIR).toBe('./atualizacoes');
    expect(padrao.URL_PUBLICA).toBeUndefined();
    expect(lerConfig({ URL_PUBLICA: '' }).URL_PUBLICA).toBeUndefined();
    expect(lerConfig({ URL_PUBLICA: 'https://host.ts.net' }).URL_PUBLICA).toBe(
      'https://host.ts.net',
    );
    expect(() => lerConfig({ URL_PUBLICA: 'nao-e-url' })).toThrow();
  });

  it('falha alto com URL inválida', () => {
    expect(() => lerConfig({ DATABASE_URL: 'nao-e-url' })).toThrow();
  });

  it('recusa URL com o protocolo trocado', () => {
    expect(() => lerConfig({ DATABASE_URL: 'redis://localhost:6379' })).toThrow();
    expect(() => lerConfig({ REDIS_URL: 'postgres://localhost:5432/holofote' })).toThrow();
  });
});
