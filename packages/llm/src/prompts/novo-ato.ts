// Job novo_ato: o jogador resgatou o último marco do ato, então o mundo ganha o próximo ato
// (objetivo e cinco marcos). A bíblia vai no prefixo; os números dos marcos são do motor.
import { aspas, limpar, montarUsuario, secao, secaoEstado, secaoJogador } from './formato';
import type { EntradaNovoAto } from './tipos';

export const TAREFA_NOVO_ATO = `TAREFA
O jogador cumpriu os marcos do ato anterior e o mundo vira a página. Escreva o ATO NOVO deste mesmo mundo, de acordo com a bíblia, o ESTADO DO MUNDO e o JOGADOR. A história avança: mais fama, desafios novos e maiores, sem repetir os marcos já cumpridos nem desfazer o que aconteceu.
- objetivoAto: o objetivo do ato novo para o jogador, até 120 caracteres, mais ambicioso que o do ato anterior.
- marcos: exatamente 5 marcos do ato novo, do mais fácil ao mais difícil (titulo até 60, descricao até 200). Cada um sobe a aposta em relação ao anterior. Sem números de requisito: o motor define.
- Use o elenco e o universo da bíblia; pessoas novas entram depois, pelos marcos.

FORMATO
{"objetivoAto":"...","marcos":[{"titulo":"...","descricao":"..."}]}`;

export function promptNovoAto(entrada: EntradaNovoAto): string {
  return montarUsuario('novo_ato', [
    TAREFA_NOVO_ATO,
    secao('ATO NOVO', [`ato ${entrada.ato}`]),
    secao('OBJETIVO DO ATO ANTERIOR', [aspas(entrada.objetivoAnterior, 160)]),
    secao(
      'MARCOS CUMPRIDOS',
      entrada.marcosCumpridos.map((titulo) => `- ${limpar(titulo, 80)}`),
    ),
    secaoEstado(entrada.resumoEstado),
    secaoJogador(entrada.jogador),
  ]);
}
