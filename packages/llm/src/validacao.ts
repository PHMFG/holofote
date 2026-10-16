// Validação completa de uma resposta bruta: JSON, schema Zod, ids, idioma, emoji e checagens do job.
// O roteador usa para aceitar ou pedir reparo; os evals usam para medir.
import { z } from 'zod';
import { parecePortugues, temEmoji } from './idioma';
import type { NomeJob } from './jobs';
import { extrairJson } from './json';
import type { EntradasJobs } from './prompts/tipos';
import {
  schemaParaValidar,
  validarIdsDetalhado,
  type IdsPermitidos,
  type SaidasJobs,
} from './schemas';

/** Chaves cujo valor não é texto livre: entram na checagem de emoji, mas não na de idioma. */
const SEM_IDIOMA = new Set([
  'personagemId',
  'autorId',
  'sobreId',
  'respondeA',
  'alvo',
  'handle',
  'nome',
  'nomeMundo',
  'tipo',
  'tipoVinculo',
  'tomAvatar',
]);

export interface TextoGerado {
  caminho: string;
  texto: string;
  /** false para nomes, handles, ids e enums. */
  livre: boolean;
}

/** Todas as strings de uma resposta, com o caminho no JSON. */
export function coletarTextos(valor: unknown, caminho = '', chave = ''): TextoGerado[] {
  if (typeof valor === 'string') {
    return [{ caminho, texto: valor, livre: !SEM_IDIOMA.has(chave) }];
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((item, i) => coletarTextos(item, `${caminho}.${i}`, chave));
  }
  if (typeof valor === 'object' && valor !== null) {
    return Object.entries(valor).flatMap(([k, filho]) =>
      coletarTextos(filho, caminho ? `${caminho}.${k}` : k, k),
    );
  }
  return [];
}

export interface ContagemAnalise {
  /** Textos livres checados quanto ao idioma. */
  textos: number;
  foraDoPortugues: number;
  comEmoji: number;
  acimaDoLimite: number;
  idsInvalidos: number;
}

/**
 * Um problema achado na resposta. `mensagem` pode citar trechos do texto do modelo (ids, handles):
 * serve só para a mensagem de reparo que volta ao próprio modelo. `caminho` e `codigo` são fixos
 * e seguros para log, erro e `chamada_llm.erro`.
 */
export interface Problema {
  caminho: string;
  codigo: string;
  mensagem: string;
}

export interface AnaliseResposta<J extends NomeJob = NomeJob> {
  /** Aceita pelo roteador: passou em tudo. */
  ok: boolean;
  dados?: SaidasJobs[J];
  jsonOk: boolean;
  /** Passou no schema Zod (estrutura e limites de tamanho). */
  schemaOk: boolean;
  /** Mensagens completas, para o reparo. Podem citar o texto do modelo: não registre. */
  problemas: string[];
  /** Mesmos problemas só com caminho do campo e código curto ("reacoes.0.texto: emoji"). */
  falhas: string[];
  contagem: ContagemAnalise;
}

export interface ContextoValidacao<J extends NomeJob> {
  ids: IdsPermitidos;
  entrada?: EntradasJobs[J];
}

const ERROS_PT = z.locales.ptBR().localeError;
const MAX_PROBLEMAS = 12;

/** Segmentos de caminho que não parecem nome de campo (chave inventada pelo modelo) viram "*". */
export function caminhoSeguro(caminho: string): string {
  return caminho
    .split('.')
    .map((parte) => (/^[A-Za-z0-9_]{1,32}$|^\(raiz\)$/.test(parte) ? parte : '*'))
    .join('.');
}

function caminhoDe(path: readonly PropertyKey[]): string {
  return path.map(String).join('.') || '(raiz)';
}

