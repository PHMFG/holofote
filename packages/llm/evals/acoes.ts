// As 30 ações de exemplo dos evals, no mundo "Pop Brasil": 12 posts (3 de cada tom),
// 6 comentários, 3 respostas a história, 7 DMs (5 com o elenco, 2 com figurantes) e 2 discursos.
// Os números imitam o que o motor devolveria; aqui são fixos.
import type { Tom } from '@holofote/shared';
import type { EntradasJobs, NumerosMotor, ReatorPrompt } from '../src/prompts/tipos';
import {
  BENTO,
  DUDA,
  FOFOCALIZEI,
  LUA,
  MARI,
  OTAVIO,
  RESUMO_ESTADO,
  VIC,
  reator,
} from './pop-brasil';

type JobEval = 'diretor' | 'dm' | 'discurso';

export type AcaoEval = {
  [J in JobEval]: { id: string; descricao: string; job: J; entrada: EntradasJobs[J] };
}[JobEval];

const pessoa = (p: { id: string; nome: string; handle: string }) => ({
  id: p.id,
  nome: p.nome,
  handle: p.handle,
});

function post(
  id: string,
  tom: Tom,
  texto: string,
  reatores: ReatorPrompt[],
  numeros: NumerosMotor,
  marcados: (typeof VIC)[] = [],
): AcaoEval {
  return {
    id,
    descricao: `post ${tom}`,
    job: 'diretor',
    entrada: {
      resumoEstado: RESUMO_ESTADO,
      momento: { dia: 3, periodo: 'noite' },
      jogador: LUA,
      acao: { tipo: 'post', texto, tom, marcados: marcados.map(pessoa) },
      numeros,
      reatores,
    },
  };
}

function comentario(
  id: string,
  tom: Tom,
  autor: typeof VIC,
  original: string,
  texto: string,
  reatores: ReatorPrompt[],
  numeros: NumerosMotor,
): AcaoEval {
  return {
    id,
    descricao: `comentário ${tom}`,
    job: 'diretor',
    entrada: {
      resumoEstado: RESUMO_ESTADO,
      momento: { dia: 3, periodo: 'tarde' },
      jogador: LUA,
      acao: { tipo: 'resposta', texto, tom, emResposta: { autor: pessoa(autor), texto: original } },
      numeros,
      reatores,
    },
  };
}

function respostaHistoria(
  id: string,
  autor: typeof VIC,
  historia: string,
  texto: string,
): AcaoEval {
  return {
    id,
    descricao: 'resposta a história',
    job: 'diretor',
    entrada: {
      resumoEstado: RESUMO_ESTADO,
      momento: { dia: 3, periodo: 'manha' },
      jogador: LUA,
      acao: {
        tipo: 'resposta_historia',
        texto,
        emResposta: { autor: pessoa(autor), texto: historia },
      },
      numeros: { deltas: [{ alvo: `relacao:${autor.id}`, valor: 1 }] },
      reatores: [reator(autor, 'autor da história')],
    },
  };
}

function dm(
  id: string,
  personagem: typeof VIC,
  mensagem: string,
  resumoConversa: string | null,
  ultimas: EntradasJobs['dm']['ultimas'],
): AcaoEval {
  return {
    id,
    descricao: `dm com ${personagem.papel}`,
    job: 'dm',
    entrada: {
      resumoEstado: RESUMO_ESTADO,
      jogador: LUA,
      personagem: reator(personagem, 'conversa privada'),
      resumoConversa,
      ultimas,
      mensagem,
    },
  };
}

const relacao = (p: typeof VIC, valor: number) => ({ alvo: `relacao:${p.id}`, valor });

