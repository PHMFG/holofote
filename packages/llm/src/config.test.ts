import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { ErroConfigLlm, lerConfigLlm } from './config';

// Valor fictício, só para checar que nunca vaza. Não é chave de verdade.
const CHAVE_FICTICIA = 'chave-ficticia-de-teste-123';

describe('lerConfigLlm', () => {
  it('usa os padrões do plano com o ambiente vazio', () => {
    const config = lerConfigLlm({});
    expect(config).toMatchObject({
      provedor: 'falso',
      baseUrl: 'https://opencode.ai/inference/go/openai/v1',
      modelsUrl: 'https://opencode.ai/inference/go/v1/models',
      apiKey: null,
      userAgent: 'holofote-server/0.1',
      modelos: {
        diretor: 'deepseek-v4.1-flash',
        principal: 'deepseek-v4-pro',
        lote: 'mimo-v2.6-flash',
        reserva: 'glm-5.3-flash',
      },
      orcamentoDiarioUsd: 2,
    });
  });

  it('exige a chave só para o opencode-go', () => {
    expect(() => lerConfigLlm({ LLM_PROVIDER: 'opencode-go' })).toThrow(ErroConfigLlm);
    expect(() => lerConfigLlm({ LLM_PROVIDER: 'opencode-go' })).toThrow(/LLM_API_KEY/);
    const config = lerConfigLlm({ LLM_PROVIDER: 'opencode-go', LLM_API_KEY: CHAVE_FICTICIA });
    expect(config.apiKey?.revelar()).toBe(CHAVE_FICTICIA);
  });

  it('em produção, falha alto com o provedor falso (inclusive o padrão)', () => {
    expect(() => lerConfigLlm({ NODE_ENV: 'production' })).toThrow(ErroConfigLlm);
    expect(() => lerConfigLlm({ NODE_ENV: 'production', LLM_PROVIDER: 'falso' })).toThrow(
      /falso.*testes/,
    );
    const real = {
      NODE_ENV: 'production',
      LLM_PROVIDER: 'opencode-go',
      LLM_API_KEY: CHAVE_FICTICIA,
    };
    expect(lerConfigLlm(real).provedor).toBe('opencode-go');
    expect(() => lerConfigLlm({ ...real, LLM_API_KEY: '' })).toThrow(/LLM_API_KEY/);
    // Fora de produção o falso segue valendo.
    expect(lerConfigLlm({ NODE_ENV: 'development' }).provedor).toBe('falso');
    expect(lerConfigLlm({ NODE_ENV: 'test', LLM_PROVIDER: 'falso' }).provedor).toBe('falso');
  });

  it('trata variável vazia como ausente', () => {
    expect(() => lerConfigLlm({ LLM_PROVIDER: 'opencode-go', LLM_API_KEY: '  ' })).toThrow(
      /LLM_API_KEY/,
    );
    expect(lerConfigLlm({ LLM_DAILY_BUDGET_USD: '' }).orcamentoDiarioUsd).toBe(2);
  });

  it('converte o orçamento e recusa valores inválidos', () => {
    expect(lerConfigLlm({ LLM_DAILY_BUDGET_USD: '2.50' }).orcamentoDiarioUsd).toBe(2.5);
    expect(() => lerConfigLlm({ LLM_DAILY_BUDGET_USD: '-1' })).toThrow(/LLM_DAILY_BUDGET_USD/);
    expect(() => lerConfigLlm({ LLM_PROVIDER: 'openai' })).toThrow(/LLM_PROVIDER/);
    expect(() => lerConfigLlm({ LLM_BASE_URL: 'ftp://x' })).toThrow(/LLM_BASE_URL/);
  });

  it('recusa o User-Agent do SDK', () => {
    expect(() => lerConfigLlm({ LLM_USER_AGENT: 'ai-sdk/7.0' })).toThrow(/User-Agent/);
  });

  it('nunca mostra a chave ao serializar, inspecionar ou num erro', () => {
    const config = lerConfigLlm({ LLM_PROVIDER: 'opencode-go', LLM_API_KEY: CHAVE_FICTICIA });
    expect(JSON.stringify(config)).not.toContain(CHAVE_FICTICIA);
    expect(inspect(config, { depth: 10 })).not.toContain(CHAVE_FICTICIA);
    expect(String(config.apiKey)).toBe('[segredo]');
    try {
      lerConfigLlm({ LLM_API_KEY: CHAVE_FICTICIA, LLM_DAILY_BUDGET_USD: 'abc' });
      expect.unreachable();
    } catch (erro) {
      expect(String(erro)).not.toContain(CHAVE_FICTICIA);
    }
  });
});