/** Checagens que dependem da entrada do job ou de mais de um campo. */
function checagensDoJob<J extends NomeJob>(
  job: J,
  dados: SaidasJobs[NomeJob],
  entrada: EntradasJobs[J] | undefined,
): Problema[] {
  const problemas: Problema[] = [];
  const achar = (caminho: string, codigo: string, mensagem: string) =>
    problemas.push({ caminho, codigo, mensagem });
  if (job === 'criar_mundo' && entrada && 'elenco' in dados) {
    const persona = (entrada as EntradasJobs['criar_mundo']).persona.handle.toLowerCase();
    const handlePersona = persona.startsWith('@') ? persona : `@${persona}`;
    [...dados.elenco, ...dados.figurantes].forEach((p) => {
      if (p.handle === handlePersona) {
        achar('elenco', 'handle_do_jogador', `handle ${p.handle} é o do jogador`);
      }
    });
  }
  if (job === 'ficha' && entrada && 'ficha' in dados && 'handle' in dados) {
    const existentes = (entrada as EntradasJobs['ficha']).existentes;
    const handles = new Set(
      existentes.map((p) => (p.handle.startsWith('@') ? p.handle : `@${p.handle}`).toLowerCase()),
    );
    const nomes = new Set(existentes.map((p) => p.nome.toLowerCase()));
    if (handles.has(dados.handle)) {
      achar('handle', 'ja_existe', `handle: ${dados.handle} já existe no mundo`);
    }
    if (nomes.has(dados.nome.toLowerCase())) {
      achar('nome', 'ja_existe', `nome: ${dados.nome} já existe no mundo`);
    }
  }
  if ((job === 'feed_inicial' || job === 'lote_diario') && 'posts' in dados) {
    dados.posts.forEach((post, i) => {
      if (typeof post.respondeA === 'number' && post.respondeA >= i) {
        achar(
          `posts.${i}.respondeA`,
          'resposta_adiante',
          `posts.${i}.respondeA: precisa apontar para um post anterior desta lista`,
        );
      }
    });
  }
  return problemas;
}

/** Analisa o texto bruto do modelo para o job. Nunca lança. */
export function analisarResposta<J extends NomeJob>(
  job: J,
  texto: string,
  contexto: ContextoValidacao<J>,
): AnaliseResposta<J> {
  const contagem: ContagemAnalise = {
    textos: 0,
    foraDoPortugues: 0,
    comEmoji: 0,
    acimaDoLimite: 0,
    idsInvalidos: 0,
  };
  const json = extrairJson(texto);
  if (!json.ok) {
    return {
      ok: false,
      jsonOk: false,
      schemaOk: false,
      problemas: [json.erro],
      falhas: ['(raiz): json_invalido'],
      contagem,
    };
  }

  const problemas: Problema[] = [];
  for (const t of coletarTextos(json.valor)) {
    if (temEmoji(t.texto)) {
      contagem.comEmoji += 1;
      problemas.push({
        caminho: t.caminho,
        codigo: 'emoji',
        mensagem: `${t.caminho}: tem emoji, que é proibido`,
      });
    }
    if (t.livre) {
      contagem.textos += 1;
      if (!parecePortugues(t.texto)) {
        contagem.foraDoPortugues += 1;
        problemas.push({
          caminho: t.caminho,
          codigo: 'idioma',
          mensagem: `${t.caminho}: não está em português do Brasil`,
        });
      }
    }
  }

  const resultado = schemaParaValidar(job, json.valor).safeParse(json.valor, { error: ERROS_PT });
  if (!resultado.success) {
    for (const issue of resultado.error.issues) {
      if (issue.code === 'too_big' && issue.origin === 'string') contagem.acimaDoLimite += 1;
      const caminho = caminhoDe(issue.path);
      const codigo = (issue as { params?: { codigo?: unknown } }).params?.codigo;
      problemas.push({
        caminho,
        codigo: typeof codigo === 'string' ? codigo : issue.code,
        mensagem: `${caminho}: ${issue.message}`,
      });
    }
  }

  const ids = validarIdsDetalhado(json.valor, contexto.ids);
  contagem.idsInvalidos = ids.length;
  problemas.push(...ids);

  let dados: SaidasJobs[J] | undefined;
  if (resultado.success) {
    dados = resultado.data as SaidasJobs[J];
    problemas.push(...checagensDoJob(job, dados, contexto.entrada));
  }

  const lidos = problemas.slice(0, MAX_PROBLEMAS);
  return {
    ok: resultado.success && problemas.length === 0,
    dados: problemas.length === 0 ? dados : undefined,
    jsonOk: true,
    schemaOk: resultado.success,
    problemas: lidos.map((p) => p.mensagem),
    falhas: [...new Set(lidos.map((p) => `${caminhoSeguro(p.caminho)}: ${p.codigo}`))],
    contagem,
  };
}
