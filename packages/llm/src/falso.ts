// Provedor falso: DUBLÊ DE TESTE, não conteúdo de jogo.
//
// Serve para testes e para desenvolver sem chave (LLM_PROVIDER=falso). Lê o job da linha
// `JOB: <nome>` do prompt e devolve um JSON válido para o schema daquele job, montado com os
// ids, nomes e handles que vieram no próprio prompt, para o jogo rodar de ponta a ponta.
// É determinístico: o mesmo pedido gera sempre a mesma resposta.
//
// As frases daqui são genéricas de propósito. O jogo não tem falas prontas: em produção todo
// texto vem do modelo, e se o provedor falhar o job é reagendado (nunca cai neste arquivo).
import { ehNomeJob, type NomeJob } from './jobs';
import type { PedidoGeracao, Provedor, RespostaBruta } from './provedor';

interface Pessoa {
  id: string;
  nome: string;
  handle: string;
  papel?: 'elenco' | 'figurante';
}

type Secoes = Map<string, string[]>;

const TITULO = /^\p{Lu}[\p{Lu} ]*$/u;
const LINHA_PESSOA = /^\[id:([^\]]+)\] (.+?) \((@[^)\s]+)\)(.*)$/;

/** Separa o prompt em seções pelo título em maiúsculas numa linha só. */
function lerSecoes(texto: string): Secoes {
  const secoes: Secoes = new Map();
  let atual: string[] | null = null;
  for (const linha of texto.split('\n')) {
    if (TITULO.test(linha.trim())) {
      atual = [];
      secoes.set(linha.trim(), atual);
    } else if (atual && linha.trim() !== '') {
      atual.push(linha);
    }
  }
  return secoes;
}

function pessoasEm(secoes: Secoes, titulo: string): Pessoa[] {
  const pessoas: Pessoa[] = [];
  for (const linha of secoes.get(titulo) ?? []) {
    const m = LINHA_PESSOA.exec(linha);
    if (!m?.[1] || !m[2] || !m[3]) continue;
    const resto = m[4] ?? '';
    const papel = / · figurante/.test(resto)
      ? 'figurante'
      : / · elenco/.test(resto)
        ? 'elenco'
        : undefined;
    pessoas.push({ id: m[1], nome: m[2], handle: m[3], papel });
  }
  return pessoas;
}

function primeiraLinha(secoes: Secoes, titulo: string): string {
  return (secoes.get(titulo)?.[0] ?? '').trim();
}

function semAspas(texto: string): string {
  return texto.replace(/^"|"$/g, '');
}

