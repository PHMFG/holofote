import { describe, expect, it } from 'vitest';
import { lerConfig } from './config';

describe('lerConfig', () => {
  it('usa o Redis local quando nada é definido', () => {
    expect(lerConfig({}).REDIS_URL).toBe('redis://localhost:6379');
  });

  it('falha alto com nível de log desconhecido', () => {
    expect(() => lerConfig({ LOG_LEVEL: 'barulhento' })).toThrow();
  });
});
