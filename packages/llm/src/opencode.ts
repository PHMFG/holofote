// Provedor real: OpenCode Go pelo endpoint compatível com OpenAI, via AI SDK 7.
// Cabeçalhos obrigatórios: User-Agent próprio (exato, sem o sufixo do SDK) e x-opencode-session.
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  APICallError,
  NoObjectGeneratedError,
  Output,
  RetryError,
  generateText,
  type LanguageModelUsage,
} from 'ai';
import { z } from 'zod';
import type { ConfigLlm } from './config';
import {
  CODIGO_CURTO,
  ErroLimite,
  ErroProvedor,
  type PedidoGeracao,
  type Provedor,
  type RespostaBruta,
  rotuloDeFalha,
  type UsoTokens,
} from './provedor';

type Fetch = typeof globalThis.fetch;

export interface OpcoesOpenCode {
  /** Para testes: substitui o fetch global. */
  fetch?: Fetch;
  /** Tempo máximo de uma chamada (padrão 90 s). */
  timeoutMs?: number;
}

/**
 * O AI SDK acrescenta "ai/<versão> ai-sdk-provider-utils/<versão> node.js/<versão>" ao User-Agent
 * e o cabeçalho das opções de chamada sobrescreve o da configuração. Este fetch troca o
 * User-Agent pelo nosso, exato, logo antes de sair.
 */
export function fetchComUserAgent(userAgent: string, base: Fetch = globalThis.fetch): Fetch {
  return (entrada, init) => {
    const headers = new Headers(init?.headers);
    headers.set('user-agent', userAgent);
    return base(entrada, { ...init, headers });
  };
}

/**
 * Remove a chave (e qualquer "Bearer ...") de um texto que vai para log ou erro. Cobre também a
 * chave partida em pedaços (espaço, quebra de linha, aspas ou "+" no meio, como num JSON ou numa
 * concatenação que o servidor ecoe) e a chave codificada para URL.
 */
