# Contratos da API

Fonte única: `packages/shared/src/contratos.ts` (schemas Zod). O servidor valida entrada e saída com eles e o app tipa as respostas por eles. Esta página é o índice legível.

- Base: `http://localhost:3333/v1` em desenvolvimento.
- Autenticação: `Authorization: Bearer <token>` em todas as rotas, menos `POST /v1/auth/anonimo`.
- Erros: corpo `Erro` `{ erro, mensagem }` com código estável. Os principais:

| Código               | HTTP        | Quando                                                                                                                   |
| -------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `invalido`           | 400/413/415 | Corpo ou parâmetros fora do schema, JSON malformado, cursor inválido, corpo grande demais ou tipo de conteúdo não aceito |
| `nao_autenticado`    | 401         | Token ausente ou inválido                                                                                                |
| `nao_encontrado`     | 404         | Recurso de outro mundo ou inexistente (inclui história vencida)                                                          |
| `sem_energia`        | 409         | A ação custa mais que a energia atual (nada é debitado)                                                                  |
| `sem_gemas`          | 409         | Recarga por gemas sem saldo                                                                                              |
| `energia_cheia`      | 409         | Recarga por gemas com a barra cheia (nada é cobrado)                                                                     |
| `limite_anuncio`     | 409         | Já usou os 3 anúncios do dia                                                                                             |
| `desfazer_expirado`  | 409         | Não é a última ação, passou de 60 min, já foi desfeita ou o tipo não se desfaz                                           |
| `mundo_existente`    | 409         | O usuário já tem um mundo ativo (também em dois `POST /mundos` simultâneos)                                              |
| `mundo_criando`      | 409         | O mundo ainda está sendo gerado pela IA                                                                                  |
| `marco_bloqueado`    | 409         | Resgate de um marco que ainda não foi liberado                                                                           |
| `marco_resgatado`    | 409         | O marco já foi resgatado                                                                                                 |
| `campanha_encerrada` | 409         | Ação de campanha depois que o evento entrou ao vivo ou encerrou                                                          |
| `campanha_feita`     | 409         | Essa ação de campanha já foi feita neste evento                                                                          |
| `evento_fora_do_ar`  | 409         | Discurso com o evento fora do ao vivo (antes da hora ou já encerrado)                                                    |
| `discurso_bloqueado` | 409         | Opção de discurso não liberada, ou `ousado`/`especial` depois dos 30 s de `prazoAoVivo` ("O tempo acabou.")              |
| `moderacao`          | 422         | Texto barrado pelo filtro local (nada é debitado)                                                                        |
| `interno`            | 500         | Erro inesperado do servidor                                                                                              |

O evento entra ao vivo no dia marcado a partir da hora local em que o período começa (manhã 6h, tarde 12h, noite 18h) e dá 30 s (`prazoAoVivo`) para escolher o discurso; depois disso só o `seguro` vale.

## Rotas

