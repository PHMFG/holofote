// Job dm: resposta do personagem numa mensagem direta.
// O histórico nunca vai inteiro: vai o resumo da conversa e as últimas 4 mensagens.
import {
  aspas,
  limpar,
  montarUsuario,
  secao,
  secaoEstado,
  secaoJogador,
  secaoNumeros,
  secaoReatores,
} from './formato';
import type { EntradaDm } from './tipos';

export const ULTIMAS_MENSAGENS_DM = 4;

export const TAREFA_DM = `TAREFA
Responda à mensagem direta do jogador como o PERSONAGEM, no tom de conversa privada.
- 1 a 3 mensagens curtas (até 220 caracteres cada), como quem digita em sequência.
- resumoConversa: reescreva o resumo da conversa inteira já com esta troca (até 400 caracteres), em terceira pessoa.
- deltaSugerido: de -3 a 3, quanto esta troca muda a afinidade do personagem com o jogador. O motor decide o valor final.
- memoria: um fato novo que o personagem vai lembrar do jogador (até 100 caracteres), ou null.

FORMATO
{"mensagens":["até 220 caracteres"],"resumoConversa":"até 400 caracteres","deltaSugerido":1,"memoria":null}`;

export function promptDm(entrada: EntradaDm): string {
  const nome = limpar(entrada.personagem.nome, 60);
  const ultimas = entrada.ultimas
    .slice(-ULTIMAS_MENSAGENS_DM)
    .map((m) => `${m.autor === 'jogador' ? 'jogador' : nome}: ${aspas(m.texto, 280)}`);
  return montarUsuario('dm', [
    TAREFA_DM,
    secaoEstado(entrada.resumoEstado),
    secaoJogador(entrada.jogador),
    secaoReatores('PERSONAGEM', [entrada.personagem]),
    secao('RESUMO DA CONVERSA', [
      entrada.resumoConversa ? limpar(entrada.resumoConversa, 600) : 'primeira conversa',
    ]),
    secao('ÚLTIMAS MENSAGENS', ultimas),
    entrada.historia
      ? secao('HISTÓRIA RESPONDIDA', [`texto: ${aspas(entrada.historia.texto, 200)}`])
      : null,
    secao('NOVA MENSAGEM DO JOGADOR', [aspas(entrada.mensagem, 280)]),
    secaoNumeros('NÚMEROS DO MOTOR', entrada.numeros, [entrada.personagem]),
  ]);
}