export function ocultarChave(texto: string, chave: string | null): string {
  let limpo = texto.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [segredo]');
  if (!chave) return limpo;
  limpo = limpo.split(chave).join('[segredo]');
  const codificada = encodeURIComponent(chave);
  if (codificada !== chave) limpo = limpo.split(codificada).join('[segredo]');
  if (chave.length >= 8) {
    // Letras da chave em ordem, com no máximo 6 caracteres de separação entre elas.
    const sep = '[\\s"\'+\\\\]{0,6}';
    const padrao = [...chave].map((c) => c.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')).join(sep);
    limpo = limpo.replace(new RegExp(padrao, 'g'), '[segredo]');
  }
  return limpo;
}

const LIMITE =
  /rate.?limit|usage.?limit|quota|limite|too many requests|insufficient.?(balance|quota|credit)|plan limit|monthly limit|weekly limit|exceeded your|subscription/i;

function lerUso(usage: LanguageModelUsage | undefined): UsoTokens {
  if (!usage) return { entrada: 0, cache: 0, saida: 0 };
  const entrada = usage.inputTokens ?? 0;
  // O openai-compatible lê prompt_tokens_details.cached_tokens; a API da DeepSeek usa
  // prompt_cache_hit_tokens, que só aparece no uso bruto.
  const bruto = usage.raw as { prompt_cache_hit_tokens?: unknown } | undefined;
  const hitDeepSeek =
    typeof bruto?.prompt_cache_hit_tokens === 'number' ? bruto.prompt_cache_hit_tokens : 0;
  const cache = Math.max(usage.inputTokenDetails.cacheReadTokens ?? 0, hitDeepSeek);
  return { entrada, cache: Math.min(cache, entrada), saida: usage.outputTokens ?? 0 };
}

function mensagemDe(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  return String(erro);
}

/**
 * Código curto do erro no corpo da resposta ({ error: { code | type } }). Nunca devolve a
 * mensagem nem outro trecho do corpo, que pode ecoar texto do prompt.
 */
function codigoDoCorpo(corpo: string | undefined, chave: string | null): string | null {
  if (!corpo) return null;
  try {
    const json = JSON.parse(corpo) as { error?: unknown } | null;
    const erro = (json && typeof json === 'object' && 'error' in json ? json.error : json) as {
      code?: unknown;
      type?: unknown;
    } | null;
    for (const candidato of [erro?.code, erro?.type]) {
      if (typeof candidato !== 'string' && typeof candidato !== 'number') continue;
      const texto = String(candidato);
      if (CODIGO_CURTO.test(texto)) return ocultarChave(texto, chave);
    }
  } catch {
    // Corpo que não é JSON (HTML de proxy, texto): sem código.
  }
  return null;
}

/**
 * Converte qualquer erro do SDK num erro tipado. O texto do erro leva só o status e um código
 * curto: nem a chave, nem o corpo do pedido, nem trechos do corpo da resposta (que podem ecoar o
 * prompt do jogador). A classificação lê o corpo, mas ele não sai daqui.
 */
export function mapearErro(
  erro: unknown,
  modelo: string,
  chave: string | null,
): ErroLimite | ErroProvedor {
  const base = RetryError.isInstance(erro) ? erro.lastError : erro;
  if (APICallError.isInstance(base)) {
    const status = base.statusCode ?? null;
    const classificar = ocultarChave(`${base.message} ${base.responseBody ?? ''}`, chave);
    const detalhe = codigoDoCorpo(base.responseBody, chave) ?? 'sem_codigo';
    if (status === 429 || status === 402 || LIMITE.test(classificar)) {
      return new ErroLimite(modelo, status, detalhe);
    }
    return new ErroProvedor(modelo, status, detalhe);
  }
  const detalhe = rotuloDeFalha(base);
  if (LIMITE.test(ocultarChave(mensagemDe(base), chave))) {
    return new ErroLimite(modelo, null, detalhe);
  }
  return new ErroProvedor(modelo, null, detalhe);
}

/**
 * Modelos do Go que sempre raciocinam (não aceitam desligar): o GLM só aceita esforço baixo.
 * Conferido numa sonda ao Go em 16/10/2026: com o raciocínio ligado, o DeepSeek gastava o
 * max_tokens pensando e cortava o JSON no meio.
 */
const SEMPRE_RACIOCINA = /^glm-/i;

/** Folga de tokens para o raciocínio que não dá para desligar. */
export const FOLGA_RACIOCINIO = 512;

/**
 * Corpo extra do pedido por modelo. Os jobs do Holofote são curtos e em JSON: o raciocínio só
 * custa tokens, tempo e corta a resposta. DeepSeek e MiMo aceitam `thinking: disabled`.
 */
export function opcoesDeRaciocinio(modelo: string): {
  corpo: Record<string, string | { type: string }>;
  folga: number;
} {
  return SEMPRE_RACIOCINA.test(modelo)
    ? { corpo: { reasoningEffort: 'low' }, folga: FOLGA_RACIOCINIO }
    : { corpo: { thinking: { type: 'disabled' } }, folga: 0 };
}

export function criarProvedorOpenCode(config: ConfigLlm, opcoes: OpcoesOpenCode = {}): Provedor {
  if (!config.apiKey) {
    throw new Error('LLM_API_KEY ausente: o provedor opencode-go precisa da chave');
  }
  const chave = config.apiKey.revelar();
  const sdk = createOpenAICompatible({
    name: 'opencode-go',
    baseURL: config.baseUrl,
    apiKey: chave,
    fetch: fetchComUserAgent(config.userAgent, opcoes.fetch),
  });
  const timeout = opcoes.timeoutMs ?? 90_000;

  return {
    nome: 'opencode-go',
    async gerar(pedido: PedidoGeracao): Promise<RespostaBruta> {
      const inicio = performance.now();
      const latencia = () => Math.round(performance.now() - inicio);
      const raciocinio = opcoesDeRaciocinio(pedido.modelo);
      try {
        const resultado = await generateText({
          model: sdk.chatModel(pedido.modelo),
          instructions: pedido.sistema,
          messages: pedido.mensagens.map((m) =>
            m.papel === 'usuario'
              ? { role: 'user' as const, content: m.conteudo }
              : { role: 'assistant' as const, content: m.conteudo },
          ),
          maxOutputTokens: pedido.maxTokens + raciocinio.folga,
          // A chave das opções é o nome do provedor em camelCase ("opencode-go" está obsoleta).
          providerOptions: { opencodeGo: raciocinio.corpo },
          // Output.json() faz o openai-compatible mandar response_format: { type: 'json_object' }.
          output: Output.json(),
          headers: { 'x-opencode-session': pedido.sessao },
          // Sem retentativa no SDK: o roteador decide entre reserva e reagendar.
          maxRetries: 0,
          timeout,
        });
        return {
          texto: resultado.text,
          uso: lerUso(resultado.usage),
          modelo: resultado.response.modelId || pedido.modelo,
          latenciaMs: latencia(),
        };
      } catch (erro) {
        // JSON que não parseia não é falha do provedor: devolve o texto para o roteador reparar.
        if (NoObjectGeneratedError.isInstance(erro)) {
          return {
            texto: erro.text ?? '',
            uso: lerUso(erro.usage),
            modelo: erro.response?.modelId || pedido.modelo,
            latenciaMs: latencia(),
          };
        }
        throw mapearErro(erro, pedido.modelo, chave);
      }
    },
  };
}

const ListaModelos = z.object({ data: z.array(z.object({ id: z.string() })) });

export class ErroModelosAusentes extends Error {
  override readonly name = 'ErroModelosAusentes';

  constructor(
    readonly ausentes: string[],
    readonly disponiveis: string[],
  ) {
    super(
      `modelos configurados que não existem no provedor: ${ausentes.join(', ')}. ` +
        'Troque o id no .env e rode os evals.',
    );
  }
}

/**
 * Consulta LLM_MODELS_URL e falha alto se algum id configurado não existir.
 * O worker chama no boot (só com o provedor opencode-go).
 */
export async function verificarModelos(
  config: ConfigLlm,
  opcoes: { fetch?: Fetch } = {},
): Promise<{ disponiveis: string[] }> {
  const chave = config.apiKey?.revelar() ?? null;
  const headers: Record<string, string> = {
    'user-agent': config.userAgent,
    accept: 'application/json',
  };
  if (chave) headers.authorization = `Bearer ${chave}`;
  const buscar = opcoes.fetch ?? globalThis.fetch;
  let resposta: Response;
  try {
    resposta = await buscar(config.modelsUrl, { headers });
  } catch (erro) {
    throw new ErroProvedor('(lista de modelos)', null, rotuloDeFalha(erro));
  }
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    throw new ErroProvedor(
      '(lista de modelos)',
      resposta.status,
      codigoDoCorpo(corpo, chave) ?? 'sem_codigo',
    );
  }
  const lista = ListaModelos.safeParse(await resposta.json().catch(() => null));
  if (!lista.success) {
    throw new ErroProvedor(
      '(lista de modelos)',
      resposta.status,
      'resposta fora do formato { data: [{ id }] }',
    );
  }
  const disponiveis = lista.data.data.map((m) => m.id);
  const configurados = [...new Set(Object.values(config.modelos))];
  const ausentes = configurados.filter((id) => !disponiveis.includes(id));
  if (ausentes.length > 0) throw new ErroModelosAusentes(ausentes, disponiveis);
  return { disponiveis };
}
