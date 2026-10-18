// Testes do provedor real sem rede: um fetch falso captura o pedido e devolve respostas prontas.
import { describe, expect, it } from 'vitest';
import { lerConfigLlm } from './config';
import { criarProvedor } from './index';
import { EXEMPLOS } from '../evals/exemplos';
import { BIBLIA_POP_BRASIL, MUNDO_ID } from '../evals/pop-brasil';
import {
  ErroModelosAusentes,
  FOLGA_RACIOCINIO,
  criarProvedorOpenCode,
  mapearErro,
  ocultarChave,
  verificarModelos,
} from './opencode';
import { ErroLimite, ErroProvedor, type PedidoGeracao } from './provedor';
import { chamarJob, type ChamadaLlm } from './roteador';

// Valor fictício, só para checar que nunca vaza. Não é chave de verdade.
const CHAVE_FICTICIA = 'chave-ficticia-de-teste-xyz';

const config = lerConfigLlm({
  LLM_PROVIDER: 'opencode-go',
  LLM_API_KEY: CHAVE_FICTICIA,
  LLM_USER_AGENT: 'holofote-server/0.1',
});

const pedido: PedidoGeracao = {
  modelo: 'deepseek-v4.1-flash',
  sistema: 'regras fixas, responda em JSON',
  mensagens: [{ papel: 'usuario', conteudo: 'JOB: diretor\n\nTAREFA\n...' }],
  maxTokens: 500,
  sessao: 'mundo-123',
  json: true,
};

interface Capturado {
  url: string;
  headers: Headers;
  corpo: Record<string, unknown>;
}

