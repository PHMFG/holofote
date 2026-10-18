// Configuração do adaptador de IA, lida das variáveis de ambiente e validada com Zod.
// A chave fica guardada num `Segredo`: não aparece em JSON.stringify, console.log nem pino.
import { inspect } from 'node:util';
import { z } from 'zod';

/** Papéis de modelo do plano (seção "Papéis e modelos"). */
export const PAPEIS_MODELO = ['diretor', 'principal', 'lote', 'reserva'] as const;
export type PapelModelo = (typeof PAPEIS_MODELO)[number];

export const PROVEDORES = ['falso', 'opencode-go'] as const;
export type NomeProvedor = (typeof PROVEDORES)[number];

const MASCARA = '[segredo]';

/** Guarda um valor sensível. Só `revelar()` devolve o valor; qualquer serialização mostra a máscara. */
export class Segredo {
  readonly #valor: string;

  constructor(valor: string) {
    this.#valor = valor;
  }

  revelar(): string {
    return this.#valor;
  }

  toString(): string {
    return MASCARA;
  }

  toJSON(): string {
    return MASCARA;
  }

  [inspect.custom](): string {
    return MASCARA;
  }
}

const url = z.url({ protocol: /^https?$/ });
const idModelo = z.string().trim().min(1);

const esquema = z
  .object({
    LLM_PROVIDER: z.enum(PROVEDORES).default('falso'),
    LLM_BASE_URL: url.default('https://opencode.ai/inference/go/openai/v1'),
    LLM_MODELS_URL: url.default('https://opencode.ai/inference/go/v1/models'),
    LLM_API_KEY: z.string().trim().min(1).optional(),
    LLM_USER_AGENT: z.string().trim().min(1).default('holofote-server/0.1'),
    LLM_MODEL_DIRETOR: idModelo.default('deepseek-v4.1-flash'),
    LLM_MODEL_PRINCIPAL: idModelo.default('deepseek-v4.1-flash'),
    LLM_MODEL_LOTE: idModelo.default('deepseek-v4.1-flash'),
    LLM_MODEL_RESERVA: idModelo.default('glm-5.3-flash'),
    LLM_DAILY_BUDGET_USD: z.coerce.number().positive().default(2),
  })
  .superRefine((v, ctx) => {
    if (v.LLM_PROVIDER === 'opencode-go' && !v.LLM_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['LLM_API_KEY'],
        message: 'obrigatória quando LLM_PROVIDER=opencode-go',
      });
    }
    if (/^ai[-/]|ai-sdk/i.test(v.LLM_USER_AGENT)) {
      ctx.addIssue({
        code: 'custom',
        path: ['LLM_USER_AGENT'],
        message: 'use um User-Agent próprio (ex.: holofote-server/0.1), nunca o do SDK',
      });
    }
  });

export interface ConfigLlm {
  provedor: NomeProvedor;
  baseUrl: string;
  modelsUrl: string;
  /** Null no provedor falso. Use `apiKey.revelar()` só na hora de montar o cliente. */
  apiKey: Segredo | null;
  userAgent: string;
  modelos: Record<PapelModelo, string>;
  orcamentoDiarioUsd: number;
}

/** Erro de configuração. A mensagem lista só nomes de variáveis, nunca valores. */
export class ErroConfigLlm extends Error {
  override readonly name = 'ErroConfigLlm';
}

/**
 * Lê e valida as variáveis LLM_*. Variáveis vazias (`LLM_API_KEY=`) contam como ausentes.
 * Com NODE_ENV=production o provedor falso é recusado.
 * Falha alto com ErroConfigLlm se algo estiver errado.
 */
export function lerConfigLlm(env: NodeJS.ProcessEnv = process.env): ConfigLlm {
  const limpo: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(env)) {
    if (chave.startsWith('LLM_') && valor !== undefined && valor.trim() !== '') {
      limpo[chave] = valor;
    }
  }
  const resultado = esquema.safeParse(limpo);
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('; ');
    throw new ErroConfigLlm(`configuração de IA inválida: ${problemas}`);
  }
  const v = resultado.data;
  // O provedor falso é dublê de teste: em produção ele passaria por IA e esconderia a falta da
  // chave. Vale também para LLM_PROVIDER ausente, que cai no falso.
  if (env.NODE_ENV === 'production' && v.LLM_PROVIDER === 'falso') {
    throw new ErroConfigLlm(
      'configuração de IA inválida: LLM_PROVIDER: o provedor falso é só para testes e ' +
        'desenvolvimento; com NODE_ENV=production use LLM_PROVIDER=opencode-go',
    );
  }
  return {
    provedor: v.LLM_PROVIDER,
    baseUrl: v.LLM_BASE_URL,
    modelsUrl: v.LLM_MODELS_URL,
    apiKey: v.LLM_API_KEY ? new Segredo(v.LLM_API_KEY) : null,
    userAgent: v.LLM_USER_AGENT,
    modelos: {
      diretor: v.LLM_MODEL_DIRETOR,
      principal: v.LLM_MODEL_PRINCIPAL,
      lote: v.LLM_MODEL_LOTE,
      reserva: v.LLM_MODEL_RESERVA,
    },
    orcamentoDiarioUsd: v.LLM_DAILY_BUDGET_USD,
  };
}
