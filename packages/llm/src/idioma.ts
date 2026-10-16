// Heurísticas simples de idioma e emoji para os textos gerados.
// Não é detecção de idioma de verdade: barra o caso comum (resposta em inglês ou espanhol)
// e deixa passar texto curto sem sinal nenhum ("kkkk", nomes, "Team Vic").

const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{20E3}]/u;

export function temEmoji(texto: string): boolean {
  return EMOJI.test(texto);
}

const PT = new Set(
  (
    'e o de da do das dos que não nao é um uma com para pra pro os as se na no nas nos em eu você voce vc ' +
    'tá ta está isso essa esse esta este mais mas muito muita já ja quem como sobre meu minha seu sua ' +
    'ele ela eles elas gente também tambem hoje aqui ainda só ao à pelo pela foi ser ter tem vai vou ' +
    'quando onde porque por sem até nem nunca sempre agora todo toda tudo nada né ne ué oi olá bom boa ' +
    'ninguém alguém então entao aí ai vocês nós nosso nossa dela dele num numa depois antes ' +
    'sim fala tô to sou era fica ficou mesmo'
  ).split(/\s+/),
);

const EN = new Set(
  (
    "the and is are you your of to with this that it for my i i'm be was were have has what just not " +
    "but they we he she will can don't from at on in an our their there here about would could should " +
    'been being do does did yes no'
  ).split(/\s+/),
);

const ES = new Set(
  'el los las y pero muy también hola gracias usted esto eso ellos nosotros del hay soy estoy'.split(
    /\s+/,
  ),
);

/**
 * true se o texto parece português (ou não tem sinal de outro idioma).
 * Falha quando palavras funcionais de inglês ou espanhol superam as de português (pelo menos 2).
 */
export function parecePortugues(texto: string): boolean {
  const minusculo = texto.toLowerCase();
  if (/[¿¡ñ]/.test(minusculo)) return false;
  const palavras = minusculo.split(/[^\p{L}']+/u).filter(Boolean);
  let pt = /[ãõç]/.test(minusculo) ? 2 : 0;
  let en = 0;
  let es = 0;
  for (const palavra of palavras) {
    if (PT.has(palavra)) pt += 1;
    if (EN.has(palavra)) en += 1;
    if (ES.has(palavra)) es += 1;
  }
  if (en >= 2 && en > pt) return false;
  if (es >= 2 && es > pt) return false;
  return true;
}