| Método e rota                     | Corpo                                           | Resposta                                                                                                                                                                                                              | Energia |
| --------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `POST /auth/anonimo`              | `PedidoAuth`                                    | `RespostaAuth`                                                                                                                                                                                                        | —       |
| `GET /conta`                      | —                                               | `Conta`                                                                                                                                                                                                               | —       |
| `PATCH /conta/aparencia`          | `Aparencia`                                     | `Conta`                                                                                                                                                                                                               | —       |
| `POST /conta/plus`                | `{ ativo: boolean }`                            | `Conta` (placebo, sem cobrança)                                                                                                                                                                                       | —       |
| `POST /mundos`                    | `PedidoCriarMundo`                              | `Mundo` em `criando`; o job `criar_mundo` avisa pelo WS                                                                                                                                                               | —       |
| `GET /mundos/atual`               | —                                               | `Mundo`                                                                                                                                                                                                               | —       |
| `DELETE /mundos/atual`            | —                                               | 204 (recomeçar: apaga o mundo; energia e gemas ficam na conta)                                                                                                                                                        | —       |
| `GET /mundos/:id/feed?cursor=`    | —                                               | `RespostaFeed`                                                                                                                                                                                                        | —       |
| `POST /posts/previa`              | `PedidoPost`                                    | `RespostaPrevia`                                                                                                                                                                                                      | 0       |
| `POST /posts`                     | `PedidoPost`                                    | 201 `RespostaAcaoComPost`                                                                                                                                                                                             | 1       |
| `GET /posts/:id`                  | —                                               | `Post`                                                                                                                                                                                                                | —       |
| `POST /posts/:id/curtir`          | —                                               | `Post` (alterna)                                                                                                                                                                                                      | 0       |
| `GET /posts/:id/respostas`        | —                                               | `RespostaThread`                                                                                                                                                                                                      | —       |
| `POST /posts/:id/respostas`       | `PedidoTexto`                                   | 201 `RespostaAcaoComPost`                                                                                                                                                                                             | 1       |
| `GET /historias/:id`              | —                                               | `Post` (marca como vista)                                                                                                                                                                                             | —       |
| `POST /historias/:id/voto`        | `PedidoVoto`                                    | `Post`                                                                                                                                                                                                                | 0       |
| `POST /historias/:id/resposta`    | `PedidoTexto`                                   | 201 `RespostaMensagem` (vira DM)                                                                                                                                                                                      | 1       |
| `GET /conversas`                  | —                                               | `Conversa[]` (as silenciadas vêm com `silenciada`)                                                                                                                                                                    | —       |
| `POST /personagens/:id/conversa`  | —                                               | `Conversa` (abre ou devolve a existente)                                                                                                                                                                              | —       |
| `GET /conversas/:id/mensagens`    | —                                               | `Mensagem[]` (zera não lidas)                                                                                                                                                                                         | —       |
| `POST /conversas/:id/mensagens`   | `PedidoTexto`                                   | 201 `RespostaMensagem`                                                                                                                                                                                                | 1       |
| `GET /personagens/:id`            | —                                               | `Personagem`                                                                                                                                                                                                          | —       |
| `POST /personagens/:id/silenciar` | `PedidoSilenciar` (`{ silenciado }`)            | `Personagem` (silenciado sai do feed e das mensagens; o jogador: 400)                                                                                                                                                 | —       |
| `GET /relacoes`                   | —                                               | `RespostaRelacoes`                                                                                                                                                                                                    | —       |
| `GET /alertas`                    | —                                               | `Alerta[]`                                                                                                                                                                                                            | —       |
| `POST /alertas/lidos`             | —                                               | 204                                                                                                                                                                                                                   | —       |
| `GET /registro`                   | —                                               | `ItemRegistro[]`                                                                                                                                                                                                      | —       |
| `POST /acoes/:id/desfazer`        | —                                               | `Consequencia`                                                                                                                                                                                                        | 2       |
| `GET /jornada`                    | —                                               | `Jornada`                                                                                                                                                                                                             | —       |
| `POST /marcos/:id/resgatar`       | —                                               | `Conta`                                                                                                                                                                                                               | —       |
| `GET /jornada` (virada de ato)    | —                                               | `Jornada` com `proximoAto: { ato }` (opcional) enquanto a IA escreve o ato seguinte, depois do 5º marco resgatado; o resgate do 5º marco enfileira o job `novo_ato` e o evento `mundo` avisa quando o ato novo começa | —       |
| `GET /eventos/:id`                | —                                               | `EventoAgendado`                                                                                                                                                                                                      | —       |
| `POST /eventos/:id/campanha`      | `PedidoCampanha`                                | `RespostaEventoComConsequencia`                                                                                                                                                                                       | 1 ou 2  |
| `POST /eventos/:id/discurso`      | `PedidoDiscurso`                                | `RespostaEventoComConsequencia`                                                                                                                                                                                       | 0       |
| `GET /energia`                    | —                                               | `EstadoEnergia`                                                                                                                                                                                                       | —       |
| `POST /energia/recarga`           | `PedidoRecarga` (`gemas`, `anuncio` ou `debug`) | `RespostaRecarga` (gemas com a barra cheia: 409 `energia_cheia`)                                                                                                                                                      | —       |
| `GET /resumo-do-dia`              | —                                               | `ResumoDia`                                                                                                                                                                                                           | —       |

Rotas de desenvolvimento (só com `AMBIENTE=dev`):

| Método e rota       | Faz                                                                     |
| ------------------- | ----------------------------------------------------------------------- |
| `POST /dev/relogio` | `PedidoRelogio`: avança o relógio do mundo (recarga, períodos, eventos) |
| `POST /dev/lote`    | Roda o lote diário do mundo agora                                       |
| `GET /dev/custos`   | Soma de `chamada_llm` do dia e por job                                  |

A recarga `debug` também fica disponível fora do modo dev durante o MVP, pedida pelo dono.

## Tempo real

`WS /v1/tempo-real?token=<jwt>` entrega `EventoTempoReal` do canal Redis `mundo:<id>` do mundo do usuário:

| tipo        | Quando                                                                     |
| ----------- | -------------------------------------------------------------------------- |
| `post`      | Post, resposta ou história que chegou na hora marcada (`entregarEm`)       |
| `digitando` | Um personagem começou a escrever (DM ou resposta)                          |
| `mensagem`  | Mensagem direta entregue                                                   |
| `alerta`    | Alerta novo                                                                |
| `energia`   | Energia mudou (gasto, recarga, marco)                                      |
| `cartao`    | Cartão de consequência escrito pela IA para uma ação                       |
| `mundo`     | Mudança de estado do mundo (`criando` para `pronto` ou `erro`)             |
| `mundo`     | Ato novo começou (`mundo.ato` e `objetivoAto` mudam): o app relê a jornada |
| `evento`    | Evento agendado mudou (campanha, ao vivo, vencedor)                        |
