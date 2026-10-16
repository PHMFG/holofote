// Job discurso: manchete e reações ao discurso do jogador no evento ao vivo.
import {
  limpar,
  montarUsuario,
  pessoa,
  secao,
  secaoEstado,
  secaoJogador,
  secaoNumeros,
  secaoReatores,
} from './formato';
import type { EntradaDiscurso } from './tipos';

export const TAREFA_DISCURSO = `TAREFA
O evento ao vivo acabou e o jogador fez o discurso escolhido. Escreva a manchete do momento e como os REATORES reagem.
- O RESULTADO já foi sorteado pelo motor: respeite quem venceu e não mude números.
- manchete até 120 caracteres, no tom de portal de fofoca do mundo.
- Até 5 reações (até 220 caracteres cada), no máximo uma por reator, com atrasoSeg inteiro de 20 a 900.

FORMATO
{"manchete":"até 120 caracteres","reacoes":[{"personagemId":"<id de um reator>","texto":"até 220 caracteres","atrasoSeg":30}]}`;

const TIPOS_EVENTO = { premio: 'premiação', show: 'show', crise: 'crise' } as const;
const OPCOES = { seguro: 'seguro', ousado: 'ousado', especial: 'especial' } as const;

export function promptDiscurso(entrada: EntradaDiscurso): string {
  const { evento, discurso, resultado } = entrada;
  return montarUsuario('discurso', [
    TAREFA_DISCURSO,
    secaoEstado(entrada.resumoEstado),
    secao('EVENTO', [
      `${TIPOS_EVENTO[evento.tipo]}: ${limpar(evento.titulo, 80)} · categoria: ${limpar(evento.categoria, 80)}`,
    ]),
    secao('RESULTADO', [
      `o jogador venceu: ${resultado.jogadorVenceu ? 'sim' : 'não'}`,
      resultado.vencedor ? `vencedor: ${pessoa(resultado.vencedor)}` : null,
    ]),
    secao('DISCURSO ESCOLHIDO', [`${OPCOES[discurso.opcao]}: ${limpar(discurso.titulo, 120)}`]),
    secaoNumeros('NÚMEROS DO MOTOR', entrada.numeros, entrada.reatores),
    secaoJogador(entrada.jogador),
    secaoReatores('REATORES', entrada.reatores.slice(0, 5)),
  ]);
}
