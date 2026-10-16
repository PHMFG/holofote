// Contrato de um provedor de modelo e os erros tipados que o worker trata.
// Nenhum erro daqui carrega a chave, o corpo do pedido nem o texto do jogador. Também não carregam
// trechos do corpo da resposta HTTP nem do texto gerado pelo modelo: só status, código curto e o
// caminho do campo que falhou. Quem constrói um erro passa só isso em `detalhe`.

export interface MensagemChat {
  papel: 'usuario' | 'assistente';
  conteudo: string;
}

export interface PedidoGeracao {
  /** Id do modelo no provedor (ex.: deepseek-v4.1-flash). */
  modelo: string;
  /** Prefixo fixo do mundo (regras de estilo + bíblia), idêntico byte a byte entre chamadas. */
  sistema: string;
  /** Parte variável: a primeira mensagem de usuário começa com `JOB: <nome>`. */
  mensagens: MensagemChat[];
  maxTokens: number;
  /** Id do mundo, enviado em `x-opencode-session` para cache e roteamento. */
  sessao: string;
  /** Sempre JSON: o adaptador pede `response_format: json_object`. */
  json: true;
}

export interface UsoTokens {
  /** Total de tokens de entrada, incluindo os lidos do cache. */
  entrada: number;
  /** Parte de `entrada` que veio do cache de prompt. */
  cache: number;
  saida: number;
}

export interface RespostaBruta {
  texto: string;
  uso: UsoTokens;
  /** Modelo que respondeu, como o provedor informou. */
  modelo: string;
  latenciaMs: number;
}

export interface Provedor {
  readonly nome: string;
  gerar(pedido: PedidoGeracao): Promise<RespostaBruta>;
}

export type CodigoErroLlm = 'limite' | 'provedor' | 'orcamento' | 'json_invalido';

/** Base dos erros do adaptador. `atrasoSugeridoMs` é uma dica para o worker reagendar o job. */
export abstract class ErroLlm extends Error {
  abstract readonly codigo: CodigoErroLlm;
  abstract readonly atrasoSugeridoMs: number;
}

/** 429 ou limite do plano (janela de 5 h, semana ou mês do Go). */
export class ErroLimite extends ErroLlm {
  override readonly name = 'ErroLimite';
  readonly codigo = 'limite';
  readonly atrasoSugeridoMs = 15 * 60_000;

  constructor(
    readonly modelo: string,
    readonly status: number | null,
    detalhe: string,
  ) {
    super(`limite do provedor no modelo ${modelo}${status ? ` (HTTP ${status})` : ''}: ${detalhe}`);
  }
}

/** Qualquer outra falha do provedor: rede, 5xx, 4xx, timeout, resposta vazia. */
export class ErroProvedor extends ErroLlm {
  override readonly name = 'ErroProvedor';
  readonly codigo = 'provedor';
  readonly atrasoSugeridoMs = 2 * 60_000;

  constructor(
    readonly modelo: string,
    readonly status: number | null,
    detalhe: string,
  ) {
    super(`falha do provedor no modelo ${modelo}${status ? ` (HTTP ${status})` : ''}: ${detalhe}`);
  }
}

/** O gasto do dia chegou ao teto LLM_DAILY_BUDGET_USD. Volta a valer na virada do dia (UTC). */
export class ErroOrcamento extends ErroLlm {
  override readonly name = 'ErroOrcamento';
  readonly codigo = 'orcamento';
  readonly atrasoSugeridoMs: number;

  constructor(
    readonly gastoUsd: number,
    readonly tetoUsd: number,
    agora: Date = new Date(),
  ) {
    super(`teto diário de IA atingido: US$ ${gastoUsd.toFixed(4)} de US$ ${tetoUsd.toFixed(2)}`);
    const virada = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate() + 1);
    this.atrasoSugeridoMs = Math.max(60_000, virada - agora.getTime());
  }
}

/**
 * A resposta não passou na validação nem depois da tentativa de reparo (nem na reserva).
 * `falhas` traz só "caminho: código" ("reacoes.0.texto: emoji"), nunca o texto gerado.
 */
export class ErroJsonInvalido extends ErroLlm {
  override readonly name = 'ErroJsonInvalido';
  readonly codigo = 'json_invalido';
  readonly atrasoSugeridoMs = 60_000;

  constructor(
    readonly job: string,
    readonly modelo: string,
    readonly falhas: string[],
  ) {
    super(`resposta inválida do modelo ${modelo} no job ${job}: ${falhas.slice(0, 5).join('; ')}`);
  }
}

/** Código curto de máquina ("rate_limit_exceeded", "ECONNRESET"): nada que pareça frase. */
export const CODIGO_CURTO = /^[A-Za-z0-9_.-]{1,40}$/;

/** Nome do erro e código do cause (ECONNRESET...), ou "timeout" quando a chamada estourou o prazo. */
export function rotuloDeFalha(erro: unknown): string {
  const nome = erro instanceof Error ? erro.name : typeof erro;
  if (nome === 'AbortError' || nome === 'TimeoutError') return 'timeout';
  const causa =
    erro instanceof Error
      ? (erro.cause as { code?: unknown; name?: unknown } | null | undefined)
      : null;
  if (causa?.name === 'AbortError' || causa?.name === 'TimeoutError') return 'timeout';
  const codigo = typeof causa?.code === 'string' && CODIGO_CURTO.test(causa.code) ? causa.code : '';
  const base = CODIGO_CURTO.test(nome) ? nome : 'erro';
  return codigo ? `${base}/${codigo}` : base;
}

export function ehErroLlm(erro: unknown): erro is ErroLlm {
  return erro instanceof ErroLlm;
}
