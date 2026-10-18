// Construtores de prompt por job e o que cada job aceita de volta (ids permitidos).
import type { NomeJob } from '../jobs';
import type { IdsPermitidos } from '../schemas';
import { promptCriarMundo } from './criar-mundo';
import { promptDiretor } from './diretor';
import { promptDiscurso } from './discurso';
import { promptDm } from './dm';
import { promptFeedInicial, promptLoteDiario } from './feed';
import { promptFicha } from './ficha';
import { promptMemoria } from './memoria';
import { promptNovoAto } from './novo-ato';
import type { EntradasJobs } from './tipos';

export { REGRAS_ESTILO, VERSAO_PROMPTS } from './estilo';
export { montarPrefixo } from './prefixo';
export { TAREFA_CRIAR_MUNDO, promptCriarMundo } from './criar-mundo';
export { TAREFA_DIRETOR, promptDiretor } from './diretor';
export { TAREFA_DISCURSO, promptDiscurso } from './discurso';
export { TAREFA_DM, ULTIMAS_MENSAGENS_DM, promptDm } from './dm';
export {
  TAREFA_FEED_INICIAL,
  TAREFA_LOTE_DIARIO,
  promptFeedInicial,
  promptLoteDiario,
} from './feed';
export { TAREFA_FICHA, promptFicha } from './ficha';
export { TAREFA_MEMORIA, promptMemoria } from './memoria';
export { TAREFA_NOVO_ATO, promptNovoAto } from './novo-ato';
export type * from './tipos';

export const PROMPTS: { [J in NomeJob]: (entrada: EntradasJobs[J]) => string } = {
  diretor: promptDiretor,
  dm: promptDm,
  discurso: promptDiscurso,
  criar_mundo: promptCriarMundo,
  feed_inicial: promptFeedInicial,
  lote_diario: promptLoteDiario,
  memoria: promptMemoria,
  ficha: promptFicha,
  novo_ato: promptNovoAto,
};

/** Prompt de usuário do job (sempre começa com `JOB: <nome>`). */
export function montarPromptDoJob<J extends NomeJob>(job: J, entrada: EntradasJobs[J]): string {
  return PROMPTS[job](entrada);
}

/** Ids que o modelo pode devolver em cada job: só os que foram no prompt. */
export function idsDaEntrada<J extends NomeJob>(job: J, entrada: EntradasJobs[J]): IdsPermitidos {
  const e = entrada as EntradasJobs[NomeJob];
  switch (job) {
    case 'diretor':
    case 'discurso': {
      const { reatores } = e as EntradasJobs['diretor'] | EntradasJobs['discurso'];
      return { personagens: reatores.slice(0, 5).map((r) => r.id) };
    }
    case 'feed_inicial':
    case 'lote_diario': {
      const feed = e as EntradasJobs['feed_inicial'] | EntradasJobs['lote_diario'];
      const personagens = feed.personagens.map((p) => p.id);
      const posts = 'postsRecentes' in feed ? (feed.postsRecentes ?? []).map((p) => p.id) : [];
      return { personagens, sobre: [...personagens, feed.jogador.id], posts };
    }
    case 'memoria': {
      const { itens } = e as EntradasJobs['memoria'];
      return {
        personagens: itens.map((i) => i.personagem.id),
        sobre: itens.map((i) => i.sobre.id),
      };
    }
    default:
      // dm, criar_mundo, ficha e novo_ato não devolvem ids.
      return { personagens: [] };
  }
}
