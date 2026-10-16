// Prefixo do prompt de sistema: regras fixas + bíblia do mundo.
// Tem de ser idêntico byte a byte entre chamadas do mesmo mundo, para o cache de prompt do Go.
// Por isso é uma função pura da bíblia: nada de data, hora, contador ou dado do jogador.
import { REGRAS_ESTILO } from './estilo';

const SEM_BIBLIA = 'O mundo ainda não existe: ele nasce nesta tarefa.';

/** Normaliza quebras de linha e espaços para a mesma bíblia sempre gerar o mesmo texto. */
function normalizarBiblia(biblia: string): string {
  return biblia
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((linha) => linha.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function montarPrefixo({ biblia }: { biblia: string | null | undefined }): string {
  const corpo = biblia && biblia.trim() !== '' ? normalizarBiblia(biblia) : SEM_BIBLIA;
  return `${REGRAS_ESTILO}\n\nBÍBLIA DO MUNDO\n${corpo}\n`;
}