export const ACOES_EVAL: AcaoEval[] = [
  // ---------- posts: fofo ----------
  post(
    'post-fofo-1',
    'fofo',
    'obrigada por cada play em Maré Alta, vocês são a minha casa',
    [
      reator(BENTO, 'afinidade alta'),
      reator(MARI, 'fã online'),
      reator(FOFOCALIZEI, 'fofoca online'),
    ],
    { seguidoresGanhos: 80, curtidas: 410, deltas: [{ alvo: 'carisma', valor: 1 }] },
  ),
  post(
    'post-fofo-2',
    'fofo',
    'Duda, sem você esse single não existia. parceria para a vida',
    [reator(DUDA, 'marcada'), reator(BENTO, 'afinidade alta'), reator(VIC, 'online')],
    { seguidoresGanhos: 60, curtidas: 350, deltas: [relacao(DUDA, 3)] },
    [DUDA],
  ),
  post(
    'post-fofo-3',
    'fofo',
    'bom dia para quem vai ouvir Maré Alta no caminho do trabalho',
    [reator(MARI, 'fã online'), reator(BENTO, 'afinidade alta')],
    { seguidoresGanhos: 40, curtidas: 220 },
  ),
  // ---------- posts: sincero ----------
  post(
    'post-sincero-1',
    'sincero',
    'vou ser sincera: fiquei nervosa no lançamento e quase desisti de postar',
    [reator(BENTO, 'afinidade alta'), reator(DUDA, 'online'), reator(FOFOCALIZEI, 'fofoca online')],
    { seguidoresGanhos: 95, curtidas: 520, deltas: [{ alvo: 'polemica', valor: 1 }] },
  ),
  post(
    'post-sincero-2',
    'sincero',
    'aprendi muito com a Vic quando comecei, mesmo a gente não se falando hoje',
    [reator(VIC, 'marcada'), reator(FOFOCALIZEI, 'fofoca online'), reator(OTAVIO, 'online')],
    { seguidoresGanhos: 120, curtidas: 610, deltas: [relacao(VIC, 2)] },
    [VIC],
  ),
  post(
    'post-sincero-3',
    'sincero',
    'o clipe atrasou porque eu quis refazer o final. culpa minha',
    [reator(DUDA, 'online'), reator(OTAVIO, 'online')],
    { seguidoresGanhos: 50, curtidas: 300 },
  ),
  // ---------- posts: misterioso ----------
  post(
    'post-misterioso-1',
    'misterioso',
    'sábado vai ter surpresa. quem souber, finge que não sabe',
    [
      reator(FOFOCALIZEI, 'fofoca online'),
      reator(BENTO, 'afinidade alta'),
      reator(MARI, 'fã online'),
    ],
    { seguidoresGanhos: 140, curtidas: 700, deltas: [{ alvo: 'polemica', valor: 2 }] },
  ),
  post(
    'post-misterioso-2',
    'misterioso',
    'algumas pessoas só aparecem quando a música toca no rádio...',
    [reator(VIC, 'afinidade baixa'), reator(FOFOCALIZEI, 'fofoca online')],
    { seguidoresGanhos: 110, curtidas: 580, deltas: [{ alvo: 'polemica', valor: 3 }] },
  ),
  post(
    'post-misterioso-3',
    'misterioso',
    'estúdio às três da manhã. ninguém precisa saber com quem',
    [reator(DUDA, 'online'), reator(FOFOCALIZEI, 'fofoca online'), reator(BENTO, 'afinidade alta')],
    { seguidoresGanhos: 130, curtidas: 640, deltas: [{ alvo: 'polemica', valor: 2 }] },
  ),
  // ---------- posts: provocativo ----------
  post(
    'post-provocativo-1',
    'provocativo',
    'tem gente que lota show com playback. eu prefiro cantar de verdade',
    [
      reator(VIC, 'afinidade baixa'),
      reator(FOFOCALIZEI, 'fofoca online'),
      reator(OTAVIO, 'online'),
      reator(BENTO, 'afinidade alta'),
    ],
    {
      seguidoresGanhos: 260,
      curtidas: 1300,
      deltas: [{ alvo: 'polemica', valor: 7 }, relacao(VIC, -4)],
    },
  ),
  post(
    'post-provocativo-2',
    'provocativo',
    '@vicferraz o trono do pop está ficando pequeno para duas',
    [
      reator(VIC, 'marcada'),
      reator(FOFOCALIZEI, 'fofoca online'),
      reator(BENTO, 'afinidade alta'),
      reator(DUDA, 'online'),
    ],
    {
      seguidoresGanhos: 310,
      curtidas: 1500,
      deltas: [{ alvo: 'polemica', valor: 8 }, relacao(VIC, -5)],
    },
    [VIC],
  ),
  post(
    'post-provocativo-3',
    'provocativo',
    'o fofocalizei inventa tanta coisa que devia lançar um livro de ficção',
    [reator(FOFOCALIZEI, 'marcado'), reator(BENTO, 'afinidade alta'), reator(VIC, 'online')],
    {
      seguidoresGanhos: 180,
      curtidas: 900,
      deltas: [{ alvo: 'polemica', valor: 5 }, relacao(FOFOCALIZEI, -3)],
    },
    [FOFOCALIZEI],
  ),
  // ---------- comentários ----------
  comentario(
    'comentario-1',
    'sincero',
    VIC,
    'show sábado, ingressos esgotados em uma hora',
    'parabéns, Vic. a gente se vê nas paradas',
    [reator(VIC, 'autora do post'), reator(FOFOCALIZEI, 'fofoca online')],
    { curtidas: 90, deltas: [relacao(VIC, 1)] },
  ),
  comentario(
    'comentario-2',
    'fofo',
    FOFOCALIZEI,
    'URGENTE: Lua e Duda brigaram no estúdio?',
    'ninguém brigou, a gente só discorda alto kkkk',
    [reator(FOFOCALIZEI, 'autor do post'), reator(DUDA, 'citada'), reator(BENTO, 'afinidade alta')],
    { curtidas: 150, deltas: [{ alvo: 'carisma', valor: 1 }] },
  ),
  comentario(
    'comentario-3',
    'fofo',
    BENTO,
    'minha amiga lançou o hino do ano e eu chorei no ônibus',
    'você é o melhor amigo do mundo, para de me fazer chorar',
    [reator(BENTO, 'autor do post'), reator(MARI, 'fã online')],
    { curtidas: 70, deltas: [relacao(BENTO, 2)] },
  ),
  comentario(
    'comentario-4',
    'provocativo',
    OTAVIO,
    'Maré Alta é bem produzida, mas falta identidade',
    'identidade eu tenho de sobra, é só ouvir o disco inteiro',
    [
      reator(OTAVIO, 'autor do post'),
      reator(DUDA, 'produtora citada'),
      reator(FOFOCALIZEI, 'fofoca online'),
    ],
    { curtidas: 200, deltas: [{ alvo: 'polemica', valor: 4 }] },
  ),
  comentario(
    'comentario-5',
    'fofo',
    DUDA,
    'sessão amanhã às 10h. sem atraso dessa vez',
    'às 10h em ponto, prometo. levo o café',
    [reator(DUDA, 'autora do post'), reator(BENTO, 'afinidade alta')],
    { curtidas: 60, deltas: [relacao(DUDA, 2)] },
  ),
  comentario(
    'comentario-6',
    'provocativo',
    VIC,
    'tem artista que confunde barulho com talento',
    'barulho foi o que o meu single fez nas paradas essa semana',
    [
      reator(VIC, 'autora do post'),
      reator(FOFOCALIZEI, 'fofoca online'),
      reator(BENTO, 'afinidade alta'),
    ],
    { curtidas: 340, deltas: [{ alvo: 'polemica', valor: 6 }, relacao(VIC, -4)] },
  ),
  // ---------- respostas a história ----------
  respostaHistoria('historia-1', VIC, 'ensaio geral para sábado', 'boa sorte no show, de verdade'),
  respostaHistoria(
    'historia-2',
    BENTO,
    'enquete: qual a melhor música da Lua?',
    'obviamente Maré Alta, mas te amo por perguntar',
  ),
  respostaHistoria(
    'historia-3',
    FOFOCALIZEI,
    'quem será o casal secreto do pop?',
    'não sou eu, pode tirar o cavalinho da chuva',
  ),
  // ---------- DMs ----------
  dm(
    'dm-vic',
    VIC,
    'a gente podia parar com essa guerra de indireta, não acha?',
    'Vic e Lua quase não se falam. A última troca foi fria, sobre o festival de verão.',
    [
      { autor: 'jogador', texto: 'oi, Vic. vi seu ensaio, ficou lindo' },
      { autor: 'personagem', texto: 'obrigada. você também anda ocupada, né' },
    ],
  ),
  dm(
    'dm-duda-1',
    DUDA,
    'desculpa por faltar semana passada. não vai se repetir',
    'Duda cobrou a Lua pela sessão perdida e marcou outra.',
    [{ autor: 'personagem', texto: 'semana que vem sem desculpa, combinado?' }],
  ),
  dm(
    'dm-bento',
    BENTO,
    'me ajuda a escolher o look do prêmio?',
    'Bento e Lua conversam todo dia, entre meme e conselho.',
    [
      { autor: 'personagem', texto: 'viu o que o fofocalizei postou?' },
      { autor: 'jogador', texto: 'vi e ignorei' },
      { autor: 'personagem', texto: 'isso, rainha' },
      { autor: 'jogador', texto: 'mas fiquei chateada' },
      { autor: 'personagem', texto: 'quer que eu responda por você? kkkk' },
    ],
  ),
  dm('dm-fofocalizei', FOFOCALIZEI, 'de onde você tira essas histórias?', null, []),
  dm(
    'dm-duda-2',
    DUDA,
    'e se a gente lançasse um feat com a Vic?',
    'Duda e Lua estão fechando o repertório do segundo single.',
    [{ autor: 'jogador', texto: 'tive uma ideia meio doida' }],
  ),
  dm('dm-mari', MARI, 'obrigada por organizar o fã-clube, de verdade', null, []),
  dm('dm-otavio', OTAVIO, 'li sua crítica. topa uma entrevista?', null, []),
  // ---------- discursos ----------
  {
    id: 'discurso-ousado',
    descricao: 'discurso ousado, venceu',
    job: 'discurso',
    entrada: {
      resumoEstado: RESUMO_ESTADO,
      jogador: LUA,
      evento: { tipo: 'premio', titulo: 'Prêmio Pop Brasil', categoria: 'Revelação do ano' },
      discurso: { opcao: 'ousado', titulo: 'Agradecer e alfinetar quem duvidou' },
      resultado: { jogadorVenceu: true, vencedor: pessoa(LUA) },
      numeros: { seguidoresGanhos: 900, deltas: [{ alvo: 'fama', valor: 6 }, relacao(VIC, -3)] },
      reatores: [
        reator(VIC, 'indicada perdedora'),
        reator(BENTO, 'afinidade alta'),
        reator(FOFOCALIZEI, 'fofoca online'),
        reator(DUDA, 'parceira'),
      ],
    },
  },
  {
    id: 'discurso-seguro',
    descricao: 'discurso seguro, perdeu',
    job: 'discurso',
    entrada: {
      resumoEstado: RESUMO_ESTADO,
      jogador: LUA,
      evento: { tipo: 'premio', titulo: 'Prêmio Pop Brasil', categoria: 'Revelação do ano' },
      discurso: { opcao: 'seguro', titulo: 'Agradecer à equipe e aos fãs' },
      resultado: { jogadorVenceu: false, vencedor: pessoa(VIC) },
      numeros: { seguidoresGanhos: 300, deltas: [{ alvo: 'carisma', valor: 2 }] },
      reatores: [
        reator(VIC, 'vencedora'),
        reator(BENTO, 'afinidade alta'),
        reator(MARI, 'fã online'),
      ],
    },
  },
];
