// Jobs feed_inicial (o feed de estreia do mundo) e lote_diario (o feed e o resumo de cada dia).
import {
  aspas,
  limpar,
  momento,
  montarUsuario,
  pessoa,
  secao,
  secaoEstado,
  secaoJogador,
  secaoReatores,
} from './formato';
import type { EntradaFeedInicial, EntradaLoteDiario, ItemMemoria } from './tipos';

const FORMATO_FEED = `FORMATO
{"posts":[{"autorId":"<id de um personagem>","texto":"até 220 caracteres","respondeA":null}],"historias":[{"autorId":"<id>","texto":"até 160 caracteres","enquete":{"pergunta":"até 80 caracteres","opcoes":["até 40","até 40"]}}],"resumo":{"manchete":"até 120 caracteres","pendencias":[{"texto":"até 120 caracteres","personagemId":"<id> ou null"}]},"memorias":[{"personagemId":"<id>","sobreId":"<id>","fatos":"até 300 caracteres"}],"puxaConversa":null}`;

export const TAREFA_FEED_INICIAL = `TAREFA
O mundo acabou de nascer. Escreva o feed de estreia: o que os PERSONAGENS postam no dia em que o jogador chega.
- posts: a quantidade pedida em QUANTIDADE, até 220 caracteres cada, com autores variados (todo o elenco aparece). Alguns comentam ou alfinetam a chegada do jogador; alguns respondem a outros posts, com respondeA igual à posição do post respondido nesta lista (começando em 0). Os outros ficam com respondeA null.
- historias: 2 a 4 histórias (até 160 caracteres), uma delas com enquete (pergunta e 2 a 4 opções curtas). Sem enquete, enquete null.
- resumo: a manchete de estreia (até 120 caracteres) e até 3 pendências para o jogador (até 120 cada), com o personagemId de quem estiver envolvido.
- memorias: lista vazia. puxaConversa: null.
- Os autores são só os PERSONAGENS. O jogador nunca é autor.

${FORMATO_FEED}`;

export const TAREFA_LOTE_DIARIO = `TAREFA
Começa um novo dia no mundo. Escreva o feed do dia e o resumo da manhã para o jogador.
- posts: a quantidade pedida em QUANTIDADE, até 220 caracteres cada, com autores variados. Reaja ao que aconteceu ONTEM e às relações. respondeA é a posição de outro post desta lista (número, começando em 0), o id de um POST RECENTE (texto) ou null.
- historias: 2 a 5 histórias (até 160 caracteres), no máximo 2 com enquete (pergunta e 2 a 4 opções curtas).
- resumo: a manchete do dia (até 120 caracteres) e até 3 pendências para o jogador (até 120 cada), com o personagemId de quem estiver envolvido. Use os NÚMEROS DO DIA como estão.
- memorias: para cada item de MEMÓRIAS PARA RESUMIR, reescreva os fatos juntando o antigo e o novo (até 300 caracteres, só fatos concretos). Sem itens, lista vazia.
- puxaConversa: se PODE PUXAR CONVERSA for sim, um personagem do elenco manda a primeira mensagem do dia para o jogador (até 220 caracteres); se for não, null.
- Os autores são só os PERSONAGENS. O jogador nunca é autor.

${FORMATO_FEED}`;

function secaoEvento(evento: EntradaFeedInicial['evento']): string | null {
  if (!evento) return null;
  return secao('EVENTO AGENDADO', [
    `${limpar(evento.titulo, 80)} · categoria: ${limpar(evento.categoria, 80)} · quando: ${limpar(evento.quando, 40)}`,
  ]);
}

export function blocoItemMemoria(item: ItemMemoria): string {
  return [
    `- ${pessoa(item.personagem)} lembra de ${pessoa(item.sobre)}`,
    `  fatos atuais: ${item.fatosAtuais ? limpar(item.fatosAtuais, 400) : 'nenhum'}`,
    `  eventos novos: ${item.eventosNovos.map((e) => limpar(e, 160)).join('; ') || 'nenhum'}`,
  ].join('\n');
}

export function promptFeedInicial(entrada: EntradaFeedInicial): string {
  const quantidade = entrada.quantidadePosts ?? 15;
  return montarUsuario('feed_inicial', [
    TAREFA_FEED_INICIAL,
    secao('QUANTIDADE', [`${quantidade} posts`]),
    secao('MOMENTO', [momento(entrada.momento)]),
    secao('OBJETIVO DO ATO', [limpar(entrada.objetivoAto, 160)]),
    entrada.marcoAtual ? secao('MARCO ATUAL', [limpar(entrada.marcoAtual, 120)]) : null,
    secaoEvento(entrada.evento),
    secaoJogador(entrada.jogador),
    secaoReatores('PERSONAGENS', entrada.personagens),
  ]);
}

export function promptLoteDiario(entrada: EntradaLoteDiario): string {
  const quantidade = entrada.quantidadePosts ?? 20;
  const recentes = entrada.postsRecentes ?? [];
  const memorias = entrada.memoriasParaResumir ?? [];
  return montarUsuario('lote_diario', [
    TAREFA_LOTE_DIARIO,
    secao('QUANTIDADE', [`${quantidade} posts`]),
    secaoEstado(entrada.resumoEstado),
    secao('MOMENTO', [momento(entrada.momento)]),
    entrada.objetivoAto ? secao('OBJETIVO DO ATO', [limpar(entrada.objetivoAto, 160)]) : null,
    secaoEvento(entrada.evento),
    secao(
      'ONTEM',
      entrada.ontem.map((fato) => `- ${limpar(fato, 200)}`),
    ),
    secao(
      'NÚMEROS DO DIA',
      entrada.numerosDia.map((n) => `- ${limpar(n.rotulo, 60)}: ${limpar(n.valor, 40)}`),
    ),
    secaoJogador(entrada.jogador),
    secaoReatores('PERSONAGENS', entrada.personagens),
    recentes.length > 0
      ? secao(
          'POSTS RECENTES',
          recentes.map((p) => `[id:${p.id}] autor [id:${p.autorId}]: ${aspas(p.texto, 220)}`),
        )
      : null,
    memorias.length > 0
      ? `MEMÓRIAS PARA RESUMIR\n${memorias.map(blocoItemMemoria).join('\n')}`
      : null,
    secao('PODE PUXAR CONVERSA', [entrada.podePuxarConversa ? 'sim' : 'não']),
  ]);
}
