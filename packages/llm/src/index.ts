// @holofote/llm: adaptador de IA do Holofote (provedores, prompts, schemas e roteador).
// Só o worker usa este pacote; a chave nunca sai do servidor.
import type { ConfigLlm } from './config';
import { criarProvedorFalso } from './falso';
import { criarProvedorOpenCode, type OpcoesOpenCode } from './opencode';
import type { Provedor } from './provedor';

export * from './config';
export * from './jobs';
export * from './provedor';
export * from './custo';
export * from './schemas';
export * from './idioma';
export { extrairJson, type ResultadoJson } from './json';
export * from './validacao';
export * from './prompts';
export * from './roteador';
export { criarProvedorFalso, respostaFalsa } from './falso';
export {
  criarProvedorRoteirizado,
  type PassoRoteiro,
  type ProvedorRoteirizado,
} from './roteirizado';
export {
  ErroModelosAusentes,
  criarProvedorOpenCode,
  fetchComUserAgent,
  mapearErro,
  ocultarChave,
  verificarModelos,
  type OpcoesOpenCode,
} from './opencode';

/** Provedor de acordo com LLM_PROVIDER. */
export function criarProvedor(config: ConfigLlm, opcoes?: OpcoesOpenCode): Provedor {
  return config.provedor === 'opencode-go'
    ? criarProvedorOpenCode(config, opcoes)
    : criarProvedorFalso();
}
