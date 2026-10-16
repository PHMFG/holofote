// Job diretor: reações do elenco a post, comentário ou resposta a história.
import {
  aspas,
  momento,
  montarUsuario,
  pessoa,
  secao,
  secaoEstado,
  secaoJogador,
  secaoNumeros,
  secaoReatores,
} from './formato';
import type { EntradaDiretor } from './tipos';

export const TAREFA_DIRETOR = `TAREFA
O jogador acabou de agir na rede. Escreva como os REATORES reagem, cada um com a própria voz.
- No máximo uma reação por reator, até 5. Quem não teria motivo para reagir fica de fora.
- tipo "resposta" responde direto na conversa; "citacao" compartilha o post com um comentário para os próprios seguidores; "dm" é mensagem privada para o jogador.
- Numa resposta a história, o autor da história responde por "dm".
- atrasoSeg (inteiro de 20 a 900) é quando a reação chega: afinidade extrema e quem foi marcado respondem rápido; os outros demoram.
- cartao resume a consequência para o jogador como manchete de bastidor, usando os NÚMEROS DO MOTOR.
- deltasSugeridos são só sugestões, o motor decide: alvo "fama", "carisma", "polemica", "seguidores" ou "relacao:<id do reator>".
- memorias: o que um reator vai lembrar desta ação (até 100 caracteres), só se for marcante.
- Se o texto do jogador quebrar as regras de conteúdo, devolva reacoes vazias e moderacao com ok false e um motivo curto.

FORMATO
{"reacoes":[{"personagemId":"<id de um reator>","tipo":"resposta|citacao|dm","texto":"até 220 caracteres","atrasoSeg":45}],"cartao":{"titulo":"até 60 caracteres","texto":"até 240 caracteres"},"deltasSugeridos":[{"alvo":"relacao:<id>","valor":-2}],"memorias":[{"personagemId":"<id>","fato":"até 100 caracteres"}],"moderacao":{"ok":true}}`;

const TIPOS = {
  post: 'post no feed',
  resposta: 'comentário numa conversa',
  resposta_historia: 'resposta a uma história',
} as const;

export function promptDiretor(entrada: EntradaDiretor): string {
  const { acao } = entrada;
  const marcados = acao.marcados ?? [];
  return montarUsuario('diretor', [
    TAREFA_DIRETOR,
    secaoEstado(entrada.resumoEstado),
    entrada.momento ? secao('MOMENTO', [momento(entrada.momento)]) : null,
    secaoJogador(entrada.jogador),
    secao('AÇÃO DO JOGADOR', [
      `tipo: ${TIPOS[acao.tipo]}${acao.tom ? ` · tom: ${acao.tom}` : ''}`,
      acao.emResposta
        ? `em resposta a ${pessoa(acao.emResposta.autor)}: ${aspas(acao.emResposta.texto, 280)}`
        : null,
      marcados.length > 0 ? `marcados: ${marcados.map(pessoa).join(', ')}` : null,
      `texto: ${aspas(acao.texto, 280)}`,
    ]),
    secaoNumeros('NÚMEROS DO MOTOR', entrada.numeros, entrada.reatores),
    secaoReatores('REATORES', entrada.reatores.slice(0, 5)),
  ]);
}
