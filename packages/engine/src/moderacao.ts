// Filtro local de moderação, rodado pela API antes de debitar energia. É a primeira barreira:
// a IA ainda devolve o próprio veredito (moderacao.ok) na resposta do diretor.
// As listas são de partida e devem crescer com os casos reais.

export type CategoriaModeracao = 'menores' | 'violencia' | 'odio' | 'dados_pessoais';

export type ResultadoModeracao =
  { ok: true } | { ok: false; categoria: CategoriaModeracao; motivo: string };

/** Frase curta mostrada ao jogador quando o texto é barrado. */
export const MOTIVOS_MODERACAO: Readonly<Record<CategoriaModeracao, string>> = {
  menores: 'Esse texto sexualiza menores de idade.',
  violencia: 'Esse texto tem ameaça ou violência explícita.',
  odio: 'Esse texto tem discurso de ódio.',
  dados_pessoais: 'Não publique dados pessoais como CPF, telefone ou e-mail.',
};

const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
};

/** Minúsculas e sem acentos. */
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Forma usada para buscar termos: sem acento, leetspeak desfeito, só letras e espaços,
 * letras repetidas 3 ou mais vezes reduzidas a uma ("mataaar" vira "matar").
 */
function paraBusca(texto: string): string {
  return semAcento(texto)
    .replace(/[0134578@$]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]+/g, ' ')
    .replace(/([a-z])\1{2,}/g, '$1')
    .trim();
}

function contemTermo(busca: string, termos: readonly string[]): boolean {
  const comBordas = ` ${busca} `;
  return termos.some((termo) => comBordas.includes(` ${termo} `));
}

const ODIO = [
  'viado',
  'viadinho',
  'traveco',
  'sapatao',
  'bichona',
  'boiola',
  'baitola',
  'crioulo',
  'macaco imundo',
  'macaca imunda',
  'volta pra senzala',
  'volta para senzala',
  'raca inferior',
  'heil hitler',
  'sieg heil',
  'judeu safado',
  'nordestino burro',
  'preto safado',
  'tinha que ser preto',
  'morte aos gays',
  'morte aos judeus',
].map(paraBusca);

const INTENCAO = '(?:vou|vamos|vai|vao|quero|deveria|devia|deviam|merece|mereceu)';
const VERBO_VIOLENTO =
  '(?:matar|esfaquear|espancar|degolar|enforcar|estrangular|esquartejar|decapitar|executar|torturar)';
const PESSOA =
  '(?:voce|voces|vc|vcs|tu|ela|ele|elas|eles|todos|todas|essa|esse|aquela|aquele|seu|sua|teu|tua)';

/** Ameaça precisa de alvo pessoal: "vou te matar" barra, "vou matar a saudade" passa. */
const VIOLENCIA = [
  new RegExp(`\\b${INTENCAO}\\s+(?:te|lhe)\\s+${VERBO_VIOLENTO}\\b`),
  new RegExp(`\\b${INTENCAO}\\s+${VERBO_VIOLENTO}\\s+${PESSOA}\\b`),
  /\b(?:te|eu te)\s+(?:mato|esfaqueio|espanco|degolo|enforco|estrangulo|torturo)\b/,
  /\b(?:tiro na cara|meter bala|encher de bala|cortar (?:sua|tua|a) garganta|arrancar (?:sua|tua|a) cabeca)\b/,
  /\b(?:estupr|esquartej|decapit)[a-z]*\b/,
];

const MENORES_DIRETO = [
  'pedofilia',
  'pedofilo',
  'pedofila',
  'pornografia infantil',
  'porno infantil',
  'sexo com crianca',
  'sexo com menor',
  'nude de menor',
  'nudes de menor',
].map(paraBusca);

const TERMOS_MENOR = [
  'crianca',
  'criancinha',
  'menor de idade',
  'menor',
  'menininha',
  'menininho',
  'pre adolescente',
  'infantil',
].map(paraBusca);

/** Idade de menor junto de quem ("menina de 12 anos") ou no diminutivo ("12 aninhos"). */
const IDADE_DE_MENOR =
  /\b(?:(?:menina|menino|garota|garoto|crianca|filha|filho|novinha|novinho)\s+(?:de\s+)?(?:[1-9]|1[0-7])\s*anos|(?:[1-9]|1[0-7])\s*aninhos)\b/;

