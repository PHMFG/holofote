// Uma entrada de exemplo por job, no mundo "Pop Brasil". Usada nos testes e como referência
// para o worker montar as entradas.
import type { EntradasJobs } from '../src/prompts/tipos';
import { ACOES_EVAL } from './acoes';
import {
  BENTO,
  DUDA,
  FOFOCALIZEI,
  LUA,
  MARI,
  OTAVIO,
  PERSONAGENS,
  RESUMO_ESTADO,
  VIC,
} from './pop-brasil';

function acao<J extends 'diretor' | 'dm' | 'discurso'>(job: J, id: string): EntradasJobs[J] {
  const encontrada = ACOES_EVAL.find((a) => a.id === id && a.job === job);
  if (!encontrada) throw new Error(`ação de eval ${id} não encontrada`);
  return encontrada.entrada as EntradasJobs[J];
}

const curta = (p: { id: string; nome: string; handle: string }) => ({
  id: p.id,
  nome: p.nome,
  handle: p.handle,
});

export const EXEMPLOS: EntradasJobs = {
  diretor: acao('diretor', 'post-provocativo-2'),
  dm: acao('dm', 'dm-bento'),
  discurso: acao('discurso', 'discurso-ousado'),
  criar_mundo: {
    universo: 'Pop Brasil',
    tomCaos: 60,
    persona: {
      nome: 'Lua Prado',
      handle: '@luaprado',
      descricao: 'cantora em ascensão, do interior de Minas para o pop nacional',
    },
  },
  feed_inicial: {
    jogador: LUA,
    personagens: [...PERSONAGENS],
    objetivoAto: 'Dominar o pop nacional',
    marcoAtual: 'Primeiro show lotado',
    evento: { titulo: 'Prêmio Pop Brasil', categoria: 'Revelação do ano', quando: 'dia 5, noite' },
    momento: { dia: 1, periodo: 'manha' },
    quantidadePosts: 15,
  },
  lote_diario: {
    momento: { dia: 4, periodo: 'manha' },
    resumoEstado: RESUMO_ESTADO,
    jogador: LUA,
    personagens: [...PERSONAGENS],
    ontem: [
      'Lua postou que o trono do pop está pequeno para duas e marcou a Vic',
      'Vic respondeu com uma indireta e o Fofocalizei fez thread',
      'Duda e Lua marcaram nova sessão de estúdio',
    ],
    numerosDia: [
      { rotulo: 'seguidores', valor: '7,6 mil (+520)' },
      { rotulo: 'afinidade com Vic', valor: '33 (-5)' },
    ],
    objetivoAto: 'Dominar o pop nacional',
    evento: { titulo: 'Prêmio Pop Brasil', categoria: 'Revelação do ano', quando: 'dia 5, noite' },
    postsRecentes: [
      {
        id: '7f1c2a90-0000-4000-8000-0000000000d1',
        autorId: VIC.id,
        texto: 'tem artista que confunde barulho com talento',
      },
    ],
    memoriasParaResumir: [
      {
        personagem: curta(VIC),
        sobre: curta(LUA),
        fatosAtuais: 'a Lua cantou no festival em que ela era atração principal',
        eventosNovos: ['a Lua disse que o trono do pop está pequeno para duas'],
      },
    ],
    podePuxarConversa: true,
    quantidadePosts: 20,
  },
  memoria: {
    itens: [
      {
        personagem: curta(BENTO),
        sobre: curta(LUA),
        fatosAtuais: 'amigos desde a escola',
        eventosNovos: ['a Lua pediu ajuda com o look do prêmio', 'a Lua chorou com o post dele'],
      },
      {
        personagem: curta(FOFOCALIZEI),
        sobre: curta(LUA),
        fatosAtuais: null,
        eventosNovos: ['a Lua chamou o perfil de livro de ficção'],
      },
    ],
  },
  ficha: {
    motivo: 'marco "Primeiro show lotado" liberado: entra uma pessoa nova no mundo',
    vinculoDesejado: 'mentor',
    jogador: curta(LUA),
    existentes: [LUA, VIC, DUDA, BENTO, FOFOCALIZEI, MARI, OTAVIO].map((p) => ({
      nome: p.nome,
      handle: p.handle,
    })),
  },
  novo_ato: {
    ato: 2,
    objetivoAnterior: 'Dominar o pop nacional',
    marcosCumpridos: [
      'Primeira repercussão',
      'Primeiro show lotado',
      'Virar assunto do dia',
      'Ganhar o respeito de quem duvidou',
      'Fechar o ato no topo',
    ],
    resumoEstado: RESUMO_ESTADO,
    jogador: LUA,
  },
};