function resposta(conteudo: string, usage: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      id: 'r1',
      object: 'chat.completion',
      created: 1,
      model: 'deepseek-v4.1-flash',
      choices: [
        { index: 0, message: { role: 'assistant', content: conteudo }, finish_reason: 'stop' },
      ],
      usage: { prompt_tokens: 2000, completion_tokens: 300, total_tokens: 2300, ...usage },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function erroHttp(status: number, mensagem: string, code?: string) {
  return new Response(JSON.stringify({ error: { message: mensagem, code } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fetchFalso(responder: () => Response | Promise<Response>) {
  const capturados: Capturado[] = [];
  const fetch: typeof globalThis.fetch = async (entrada, init) => {
    capturados.push({
      url: String(entrada),
      headers: new Headers(init?.headers),
      corpo: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
    });
    return responder();
  };
  return { fetch, capturados };
}

describe('criarProvedorOpenCode', () => {
  it('manda User-Agent próprio exato, x-opencode-session e pede JSON', async () => {
    const { fetch, capturados } = fetchFalso(() => resposta('{"ok":true}'));
    const provedor = criarProvedorOpenCode(config, { fetch });
    const r = await provedor.gerar(pedido);

    expect(r.texto).toBe('{"ok":true}');
    const enviado = capturados[0];
    expect(enviado?.url).toBe('https://opencode.ai/inference/go/openai/v1/chat/completions');
    expect(enviado?.headers.get('user-agent')).toBe('holofote-server/0.1');
    expect(enviado?.headers.get('x-opencode-session')).toBe('mundo-123');
    expect(enviado?.headers.get('authorization')).toBe(`Bearer ${CHAVE_FICTICIA}`);
    expect(enviado?.corpo).toMatchObject({
      model: 'deepseek-v4.1-flash',
      max_tokens: 500,
      response_format: { type: 'json_object' },
      // Sem raciocínio: ele gastava o max_tokens e cortava o JSON.
      thinking: { type: 'disabled' },
      messages: [
        { role: 'system', content: 'regras fixas, responda em JSON' },
        { role: 'user', content: 'JOB: diretor\n\nTAREFA\n...' },
      ],
    });
  });

  it('no GLM, que sempre raciocina, pede esforço baixo e dá folga de tokens', async () => {
    const { fetch, capturados } = fetchFalso(() => resposta('{"ok":true}'));
    await criarProvedorOpenCode(config, { fetch }).gerar({ ...pedido, modelo: 'glm-5.3-flash' });
    const corpo = capturados[0]?.corpo;
    expect(corpo).toMatchObject({ reasoning_effort: 'low', max_tokens: 500 + FOLGA_RACIOCINIO });
    expect(corpo).not.toHaveProperty('thinking');
  });

  it('lê tokens de cache do formato OpenAI e do formato DeepSeek', async () => {
    const openai = fetchFalso(() =>
      resposta('{}', { prompt_tokens_details: { cached_tokens: 1500 } }),
    );
    const r1 = await criarProvedorOpenCode(config, { fetch: openai.fetch }).gerar(pedido);
    expect(r1.uso).toEqual({ entrada: 2000, cache: 1500, saida: 300 });

    const deepseek = fetchFalso(() => resposta('{}', { prompt_cache_hit_tokens: 1408 }));
    const r2 = await criarProvedorOpenCode(config, { fetch: deepseek.fetch }).gerar(pedido);
    expect(r2.uso).toEqual({ entrada: 2000, cache: 1408, saida: 300 });
  });

  it('devolve o texto quando o JSON vem quebrado, para o roteador reparar', async () => {
    const { fetch } = fetchFalso(() => resposta('{"reacoes": [ quebrado'));
    const r = await criarProvedorOpenCode(config, { fetch }).gerar(pedido);
    expect(r.texto).toBe('{"reacoes": [ quebrado');
    expect(r.uso.saida).toBe(300);
  });

  it.each([
    [429, 'Rate limit exceeded', ErroLimite],
    [402, 'payment required', ErroLimite],
    [403, 'You have reached your usage limit for this window', ErroLimite],
    [500, 'internal error', ErroProvedor],
    [400, 'bad request', ErroProvedor],
    // 5xx e 4xx com palavra de limite no corpo também valem como limite (a espera é maior).
    [503, 'quota exceeded for this plan', ErroLimite],
    [500, 'limite de uso do plano atingido', ErroLimite],
    [400, 'cota de requisições: limite atingido', ErroLimite],
    [403, 'Monthly limit reached', ErroLimite],
  ])('HTTP %i (%s) vira o erro tipado certo', async (status, mensagem, Tipo) => {
    const { fetch } = fetchFalso(() => erroHttp(status, mensagem));
    const erro = await criarProvedorOpenCode(config, { fetch })
      .gerar(pedido)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Tipo);
    expect((erro as ErroLimite | ErroProvedor).status).toBe(status);
  });

  it('timeout (AbortError) vira ErroProvedor com o rótulo timeout', async () => {
    const fetch: typeof globalThis.fetch = async () => {
      throw new DOMException('This operation was aborted', 'AbortError');
    };
    const erro = await criarProvedorOpenCode(config, { fetch })
      .gerar(pedido)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroProvedor);
    expect((erro as ErroProvedor).status).toBeNull();
    expect((erro as ErroProvedor).message).toMatch(/: timeout$/);
  });

  it('estouro real do prazo (timeoutMs) também vira ErroProvedor', async () => {
    const fetch: typeof globalThis.fetch = (_entrada, init) =>
      new Promise((_resolve, rejeitar) => {
        init?.signal?.addEventListener('abort', () => rejeitar(init.signal?.reason));
      });
    const erro = await criarProvedorOpenCode(config, { fetch, timeoutMs: 30 })
      .gerar(pedido)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroProvedor);
    expect(erro).not.toBeInstanceOf(ErroLimite);
    expect((erro as ErroProvedor).message).toMatch(/: timeout$/);
  });

  it('o erro leva só status e código curto, nunca trecho do corpo da resposta', async () => {
    const eco = 'o texto do jogador era: "odeio a Vic Ferraz" e o prompt dizia JOB: diretor';
    const { fetch } = fetchFalso(() => erroHttp(500, eco, 'upstream_error'));
    const erro = (await criarProvedorOpenCode(config, { fetch })
      .gerar(pedido)
      .catch((e: unknown) => e)) as ErroProvedor;
    expect(erro.message).toBe(
      'falha do provedor no modelo deepseek-v4.1-flash (HTTP 500): upstream_error',
    );

    const semCodigo = fetchFalso(
      () => new Response(`<html>${eco}</html>`, { status: 502, headers: {} }),
    );
    const erro2 = (await criarProvedorOpenCode(config, { fetch: semCodigo.fetch })
      .gerar(pedido)
      .catch((e: unknown) => e)) as ErroProvedor;
    expect(erro2.message).toBe(
      'falha do provedor no modelo deepseek-v4.1-flash (HTTP 502): sem_codigo',
    );
  });

  it('código do corpo que parece frase é descartado', async () => {
    const { fetch } = fetchFalso(() => erroHttp(500, 'x', 'o texto do jogador era secreto'));
    const erro = (await criarProvedorOpenCode(config, { fetch })
      .gerar(pedido)
      .catch((e: unknown) => e)) as ErroProvedor;
    expect(erro.message).not.toContain('secreto');
    expect(erro.message).toMatch(/: sem_codigo$/);
  });

  it('mapearErro de erro qualquer guarda só o nome e o código de rede', () => {
    const causa = Object.assign(new Error('connect ECONNRESET 10.0.0.1:443'), {
      code: 'ECONNRESET',
    });
    const erro = new TypeError('fetch failed para https://x/?texto=segredo', { cause: causa });
    const mapeado = mapearErro(erro, 'm', CHAVE_FICTICIA);
    expect(mapeado).toBeInstanceOf(ErroProvedor);
    expect(mapeado.message).toMatch(/: TypeError\/ECONNRESET$/);
    expect(mapeado.message).not.toContain('segredo');
    expect(mapearErro('texto solto com limite', 'm', null)).toBeInstanceOf(ErroLimite);
  });

  it('chamada_llm.erro e o erro final não carregam o prompt nem a resposta (pelo roteador)', async () => {
    const textoDoJogador = EXEMPLOS.diretor.acao.texto;
    // O servidor ecoa tudo o que recebeu no corpo do erro.
    const { fetch } = fetchFalso(() => erroHttp(500, `${textoDoJogador} ${BIBLIA_POP_BRASIL}`));
    const registradas: ChamadaLlm[] = [];
    const erro = (await chamarJob({
      job: 'diretor',
      mundoId: MUNDO_ID,
      biblia: BIBLIA_POP_BRASIL,
      entrada: EXEMPLOS.diretor,
      provedor: criarProvedorOpenCode(config, { fetch }),
      config,
      gastoHojeUsd: async () => 0,
      registrar: async (c) => {
        registradas.push(c);
      },
    }).catch((e: unknown) => e)) as Error;
    expect(erro).toBeInstanceOf(ErroProvedor);
    expect(registradas).toHaveLength(2);
    for (const texto of [erro.message, ...registradas.map((c) => c.erro ?? '')]) {
      expect(texto).not.toContain(textoDoJogador);
      expect(texto).not.toContain('Universo');
      expect(texto.length).toBeLessThan(160);
    }
    expect(registradas[0]?.erro).toMatch(/^provedor: .*\(HTTP 500\): sem_codigo$/);
  });

  it('falha de rede vira ErroProvedor', async () => {
    const fetch: typeof globalThis.fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(criarProvedorOpenCode(config, { fetch }).gerar(pedido)).rejects.toBeInstanceOf(
      ErroProvedor,
    );
  });

  it('nunca põe a chave no erro, mesmo se o servidor ecoar', async () => {
    // Nem o corpo nem o código (único trecho que sai do corpo) deixam a chave passar.
    const { fetch } = fetchFalso(() =>
      erroHttp(401, `invalid key ${CHAVE_FICTICIA} (Bearer ${CHAVE_FICTICIA})`, CHAVE_FICTICIA),
    );
    const erro = await criarProvedorOpenCode(config, { fetch })
      .gerar(pedido)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroProvedor);
    expect(String(erro)).not.toContain(CHAVE_FICTICIA);
    expect(JSON.stringify(erro)).not.toContain(CHAVE_FICTICIA);
    expect(String(erro)).toContain('[segredo]');
  });

  it('criarProvedor escolhe pelo LLM_PROVIDER', () => {
    expect(criarProvedor(config).nome).toBe('opencode-go');
    expect(criarProvedor(lerConfigLlm({})).nome).toBe('falso');
  });
});

describe('ocultarChave', () => {
  const chave = 'sk-abcdef0123456789XYZ';

  it('troca a chave inteira e qualquer Bearer', () => {
    expect(ocultarChave(`erro com ${chave} aqui`, chave)).toBe('erro com [segredo] aqui');
    expect(ocultarChave('Authorization: Bearer abc.def-123', null)).toBe(
      'Authorization: Bearer [segredo]',
    );
  });

  it('pega a chave em pedaços separados por espaço, quebra de linha, aspas ou +', () => {
    const pedacos = [
      `sk-abcdef0 123456789XYZ`,
      `sk-abcdef0\n123456789XYZ`,
      `"sk-abcdef0" + "123456789XYZ"`,
      `sk-ab cd ef 0123456789XYZ`,
      `sk-abcdef0\\\n123456789XYZ`,
    ];
    for (const texto of pedacos) {
      const limpo = ocultarChave(`falhou: ${texto} fim`, chave);
      expect(limpo).toContain('[segredo]');
      expect(limpo).not.toMatch(/0123|123456|XYZ|abcdef|ab cd/);
    }
  });

  it('pega a chave codificada para URL e não mexe em texto parecido', () => {
    const comSimbolo = 'sk-a/b+c=1234567890';
    expect(ocultarChave(`?k=${encodeURIComponent(comSimbolo)}`, comSimbolo)).toBe('?k=[segredo]');
    expect(ocultarChave('sk-abcdef0123456789 outra coisa', chave)).toBe(
      'sk-abcdef0123456789 outra coisa',
    );
  });

  it('chave curta não vira expressão frouxa demais', () => {
    expect(ocultarChave('a b c segredo', 'abc')).toBe('a b c segredo');
    expect(ocultarChave('xabcx', 'abc')).toBe('x[segredo]x');
  });
});

describe('verificarModelos', () => {
  const lista = (ids: string[]) => () =>
    new Response(
      JSON.stringify({ object: 'list', data: ids.map((id) => ({ id, object: 'model' })) }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );

  it('passa quando todos os ids configurados existem', async () => {
    const ids = Object.values(config.modelos);
    const { fetch, capturados } = fetchFalso(lista([...ids, 'outro-modelo']));
    await expect(verificarModelos(config, { fetch })).resolves.toEqual({
      disponiveis: [...ids, 'outro-modelo'],
    });
    expect(capturados[0]?.url).toBe('https://opencode.ai/inference/go/v1/models');
    expect(capturados[0]?.headers.get('user-agent')).toBe('holofote-server/0.1');
  });

  it('falha alto listando os ids que sumiram', async () => {
    const { fetch } = fetchFalso(lista(['deepseek-v4.1-flash', 'deepseek-v4-pro']));
    const erro = await verificarModelos(config, { fetch }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroModelosAusentes);
    expect((erro as ErroModelosAusentes).ausentes).toEqual(['glm-5.3-flash']);
  });

  it('erro HTTP vira ErroProvedor sem a chave', async () => {
    const { fetch } = fetchFalso(() => erroHttp(503, `fora do ar ${CHAVE_FICTICIA}`));
    const erro = await verificarModelos(config, { fetch }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroProvedor);
    expect(String(erro)).not.toContain(CHAVE_FICTICIA);
  });
});