const TERMOS_SEXUAIS = [
  'sexo',
  'sexual',
  'sensual',
  'transar',
  'nude',
  'nudes',
  'nua',
  'pelado',
  'porno',
  'pornografia',
  'erotico',
  'erotica',
  'tesao',
].map(paraBusca);

const CPF = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}[-.\s]?\d{2}(?!\d)/;
/** Com DDD (fixo ou celular) ou celular com o 9 na frente; "2025-2026" não conta. */
const TELEFONE = /(?<!\d)(?:\+?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?9?\d{4}|9\d{4})[\s.-]?\d{4}(?!\d)/;
const EMAIL = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;

function categoriaDe(texto: string): CategoriaModeracao | null {
  const simples = semAcento(texto);
  const busca = paraBusca(texto);

  const falaDeMenor = contemTermo(busca, TERMOS_MENOR) || IDADE_DE_MENOR.test(simples);
  if (contemTermo(busca, MENORES_DIRETO) || (falaDeMenor && contemTermo(busca, TERMOS_SEXUAIS))) {
    return 'menores';
  }
  if (VIOLENCIA.some((padrao) => padrao.test(busca))) return 'violencia';
  if (contemTermo(busca, ODIO)) return 'odio';
  if (CPF.test(texto) || TELEFONE.test(texto) || EMAIL.test(texto)) return 'dados_pessoais';
  return null;
}

/** Filtro local: ódio, violência explícita, sexualização de menores e dados pessoais. */
export function moderarTexto(texto: string): ResultadoModeracao {
  const categoria = categoriaDe(texto);
  return categoria === null
    ? { ok: true }
    : { ok: false, categoria, motivo: MOTIVOS_MODERACAO[categoria] };
}

/**
 * Pessoas reais conhecidas. O elenco é sempre fictício: nomes daqui são recusados na persona e
 * na criação de personagens.
 */
export const PESSOAS_REAIS: readonly string[] = [
  // Brasil
  'Anitta',
  'Ivete Sangalo',
  'Ludmilla',
  'Luísa Sonza',
  'Pabllo Vittar',
  'Gloria Groove',
  'Marília Mendonça',
  'Gusttavo Lima',
  'Caetano Veloso',
  'Gilberto Gil',
  'Roberto Carlos',
  'Xuxa',
  'Silvio Santos',
  'Faustão',
  'Luciano Huck',
  'Ana Maria Braga',
  'Tatá Werneck',
  'Bruna Marquezine',
  'Marina Ruy Barbosa',
  'Gisele Bündchen',
  'Neymar',
  'Ronaldinho',
  'Vini Jr',
  'Vinícius Júnior',
  'Rebeca Andrade',
  'Whindersson Nunes',
  'Felipe Neto',
  'Virginia Fonseca',
  'Juliette Freire',
  'Casimiro Miguel',
  'Lula',
  'Bolsonaro',
  // Internacionais
  'Taylor Swift',
  'Beyoncé',
  'Rihanna',
  'Lady Gaga',
  'Ariana Grande',
  'Billie Eilish',
  'Dua Lipa',
  'Shakira',
  'Madonna',
  'Justin Bieber',
  'Selena Gomez',
  'Kim Kardashian',
  'Kanye West',
  'Bad Bunny',
  'Harry Styles',
  'Olivia Rodrigo',
  'Sabrina Carpenter',
  'Bruno Mars',
  'Ed Sheeran',
  'The Weeknd',
  'Zendaya',
  'Cristiano Ronaldo',
  'Lionel Messi',
  'Elon Musk',
  'Donald Trump',
  'Barack Obama',
  'Michael Jackson',
];

const PESSOAS_BUSCA = PESSOAS_REAIS.map((nome) => {
  const busca = paraBusca(nome);
  return { busca, junto: busca.replace(/ /g, ''), composto: busca.includes(' ') };
});

/**
 * O nome parece de uma pessoa real conhecida? Casa palavras inteiras ("Lua Anitta Prado") e,
 * para nomes compostos, também a forma colada de handle ("@taylorswift13").
 */
export function pareceNomeDePessoaReal(nome: string): boolean {
  const busca = paraBusca(nome);
  const junto = busca.replace(/ /g, '');
  return PESSOAS_BUSCA.some(
    (p) => contemTermo(busca, [p.busca]) || (p.composto && junto.includes(p.junto)),
  );
}