/** FNV-1a de 32 bits: semente estável a partir do prompt. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function cortar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const espaco = corte.lastIndexOf(' ');
  return (espaco > max / 2 ? corte.slice(0, espaco) : corte).trimEnd();
}

function primeiroNome(p: Pessoa | undefined): string {
  return p?.nome.split(' ')[0] ?? 'gente';
}

function escolher<T>(lista: readonly T[], semente: number, deslocamento = 0): T {
  const item = lista[(semente + deslocamento) % lista.length];
  if (item === undefined) throw new Error('lista vazia no provedor falso');
  return item;
}

function slug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20);
}

// ---------- frases genéricas do dublê ----------

const REACOES: readonly ((autor: Pessoa, jogador: Pessoa | undefined) => string)[] = [
  (_, j) => `${primeiroNome(j)}, vi o que você escreveu e já tenho opinião formada sobre isso`,
  (_, j) =>
    `não sei se concordo com ${primeiroNome(j)}, mas a timeline não fala de outra coisa hoje`,
  (_, j) => `alguém mais viu o post de ${primeiroNome(j)}? quero saber o que vocês acham`,
  (a) => `aqui é ${primeiroNome(a)} e eu vou acompanhar essa história de perto`,
  () => `anotado. depois a gente conversa sobre isso com calma`,
];

const POSTS: readonly ((autor: Pessoa, jogador: Pessoa | undefined) => string)[] = [
  (_, j) => `chegou gente nova na área e o nome é ${primeiroNome(j)}. vamos ver se aguenta o ritmo`,
  () => `hoje acordei com vontade de mudar tudo e ninguém vai me impedir`,
  (a) => `${primeiroNome(a)} passando para avisar que a semana vai ser longa`,
  () => `tem gente aqui que fala muito e entrega pouco. não vou dizer quem`,
  (_, j) => `já segui ${primeiroNome(j)} só para ver no que isso vai dar`,
  () => `ensaio cedo, café forte e nenhuma paciência para fofoca hoje`,
];

// ---------- respostas por job ----------

function respostaDiretor(s: Secoes, semente: number) {
  const jogador = pessoasEm(s, 'JOGADOR')[0];
  const reatores = pessoasEm(s, 'REATORES').slice(0, 5);
  const historia = (s.get('AÇÃO DO JOGADOR') ?? []).some((l) =>
    l.includes('resposta a uma história'),
  );
  return {
    reacoes: reatores.map((r, i) => ({
      personagemId: r.id,
      tipo: historia && i === 0 ? 'dm' : i === 1 ? 'citacao' : 'resposta',
      texto: cortar(escolher(REACOES, semente, i)(r, jogador), 220),
      atrasoSeg: 20 + ((semente >>> (i * 3)) % 400) + i * 60,
    })),
    cartao: {
      titulo: 'A ação rendeu conversa',
      texto: cortar(
        `${reatores.length} perfis reagiram ao que ${primeiroNome(jogador)} fez agora. Os números do motor já estão no perfil.`,
        240,
      ),
    },
    deltasSugeridos: reatores[0] ? [{ alvo: `relacao:${reatores[0].id}`, valor: 1 }] : [],
    memorias: reatores[0]
      ? [
          {
            personagemId: reatores[0].id,
            fato: cortar(`viu a última ação de ${primeiroNome(jogador)}`, 100),
          },
        ]
      : [],
    moderacao: { ok: true },
  };
}

function respostaDm(s: Secoes, semente: number) {
  const jogador = pessoasEm(s, 'JOGADOR')[0];
  const personagem = pessoasEm(s, 'PERSONAGEM')[0];
  const anterior = primeiraLinha(s, 'RESUMO DA CONVERSA');
  const mensagens = [`oi, ${primeiroNome(jogador)}. li sua mensagem agora`];
  if (semente % 2 === 0) mensagens.push('me dá um tempo que eu respondo direito, tá?');
  const base =
    anterior && anterior !== 'primeira conversa'
      ? `${anterior} Depois disso, trocaram mais mensagens.`
      : `${personagem?.nome ?? 'O personagem'} e ${jogador?.nome ?? 'o jogador'} começaram a conversar por mensagem.`;
  return {
    mensagens,
    resumoConversa: cortar(base, 400),
    deltaSugerido: (semente % 3) - 1,
    memoria: null,
  };
}

function respostaDiscurso(s: Secoes, semente: number) {
  const jogador = pessoasEm(s, 'JOGADOR')[0];
  const venceu = (s.get('RESULTADO') ?? []).some((l) => l.includes('venceu: sim'));
  const reatores = pessoasEm(s, 'REATORES').slice(0, 5);
  const nome = primeiroNome(jogador);
  return {
    manchete: venceu
      ? `${nome} vence e faz um discurso que divide a internet`
      : `${nome} não leva o prêmio, mas o discurso rouba a noite`,
    reacoes: reatores.map((r, i) => ({
      personagemId: r.id,
      texto: cortar(escolher(REACOES, semente, i)(r, jogador), 220),
      atrasoSeg: 20 + ((semente >>> (i * 2)) % 200) + i * 30,
    })),
  };
}

const NOMES = [
  'Rafa Toledo',
  'Nina Albuquerque',
  'Caio Ventura',
  'Jade Moreira',
  'Téo Siqueira',
  'Bia Lacerda',
  'Davi Rocha',
  'Lia Fontes',
  'Igor Matos',
  'Maya Duarte',
  'Luan Prates',
  'Clara Neves',
  'Otto Ramos',
  'Rita Gouveia',
] as const;

const FICHAS_VINCULO = {
  rival:
    'Rival do jogador desde o primeiro dia. Escreve em frases curtas e cheias de indireta. Quer provar que chegou primeiro e não divide o holofote com ninguém.',
  amizade:
    'Amizade antiga do jogador. Escreve com carinho e muita risada. Quer ver o jogador brilhar, mas cobra quando ele some.',
  parceria:
    'Parceria de trabalho do jogador. Escreve de um jeito direto e prático. Quer crescer junto, desde que a parceria seja justa.',
  mentor:
    'Mentor do jogador, com anos de estrada. Escreve pouco e com calma. Quer deixar um legado e ensinar quem tem talento.',
  interesse:
    'Interesse do jogador, misterioso e charmoso. Escreve com frases soltas e respostas atrasadas. Quer ser notado sem parecer que quer.',
  fofoca:
    'Perfil de fofoca que sabe de tudo antes de todo mundo. Escreve em tom de manchete. Quer audiência e não perdoa deslize.',
} as const;

function handleLivre(nome: string, usados: Set<string>): string {
  let handle = `@${slug(nome)}`;
  while (usados.has(handle)) handle = `${handle.slice(0, 23)}_`;
  usados.add(handle);
  return handle;
}

function respostaCriarMundo(s: Secoes, semente: number) {
  const universo = cortar(semAspas(primeiraLinha(s, 'UNIVERSO')) || 'mundo novo', 60);
  const caos = Number.parseInt(primeiraLinha(s, 'NÍVEL DE CAOS'), 10) || 50;
  const persona = /\((@[^)\s]+)\)/.exec(primeiraLinha(s, 'JOGADOR'))?.[1]?.toLowerCase() ?? '';
  const usados = new Set([persona]);
  const nomes = Array.from({ length: 9 }, (_, i) => escolher(NOMES, semente, i));
  const vinculos = ['rival', 'amizade', 'parceria', 'mentor', 'fofoca'] as const;
  const elenco = vinculos.map((tipoVinculo, i) => {
    const nome = nomes[i] ?? `Pessoa ${i}`;
    return {
      nome,
      handle: handleLivre(nome, usados),
      ficha: FICHAS_VINCULO[tipoVinculo],
      tipoVinculo,
      verificado: i % 2 === 0,
      tomAvatar: i % 2 === 0 ? 'claro' : 'medio',
    };
  });
  const tipos = ['fã', 'crítico', 'jornalista', 'colega'] as const;
  const figurantes = tipos.map((tipo, i) => {
    const nome = nomes[5 + i] ?? `Figurante ${i}`;
    return {
      nome,
      handle: handleLivre(nome, usados),
      ficha: `Perfil de ${tipo} que comenta tudo o que acontece no mundo, sempre com opinião forte.`,
      tipo,
    };
  });
  const tom =
    caos > 60
      ? 'caótico, com treta todo dia'
      : caos > 30
        ? 'equilibrado, entre apoio e alfinetada'
        : 'calmo, com mais apoio do que treta';
  const biblia = [
    // O universo pode vir em qualquer língua; o resto da bíblia é português de sobra.
    `Universo: ${universo}. Uma rede social em que todo mundo acompanha a vida de todo mundo, com fã, rival e fofoca no mesmo lugar.`,
    `Tom: ${tom}.`,
    'Elenco:',
    ...elenco.map((p) => `${p.nome} (${p.handle}): ${p.tipoVinculo} do jogador`),
  ].join('\n');
  return {
    nomeMundo: universo,
    biblia,
    objetivoAto: 'Virar o nome mais comentado deste mundo',
    elenco,
    figurantes,
    marcos: [
      { titulo: 'Primeira repercussão', descricao: 'Fazer um post render conversa no elenco.' },
      { titulo: 'Escolher um lado', descricao: 'Fechar uma aliança ou assumir uma rivalidade.' },
      { titulo: 'Primeiro grande momento', descricao: 'Ser o assunto principal do dia.' },
      { titulo: 'Virar referência', descricao: 'Ganhar o respeito de quem duvidou.' },
      { titulo: 'Fechar o ato no topo', descricao: 'Terminar o ato como o nome mais comentado.' },
    ],
    evento: {
      tipo: 'premio',
      titulo: 'Grande prêmio da temporada',
      categoria: 'Revelação do ano',
    },
    moderacao: { ok: true },
  };
}

function lerItensMemoria(linhas: string[]): { personagem: string; sobre: string; texto: string }[] {
  const itens: { personagem: string; sobre: string; texto: string }[] = [];
  for (const linha of linhas) {
    const m = /^- \[id:([^\]]+)\].*? lembra de \[id:([^\]]+)\]/.exec(linha);
    if (m?.[1] && m[2]) {
      itens.push({ personagem: m[1], sobre: m[2], texto: '' });
      continue;
    }
    const ultimo = itens.at(-1);
    const fato = /^\s+(?:fatos atuais|eventos novos): (.*)$/.exec(linha)?.[1];
    if (ultimo && fato && fato !== 'nenhum')
      ultimo.texto = ultimo.texto ? `${ultimo.texto}; ${fato}` : fato;
  }
  return itens;
}

function memoriasDe(linhas: string[]) {
  return lerItensMemoria(linhas).map((item) => ({
    personagemId: item.personagem,
    sobreId: item.sobre,
    fatos: cortar(item.texto || 'ainda não tem fatos marcantes sobre essa pessoa', 300),
  }));
}

function respostaFeed(s: Secoes, semente: number, job: 'feed_inicial' | 'lote_diario') {
  const jogador = pessoasEm(s, 'JOGADOR')[0];
  const personagens = pessoasEm(s, 'PERSONAGENS');
  const quantidade = Math.min(Number.parseInt(primeiraLinha(s, 'QUANTIDADE'), 10) || 15, 30);
  const recentes = (s.get('POSTS RECENTES') ?? [])
    .map((l) => /^\[id:([^\]]+)\] autor/.exec(l)?.[1])
    .filter((id): id is string => Boolean(id));
  if (personagens.length === 0) throw new Error('provedor falso: prompt sem PERSONAGENS');
  const posts = Array.from({ length: quantidade }, (_, i) => {
    const autor = escolher(personagens, 0, i);
    const respondeA = i === 0 && recentes[0] ? recentes[0] : i % 4 === 3 ? i - 1 : null;
    return {
      autorId: autor.id,
      texto: cortar(escolher(POSTS, semente, i)(autor, jogador), 220),
      respondeA,
    };
  });
  const [p0, p1] = [escolher(personagens, 0), escolher(personagens, 1)];
  const historias = [
    {
      autorId: p0.id,
      texto: 'bastidor de hoje: muito ensaio e pouca conversa',
      enquete: { pergunta: 'quem domina a semana?', opcoes: [primeiroNome(p0), primeiroNome(p1)] },
    },
    { autorId: p1.id, texto: 'tem novidade chegando e eu não vou contar ainda', enquete: null },
  ];
  const dia = /dia (\d+)/.exec(primeiraLinha(s, 'MOMENTO'))?.[1] ?? '1';
  const lote = job === 'lote_diario';
  const elenco = personagens.find((p) => p.papel !== 'figurante') ?? p0;
  return {
    posts,
    historias,
    resumo: {
      manchete: lote
        ? `Dia ${dia}: o elenco acordou com assunto para o dia inteiro`
        : `${primeiroNome(jogador)} chega e o elenco já tem opinião`,
      pendencias: [{ texto: cortar(`responder ${p0.nome}`, 120), personagemId: p0.id }],
    },
    memorias: lote ? memoriasDe(s.get('MEMÓRIAS PARA RESUMIR') ?? []) : [],
    puxaConversa:
      lote && primeiraLinha(s, 'PODE PUXAR CONVERSA') === 'sim'
        ? {
            personagemId: elenco.id,
            texto: `${primeiroNome(jogador)}, bom dia. vi tudo que rolou ontem e quero conversar`,
          }
        : null,
  };
}

function respostaMemoria(s: Secoes) {
  return { memorias: memoriasDe(s.get('ITENS') ?? []) };
}

function respostaFicha(s: Secoes, semente: number) {
  const existentes = (s.get('EXISTENTES') ?? []).join('\n').toLowerCase();
  const vinculo = primeiraLinha(s, 'VÍNCULO DESEJADO') || 'interesse';
  const tipoVinculo =
    vinculo in FICHAS_VINCULO ? (vinculo as keyof typeof FICHAS_VINCULO) : 'interesse';
  const nome =
    Array.from({ length: NOMES.length }, (_, i) => escolher(NOMES, semente, i)).find(
      (n) => !existentes.includes(n.toLowerCase()) && !existentes.includes(`@${slug(n)}`),
    ) ?? `Pessoa ${semente % 1000}`;
  return {
    nome,
    handle: `@${slug(nome)}`,
    ficha: FICHAS_VINCULO[tipoVinculo],
    tipoVinculo,
    tomAvatar: semente % 2 === 0 ? 'claro' : 'medio',
    verificado: false,
  };
}

function respostaNovoAto(s: Secoes) {
  const ato = Number.parseInt(/(\d+)/.exec(primeiraLinha(s, 'ATO NOVO'))?.[1] ?? '2', 10) || 2;
  return {
    objetivoAto: `Ato ${ato}: manter o holofote e provar que a fama veio para ficar`,
    marcos: [
      { titulo: 'Fama posta à prova', descricao: 'Mostrar que a fama aguenta o novo ritmo.' },
      { titulo: 'Novos rivais', descricao: 'Encarar quem chegou depois e quer o seu lugar.' },
      { titulo: 'Assunto do momento', descricao: 'Dominar as conversas por vários dias seguidos.' },
      { titulo: 'Aliados de peso', descricao: 'Reunir quem pode sustentar a sua carreira.' },
      { titulo: 'Lenda em vida', descricao: 'Fechar o ato como referência do mundo inteiro.' },
    ],
  };
}

export function respostaFalsa(job: NomeJob, prompt: string): unknown {
  const s = lerSecoes(prompt);
  const semente = hash(prompt);
  switch (job) {
    case 'diretor':
      return respostaDiretor(s, semente);
    case 'dm':
      return respostaDm(s, semente);
    case 'discurso':
      return respostaDiscurso(s, semente);
    case 'criar_mundo':
      return respostaCriarMundo(s, semente);
    case 'feed_inicial':
    case 'lote_diario':
      return respostaFeed(s, semente, job);
    case 'memoria':
      return respostaMemoria(s);
    case 'ficha':
      return respostaFicha(s, semente);
    case 'novo_ato':
      return respostaNovoAto(s);
  }
}

/** Estimativa grosseira de tokens: 4 caracteres por token. */
function tokens(texto: string): number {
  return Math.ceil(texto.length / 4);
}

export function criarProvedorFalso(): Provedor {
  return {
    nome: 'falso',
    async gerar(pedido: PedidoGeracao): Promise<RespostaBruta> {
      const inicio = performance.now();
      const prompt = pedido.mensagens.find((m) => m.papel === 'usuario')?.conteudo ?? '';
      const job = /^JOB: (\S+)/.exec(prompt)?.[1] ?? '';
      if (!ehNomeJob(job)) {
        throw new Error(`provedor falso: o prompt não começa com "JOB: <nome>" (veio "${job}")`);
      }
      const texto = JSON.stringify(respostaFalsa(job, prompt));
      const entrada =
        tokens(pedido.sistema) + pedido.mensagens.reduce((n, m) => n + tokens(m.conteudo), 0);
      return {
        texto,
        // Simula cache sempre quente no prefixo, como no Go com x-opencode-session estável.
        uso: { entrada, cache: tokens(pedido.sistema), saida: tokens(texto) },
        modelo: pedido.modelo,
        latenciaMs: Math.round(performance.now() - inicio),
      };
    },
  };
}
