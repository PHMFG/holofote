# Holofote · Plano de implementação

Oct 16, 2026 · @Paulino

## Visão geral

O Holofote é uma rede social em que só o jogador é humano: todo o resto do elenco é IA e reage ao que ele posta, comenta e manda por mensagem. Este plano leva um agente de IA (Claude Code) do repositório vazio até um MVP jogável no Simulador do iPhone 16e, com backend próprio e a chave do OpenCode Go como provedor de modelos.

**Objetivo do MVP:** um jogador cria mundo e persona, posta, lê e responde comentários, conversa por DM, recebe consequências numéricas, avança marcos e joga um evento ao vivo, com custo médio abaixo de US$ 0,03 por jogador ativo por dia.

**Decisões travadas (não reabrir sem pedir ao dono do projeto):**

- **Plataforma:** só iOS, só iPhone, retrato. Alvo de referência: iPhone 16e. Sem iPad, sem Android no MVP.
- **App:** Expo (React Native) com TypeScript e Expo Router, conforme o diagrama de arquitetura. Build de desenvolvimento nativo, não Expo Go.
- **Backend:** TypeScript em Node.js, monorepo com o app. PostgreSQL com pgvector, Redis, fila de jobs, WebSocket.
- **IA:** a chave do OpenCode Go fica só no servidor. O app nunca chama modelo direto.
- **Padrão diretor:** no máximo uma chamada de LLM por ação do jogador. Números saem do motor de regras, nunca do modelo.
- **Energia = orçamento de tokens:** toda ação que pode chamar IA debita energia antes.
- **Design:** sistema "Cromo" do Figma, tema claro e escuro, seis cores de destaque escolhidas pelo jogador.
- **Idioma:** interface, personagens e textos gerados em português do Brasil.

**Fontes do projeto (o agente deve consultar antes de cada fase):**

| Material | Onde | Para quê |
| --- | --- | --- |
| Telas e design system | [Figma · Holofote](https://www.figma.com/design/z4hwlJgPHTikSzQ9yfjAI9) | 21 telas claras e escuras, variáveis Cromo e Destaque, estilos, componentes, landing |
| Diagramas | [FigJam · arquitetura](https://www.figma.com/board/BIdqslgCk3fxoYDOaoTZ6U) | Casos de uso, arquitetura, sequência de um post, decisão de tokens, modelo ER |
| Especificação de arquitetura | [Doc de arquitetura e custos](https://claude.ai/code/artifact/a8d6fec5-d79f-4079-98b8-e050017540ab) | Racional do padrão diretor, cache, lote e roteador de modelos |

## Alvo e ambiente de desenvolvimento

O app é desenhado e testado para o iPhone 16e: tela de 390 × 844 pontos em 3x, com notch, 60 Hz e chip A18. O agente desenvolve num Mac com Claude Code, Xcode e o Simulador configurado como iPhone 16e. O aparelho físico entra só na fase de teste real.

**O que o iPhone 16e impõe ao app:**

| Característica | Valor | Consequência no código |
| --- | --- | --- |
| Tela | 6,1", 2532 × 1170 px, 460 ppi, 390 × 844 pt em 3x | O Figma já usa 390 × 844. Exportar ícones e esferas em @3x |
| Topo | Notch, sem Dynamic Island | Usar `useSafeAreaInsets`, nunca margens fixas. Live Activities só na tela bloqueada |
| Taxa de quadros | 60 Hz | Animações em Reanimated na thread de UI, sem blur pesado empilhado. Meta: 60 fps no feed |
| Chip e memória | A18, 8 GB de RAM | Folga para listas longas, mas virtualizar o feed com FlashList |
| Botões | Botão de Ação, sem Controle da Câmera | Opcional: atalho "Novo post" via App Intent na fase de polimento |
| Inteligência | Compatível com Apple Intelligence | Opcional e futuro: classificar o tom do post no aparelho, sem tokens |
| Toque | Haptic Touch e Taptic Engine | `expo-haptics` em curtir, publicar, marco liberado e escolha no evento |

Fontes: [especificações da Apple](https://support.apple.com/en-us/122208) e [Wikipedia](https://en.wikipedia.org/wiki/IPhone_16e) (RAM, 60 Hz, notch). O 16e saiu de linha em março de 2026 e roda iOS 26; o app deve suportar iOS 26 e o atual iOS 27.

**Configuração da máquina (uma vez, feita pelo dono do projeto):**

1. macOS atualizado, Xcode atual (27) com o runtime do iOS e o simulador "iPhone 16e" instalado em Settings > Components.
2. Node LTS, pnpm, Docker Desktop (Postgres e Redis locais), Watchman.
3. Claude Code instalado e logado.
4. Servidores MCP no Claude Code:
   - [XcodeBuildMCP](https://blakecrosley.com/de/blog/xcode-mcp-claude-code): `claude mcp add XcodeBuildMCP -s user -e XCODEBUILDMCP_SENTRY_DISABLED=true -- npx -y xcodebuildmcp@latest mcp` (compilar, abrir simulador, capturar tela e árvore de UI).
   - Xcode MCP da Apple (com o Xcode aberto): `claude mcp add --transport stdio xcode -s user -- xcrun mcpbridge`.
   - Figma MCP, para ler variáveis e telas do arquivo de design.
5. Maestro CLI para os testes de fluxo de ponta a ponta no simulador.

**Ciclo de trabalho do agente em cada tarefa de UI:** compilar e abrir no simulador iPhone 16e, navegar até a tela, capturar screenshot e árvore de acessibilidade, comparar com a tela correspondente do Figma (claro e escuro) e só então marcar a tarefa como pronta.

**Stack do app:** Expo SDK atual (57 na data deste plano, com React Native 0.86 e React 19.2, segundo o [changelog do SDK 57](https://expo.dev/changelog/sdk-57)). Ao compilar com Xcode 27 e o SDK do iOS 27, ativar `ios.enableSceneSupport` em `expo-build-properties`, ou o app não abre no iOS 27. Se o SDK 58 já estiver estável no início, usar ele.

## Provedor de IA: OpenCode Go

Toda geração de texto passa pela chave do OpenCode Go, chamada só pelo worker de IA no servidor, pelo endpoint compatível com OpenAI. O agente implementa um adaptador único (`packages/llm`) para que trocar de provedor seja mudar variáveis de ambiente, sem tocar no jogo.

**Atenção antes de escalar:** a [documentação do Go](https://opencode.ai/docs/go/) diz que o plano foi feito para o OpenCode e outros agentes de programação, que o tráfego é monitorado contra abuso e que a assinatura vale para um workspace de um membro só. Use o Go no desenvolvimento e num teste fechado com poucas pessoas. Antes de abrir para o público, migre para um plano por consumo (OpenCode Console ou a API da própria DeepSeek) trocando só `LLM_BASE_URL`, `LLM_API_KEY` e os nomes dos modelos.

**Como o Go funciona (out/2026):** US$ 10 por mês. Cada modelo tem um limite mensal em dólar, dividido em janelas: 20% a cada 5 horas, 50% por semana e 100% por mês. Base: `https://opencode.ai/inference/go/`. Lista de modelos: `https://opencode.ai/inference/go/v1/models`.

**Papéis e modelos:**

| Papel | Modelo (id) | Limite mensal no Go | Requisições estimadas a cada 5 h | Uso |
| --- | --- | --- | --- | --- |
| Diretor | `deepseek-v4.1-flash` | US$ 80 | cerca de 34.670 | Reações a post, comentário e história, cartão de consequência |
| Principal | `deepseek-v4-pro` | US$ 15 | cerca de 1.050 | DM com personagem do elenco principal, discurso no evento ao vivo |
| Lote | `mimo-v2.6-flash` | US$ 60 | cerca de 30.100 | Feed do dia, resumo do dia, resumo de memórias, fichas novas |
| Reserva | `glm-5.3-flash` | US$ 60 | cerca de 6.320 | Fallback quando o modelo do papel bater o limite |

Todos usam `POST https://opencode.ai/inference/go/openai/v1/chat/completions`. Limites e estimativas: [docs do Go](https://opencode.ai/docs/go/) e [levantamento da Bitdoze](https://www.bitdoze.com/opencode-go-plan/). A lista muda com frequência: no boot, o worker consulta `/v1/models` e falha alto se algum id configurado não existir.

**Modelos proibidos para conteúdo de jogador:** os "Contributor" (Gemini 4 Argon e Muse Spark), que podem treinar com os prompts, e os que retêm logs por 30 dias. A DeepSeek tem retenção zero no Go, com acordo renovado mês a mês (vigente até 31/10/2026); conferir a renovação.

**Regras do adaptador:**

- Cliente: Vercel AI SDK com `@ai-sdk/openai-compatible`, `baseURL` vindo do ambiente.
- Cabeçalhos obrigatórios: `User-Agent: holofote-server/<versão>` (nunca o nome genérico do SDK) e `x-opencode-session: <mundoId>` estável por mundo, que o Go usa para cache de prompt e roteamento.
- Saída sempre em JSON validado por Zod, com `max_tokens` por tipo de job. JSON inválido: uma única tentativa de reparo, depois template.
- Erro 429 ou limite atingido: tenta o modelo reserva; se também falhar, entra o modo template (só números e falas prontas, zero tokens) e o job volta para a fila com atraso.
- Jobs em lote rodam fora do pico da DeepSeek (pico: 01h–04h e 06h–10h UTC, dias úteis). Agendar o lote diário para 04h30 UTC (01h30 em Brasília).
- Toda chamada grava `CHAMADA_LLM` (modelo, tokens de cache, entrada, saída, custo estimado, latência) e vai para o Langfuse.
- No Console do OpenCode, manter "Use balance" desligado no desenvolvimento, para o limite bloquear em vez de cobrar.

**Variáveis de ambiente (`apps/server/.env`, nunca no app):**

```
LLM_BASE_URL=https://opencode.ai/inference/go/openai/v1
LLM_API_KEY=<chave do OpenCode Go>
LLM_USER_AGENT=holofote-server/0.1
LLM_MODEL_DIRETOR=deepseek-v4.1-flash
LLM_MODEL_PRINCIPAL=deepseek-v4-pro
LLM_MODEL_LOTE=mimo-v2.6-flash
LLM_MODEL_RESERVA=glm-5.3-flash
LLM_DAILY_BUDGET_USD=2.00
```

**Conta de custo:** uma chamada do diretor tem cerca de 2.000 tokens de entrada (1.500 do prefixo em cache) e 350 de saída. No preço por consumo da DeepSeek V4.1 Flash no Console (US$ 0,30 por milhão de entrada e US$ 1,20 por milhão de saída, segundo a [documentação do Console](https://opencode.ai/docs/zen/)), isso dá no máximo US$ 0,001 por ação. Com 25 ações por dia, um jogador ativo custa cerca de US$ 0,025 por dia, dentro da meta.

## Arquitetura e stack

Um monorepo TypeScript com o app Expo, a API, o worker de IA e pacotes compartilhados; o motor de regras é um pacote puro, sem rede, que o servidor chama a cada ação. O app fala com a API por HTTPS e recebe reações por WebSocket; só o worker fala com o OpenCode Go.

&#91;embedded content: arquitetura · app, API com motor, worker, provedor e dados\]

O motor roda dentro da API e do worker como biblioteca; a seta para o OpenCode Go é a única saída paga do sistema.

**Stack por camada:**

| Camada | Escolha | Observação |
| --- | --- | --- |
| App | Expo SDK 57, Expo Router, TypeScript estrito | Build de desenvolvimento (`npx expo run:ios`), nunca Expo Go |
| Estado do app | TanStack Query (servidor) e Zustand (tema, destaque, rascunhos) | Persistência local com MMKV; token em `expo-secure-store` |
| UI nativa | Reanimated, FlashList, `expo-linear-gradient`, `react-native-svg`, `lucide-react-native`, `expo-haptics`, `expo-font` | Gradientes metálicos e esferas por gradiente, não por imagem |
| API | Fastify com Zod (`fastify-type-provider-zod`) e `@fastify/websocket` | REST versionado em `/v1`; tipos compartilhados com o app |
| Motor do mundo | `packages/engine`, funções puras com RNG semeado | Todo número do jogo sai daqui; 100% coberto por testes |
| Worker de IA | BullMQ sobre Redis | Filas: `diretor`, `dm`, `lote`, `memoria`, `entrega` (jobs atrasados) |
| Banco | PostgreSQL 17 com pgvector, Drizzle ORM e migrações | `packages/db` com schema, seeds e fixtures |
| Tempo real | Redis Pub/Sub para o WebSocket da API | Um canal por mundo: `mundo:<id>` |
| Login | Sign in with Apple (`expo-apple-authentication`) e JWT próprio | No dev: login anônimo por aparelho |
| Compras | RevenueCat (`react-native-purchases`) com arquivo StoreKit local | Plus mensal e anual, pacotes de gemas |
| Notificações | `expo-notifications` (APNs) | DM nova, evento começando, resumo do dia pronto |
| Observabilidade | Langfuse (tokens e custo), logs estruturados com pino | Sentry opcional na fase de polimento |
| Ambiente local | Docker Compose: Postgres, Redis, Langfuse | `pnpm dev` sobe API, worker e Metro juntos |

**Estrutura do repositório:**

```
holofote/
  apps/
    mobile/        Expo: telas, componentes Cromo, navegação
    server/        Fastify: rotas /v1, WebSocket, autenticação
    worker/        BullMQ: diretor, DM, lote, memória, entregas
  packages/
    engine/        regras do jogo, puro e determinístico
    llm/           adaptador OpenCode Go, prompts, schemas Zod
    db/            schema Drizzle, migrações, seeds
    shared/        tipos, constantes de jogo, contratos da API
    tokens/        tokens Cromo e Destaque exportados do Figma
  maestro/         fluxos de ponta a ponta no simulador
  infra/           docker-compose.yml
  docs/            PLANO.md (este documento), REGRAS.md, PROMPTS.md
  CLAUDE.md
```

**Contratos principais da API:**

| Método e rota | Faz | Custa energia |
| --- | --- | --- |
| `POST /v1/mundos` | Cria mundo, persona e elenco (job em lote) | Não |
| `GET /v1/mundos/:id/feed?cursor=` | Feed paginado | Não |
| `POST /v1/posts/previa` | Prévia do motor para um rascunho (sem IA) | Não |
| `POST /v1/posts` | Publica, debita, enfileira o diretor, devolve curtidas simuladas | 1 |
| `GET /v1/posts/:id/respostas` | Conversa com respostas aninhadas | Não |
| `POST /v1/posts/:id/respostas` | Responde a um post ou comentário | 1 |
| `GET /v1/conversas` e `POST /v1/conversas/:id/mensagens` | Caixa de entrada e DM | 1 por mensagem |
| `POST /v1/historias/:id/voto` | Vota em enquete | 0 |
| `POST /v1/acoes/:id/desfazer` | Desfaz a última ação | 2 |
| `GET /v1/jornada` e `POST /v1/marcos/:id/resgatar` | Atos, marcos e recompensas | Não |
| `GET /v1/eventos/:id` e `POST /v1/eventos/:id/campanha` | Evento e ações de campanha | 1 ou 2 |
| `POST /v1/eventos/:id/discurso` | Escolha no evento ao vivo | 0 (já pago na campanha) |
| `POST /v1/energia/recarga` | Recarga por anúncio ou gemas | Não |
| `GET /v1/resumo-do-dia` | Resumo gerado no lote | Não |
| `WS /v1/tempo-real?mundo=` | Reações, digitando, alertas, energia | — |

## Modelo de dados

O esquema segue o diagrama ER do FigJam e ganha seis tabelas para as telas novas (histórias, marcos, eventos agendados, resumo do dia, falas prontas e gemas). Energia e gemas são livros-caixa: o saldo é sempre a soma dos lançamentos, nunca um campo editado.

| Entidade | Campos principais | Regras |
| --- | --- | --- |
| `usuario` | id, appleSub, plano (`free` ou `plus`), destaque (cor), tema, criadoEm | Um mundo ativo por usuário no MVP |
| `mundo` | id, usuarioId, universo, tomCaos (0 a 100), dia, periodo (`manha`, `tarde`, `noite`), ato, biblia, resumoEstado | `biblia` é o prefixo fixo do prompt, gerado uma vez; `resumoEstado` é reescrito no lote diário |
| `personagem` | id, mundoId, ehJogador, nome, handle, verificado, papel (`elenco`, `figurante`), ficha, fama, carisma, polemica, seguidores | `ficha` com 100 a 150 tokens; atributos de 0 a 100 |
| `relacao` | deId, paraId, afinidade (0 a 100), rotulo | Chave composta; rótulo derivado da faixa de afinidade pelo motor |
| `memoria` | id, personagemId, sobreId, fatos, embedding (vector 1024), dia | `fatos` com até 120 tokens; uma linha por personagem e alvo, reescrita no resumo |
| `post` | id, mundoId, autorId, respondeA, tipo (`post`, `historia`), texto, tom, enquete, origem (`jogador`, `diretor`, `lote`, `template`), entregarEm, expiraEm, curtidas, reposts, respostas, visualizacoes | Itens com `entregarEm` no futuro ficam invisíveis até a hora |
| `voto` | postId, personagemId, opcao | Votar não gera job de IA |
| `conversa` e `mensagem` | conversa: id, mundoId, personagemId, resumo, naoLidas. mensagem: id, conversaId, autorId, texto, entregarEm | `resumo` da conversa entra no prompt no lugar do histórico |
| `evento` | id, mundoId, tipo (`post`, `resposta`, `dm`, `historia`, `campanha`, `discurso`, `desfazer`), entrada, consequencia, desfeitoEm | Uma linha por ação do jogador; alimenta o registro de atividades |
| `delta` | id, eventoId, alvo (atributo ou relação), valor | Limitado pelo servidor; desfazer aplica os deltas invertidos |
| `lancamento_energia` | id, usuarioId, valor (negativo gasta), motivo (`acao`, `recarga`, `anuncio`, `gemas`, `marco`, `desfazer`), criadoEm | Recarga natural calculada na leitura, não por cron |
| `lancamento_gemas` | id, usuarioId, valor, motivo (`marco`, `evento`, `compra`, `energia`) | Saldo nunca negativo |
| `marco` | id, mundoId, ato, ordem, titulo, requisitos, recompensa, liberadoEm | Requisitos e recompensas em JSON validado |
| `evento_agendado` | id, mundoId, tipo (`premio`, `show`, `crise`), titulo, categoria, diaMundo, periodo, indicados, estado | Chances recalculadas pelo motor a cada ação de campanha |
| `resumo_dia` | mundoId, dia, manchete, numeros, pendencias | Gerado no lote, lido pela tela 20 |
| `fala_pronta` | id, universo, gatilho, tom, texto com marcadores (`{nome}`, `{handle}`) | Pool de templates para ações que não pedem texto novo |
| `chamada_llm` | id, eventoId, job, modelo, tokensCache, tokensEntrada, tokensSaida, custoUsd, latenciaMs, ok | Base do painel de custo e do teto diário |

**Índices obrigatórios:** `post (mundoId, entregarEm desc)`, `mensagem (conversaId, entregarEm)`, `relacao (deId)`, `memoria` com índice HNSW no embedding, `lancamento_energia (usuarioId, criadoEm)`.

**Embeddings:** gerar só no lote de memória. O Go não oferece endpoint de embeddings documentado; usar um modelo local leve no worker (por exemplo, via `@huggingface/transformers` em CPU) ou deixar a busca por embedding para depois do MVP e selecionar memórias por `personagemId` e `sobreId`, que já resolve o caso principal.

## Regras do jogo

As regras abaixo são a versão 2, já aplicada nas telas do Figma depois da análise de coerência. Todas moram em `packages/engine` como constantes e funções puras; o modelo de linguagem nunca decide um número, só escreve texto e sugere deltas que o motor limita.

**Energia e custos:**

| Ação | Energia | Chama IA? |
| --- | --- | --- |
| Publicar post | 1 | Sim, diretor |
| Comentar ou responder | 1 | Sim, diretor |
| Mensagem direta | 1 | Sim, principal ou diretor |
| Responder história | 1 | Sim, vira DM |
| Votar em enquete, curtir, seguir | 0 | Não |
| Campanha de evento | 1 ou 2 | Só se gerar post |
| Desfazer a última ação | 2 | Não |
| Prévia do motor | 0 | Não |

- Máximo de 12 (Plus: 24). Recarga de 1 a cada 20 min (Plus: a cada 10 min), calculada na leitura a partir do último lançamento.
- Anúncio: +3, até 3 por dia. Gemas: 10 enchem a barra. Marco liberado: barra cheia.
- Ação barrada pela moderação ou por erro não debita energia (lançamento estornado na mesma transação).

**Atributos (0 a 100):**

- **Fama:** multiplica o alcance e os seguidores ganhos: `(1 + fama / 50)`.
- **Carisma:** multiplica ganhos de relação e reduz perdas: ganho `× (0,7 + carisma / 100)`, perda `× (1,3 − carisma / 100)`.
- **Polêmica:** aumenta o alcance `× (1 + polemica / 100)`, mas acima de 70 abre 20% de chance por dia de um evento de crise. Decai 3 pontos por dia sem provocação.

**Tom do post (escolhido na tela 12):**

| Tom | Alcance | Polêmica | Relação com quem foi marcado |
| --- | --- | --- | --- |
| Fofo | × 0,9 | −2 a 0 | +1 a +4 |
| Sincero | × 1,0 | 0 a +2 | 0 a +3 |
| Misterioso | × 1,1 | +1 a +3 | −1 a +2 |
| Provocativo | × 1,3 | +4 a +8 | −5 a −2 |

A prévia (`POST /v1/posts/previa`) roda a mesma função do cálculo real com o RNG nos dois extremos e devolve faixas. O resultado real usa um RNG semeado por `eventoId`, para ser reproduzível em teste.

**Relações:** afinidade de 0 a 100. Rótulos por faixa: 0 a 24 Rival, 25 a 44 Rivais com respeito, 45 a 59 Conhecidos, 60 a 79 Parceria ou Amizade (pelo papel), 80 a 100 Aliança. O servidor limita cada delta a ±8 por ação e ±12 em evento.

**Desfazer:** só a última ação, até 60 minutos depois, custa 2. Reverte os deltas, remove as reações ainda não entregues e esconde as entregues, sem nova chamada de IA. Personagens com afinidade abaixo de 45 e perfis de fofoca têm 25% de chance de "lembrar", o que grava uma memória "apagou um post".

**Tempo:** o dia do mundo acompanha o dia real no fuso do jogador, com três períodos: manhã (6h–12h), tarde (12h–18h) e noite (18h–6h). O lote da madrugada gera o feed e o resumo do dia seguinte.

**Atos e marcos:** cada ato tem um objetivo e cinco marcos. Exemplo do Ato 1, "Dominar o pop nacional", marco 2 "Primeiro show lotado": 4 escândalos administrados, carisma 70 e 10 mil seguidores. Recompensa padrão: +25 gemas, energia cheia, uma ação nova e um personagem novo (ficha gerada uma vez no lote). Cinco marcos abrem o próximo ato.

**Eventos agendados:** anunciados três dias antes. Cada ação de campanha recalcula a chance de cada indicado. No ao vivo, o jogador tem 30 segundos para escolher o discurso: "seguro" sempre aparece, "ousado" se ensaiou, "especial" se cumpre o marco exigido. O vencedor sai de um sorteio ponderado pelas chances; só a reação ao discurso chama o modelo principal.

**Gemas:** ganhas em marcos (+25), eventos (+10 a +40) e compras. Usos no MVP: encher energia (10). Saldo inicial: 40.

**Plus:** energia em dobro (24, recarga a cada 10 min), sem anúncios, personagens puxam conversa a qualquer hora (até 3 por dia, gerados no lote) e até 3 mundos. Preços de referência das telas: R$ 29,90 por mês ou R$ 239,90 por ano.

**Personagem puxa conversa (grátis):** no máximo uma vez por dia, só depois de marco ou evento.

## Pipeline de IA e orçamento de tokens

Cada ação do jogador gera no máximo uma chamada de LLM, com cerca de 2.000 tokens de entrada (a maior parte em cache) e no máximo 500 de saída. O resto vem do motor, de falas prontas ou do lote da madrugada.

**Caminho de uma ação (post, comentário ou DM):**

1. A API valida o texto com o filtro local de moderação (lista de termos e regras). Barrado: responde 422 e não debita.
2. Debita a energia e grava `evento` na mesma transação.
3. O motor calcula os números (seguidores, atributos, curtidas simuladas) e escolhe até 5 reatores: quem foi marcado, afinidades extremas, perfis de fofoca e quem está "online" no período.
4. A API devolve 201 com os números e as curtidas na hora; o app já mostra o cartão de consequência com os números.
5. Se a ação pede texto novo, enfileira o job `diretor` (ou `dm`). Se não pede, usa `fala_pronta` com nomes e acaba aqui, com zero tokens.
6. O worker monta o prompt: prefixo fixo do mundo e contexto mínimo (ação, números do motor, fichas e memórias só dos reatores).
7. O modelo devolve JSON. O worker valida com Zod, limita os deltas e agenda cada reação com `entregarEm` espalhado entre 20 segundos e 15 minutos.
8. A fila `entrega` publica cada reação no canal Redis do mundo na hora marcada; a API repassa pelo WebSocket, ou por push se o app estiver em segundo plano.

**Estrutura do prompt:**

| Parte | Tamanho | Muda quando | Em cache? |
| --- | --- | --- | --- |
| Regras de estilo (pt-BR, minúsculas, sem emojis, sem cair do personagem, formato JSON) | cerca de 400 tokens | Nunca | Sim |
| Bíblia do mundo (universo, tom, elenco principal em uma linha cada) | cerca de 1.000 tokens | Ao entrar personagem novo | Sim |
| Estado do mundo (`resumoEstado`) | até 200 tokens | Uma vez por dia | Parcial |
| Ação e números do motor | até 150 tokens | Toda chamada | Não |
| Reatores: ficha, relação e memória de cada um | até 5 × 120 tokens | Toda chamada | Não |

O prefixo tem de ser idêntico byte a byte entre chamadas do mesmo mundo: nada de data, hora ou contadores nele. O cabeçalho `x-opencode-session: <mundoId>` mantém o roteamento no mesmo cache.

**Saída do diretor (schema Zod em `packages/llm`):**

```
{
  reacoes: [{ personagemId, tipo: 'resposta' | 'citacao' | 'dm', texto (até 220 caracteres), atrasoSeg }],   // até 5
  cartao: { titulo, texto (até 240 caracteres) },
  deltasSugeridos: [{ alvo, valor }],   // o motor limita e pode ignorar
  memorias: [{ personagemId, fato (até 100 caracteres) }],
  moderacao: { ok: boolean, motivo?: string }
}
```

**Tetos por tipo de job:**

| Job | Modelo | `max_tokens` | Quando roda |
| --- | --- | --- | --- |
| `diretor` | Diretor | 500 | Post, comentário, resposta a história |
| `dm` | Principal (elenco) ou Diretor (figurante) | 250 | Cada mensagem do jogador |
| `discurso` | Principal | 400 | Escolha no evento ao vivo |
| `lote` | Lote | 2.500 | Uma vez por mundo, na madrugada: 15 a 25 posts do dia, manchete, resumo do dia |
| `memoria` | Lote | 800 | Junto do lote, para personagens com 8 ou mais eventos novos |
| `ficha` | Lote | 300 | Uma vez por personagem novo |

**Proteções de custo:**

- Teto global diário (`LLM_DAILY_BUDGET_USD`) somado a partir de `chamada_llm`. Passou do teto, todo o jogo entra no modo template até a virada do dia.
- Teto por jogador: a própria energia. Sem energia, sem chamada.
- Curtidas, seguidores, "digitando" e comentários de figurantes nunca chamam o modelo.
- Desfazer nunca chama o modelo.
- Histórico de DM nunca vai inteiro: vai o `resumo` da conversa e as últimas 4 mensagens.

**Avaliação dos prompts (`packages/llm/evals`):** 30 ações de exemplo com o mundo "Pop Brasil" do Figma (Lua Prado, Vic Ferraz, Duda Marques, Bento Lima, fofocalizei). Critério para trocar prompt ou modelo: 99% de JSON válido, 100% em português, nenhum texto acima do limite e nota média de credibilidade de pelo menos 4 de 5 nas estrelas "Quão crível foi?" coletadas no app.

## App iOS: design system e telas

O app reproduz o sistema Cromo do Figma com tokens gerados num pacote único (`packages/tokens`), tema claro e escuro e seis cores de destaque trocadas em tempo real. Nenhuma cor, sombra ou tamanho de fonte é escrito à mão numa tela.

**Regra de papéis de cor:** o primário (grafite no claro, cromo claro no escuro) marca ações e estados: aba ativa, chip selecionado, botão principal. O destaque marca informação viva: progresso, links, histórias não vistas, pontos de novidade, curtida, resultado e o brilho do botão metálico. Uma tela tem no máximo um elemento com fundo cheio de destaque.

**Neutros (coleção Cromo):**

| Token | Claro | Escuro |
| --- | --- | --- |
| `fundo` | #ECECEC | #111213 |
| `superficie` | #F6F6F6 | #1B1C1E |
| `superficie-2` | #E2E3E3 | #0B0C0D |
| `linha` | #D6D8D8 | #2A2C2F |
| `texto` | #2A2C2C | #ECEDEE |
| `texto-suave` | #676B6B | #8D9196 |
| `texto-fraco` | #B3B6B6 | #55595E |
| `primario` | #141515 | #ECEDEE |
| `primario-texto` | #F6F6F6 | #141515 |

**Destaques (coleção Destaque; `brilho` = base com 38% de opacidade):**

| Cor | base | sobre | tinta claro | tinta escuro | suave claro | suave escuro | gráfico claro |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Laranja (padrão) | #FF5A1F | #1A0E08 | #B23A0B | #FF8A5C | #FFE3D6 | #3A2117 | #F03F00 |
| Cobalto | #2F5BFF | #FFFFFF | #2443CC | #8AA4FF | #DDE4FF | #1C2342 | #2F5BFF |
| Violeta | #6B4BFF | #FFFFFF | #5B3FE0 | #A893FF | #E7E1FF | #262043 | #6B4BFF |
| Rosa | #FF4FA3 | #2A0616 | #B01A67 | #FF8AC4 | #FFDCEC | #3A1A2B | #FC0078 |
| Menta | #14A98B | #04201A | #0A7461 | #5FE0C4 | #D3F3EC | #12302A | #119278 |
| Lima | #9CCB00 | #1A2100 | #4A6600 | #C8F03C | #EEF8C6 | #2A3210 | #6B8B00 |

No tema escuro, `destaque-gráfico` usa a própria base. Todos os pares de texto passam de 4,5:1.

**Tipografia:** Plus Jakarta Sans (`@expo-google-fonts/plus-jakarta-sans`). Display Bold 28/34 (−2%), Título SemiBold 22/28 (−1%), Seção SemiBold 17/22 (−0,5%), Número Bold 22/26 (−1%), Botão SemiBold 18/22, Corpo Regular 15/21, Corpo forte SemiBold 15/21, Legenda Medium 13/18, Mini SemiBold 11/14 (+4%, maiúsculas). Dynamic Type com `maxFontSizeMultiplier` de 1,3.

**Efeitos:** usar a prop `boxShadow` do React Native (aceita várias sombras e `inset`) com estes valores: Elevação `0 10 24 rgba(0,0,0,.07), 0 1 2 rgba(0,0,0,.05), inset 0 1 0 rgba(255,255,255,.9)`; Afundado `inset 0 2 5 rgba(0,0,0,.09), inset 0 -1 0 rgba(255,255,255,.8)`; Esfera `0 8 16 rgba(0,0,0,.22), 0 1 2 rgba(0,0,0,.12), inset 0 2 2 rgba(255,255,255,.3)`. O brilho do botão metálico é `0 16 32 <destaque-brilho>`; no Figma ele está fixo em laranja, o app deve ligar ao destaque escolhido. O escuro tem estilos próprios ("Cromo Escuro"): ler pelo Figma MCP.

**Gradientes:** esferas com `RadialGradient` do `react-native-svg` (preta: #5C6060 → #1F2121 em 45% → #060707), metal e pílula com `expo-linear-gradient` (metal: #E3E5E5 → #BCC0C0 → #979C9C). Medidas: margem lateral 16, cartão com raio 24 e padding 16, botão suave 40 × 40, botão metálico com 58 de altura, avatar de 40 por padrão.

**Componentes (em `apps/mobile/src/ui`, um arquivo cada, com história de exemplo):** Avatar (esferas escura, clara e média com iniciais), BarraDeAbas (pílula flutuante, aba ativa em esfera), Post, BotaoMetal, BotaoSuave, Chip (linha, afundado, destaque, suave, primário), Esfera, Cartao, Segmentado, BarraProgresso, Custo (raio e número), Rotulo, Folha (bottom sheet), Comentario, LinhaDeLista, Interruptor.

**Telas e rotas (Expo Router):**

| # | Tela | Rota | Apresentação |
| --- | --- | --- | --- |
| 01 | Criar mundo | `/(onboarding)/criar-mundo` | Pilha, 3 passos |
| 02 | Feed | `/(abas)/` | Aba Início |
| 03 | Post e consequências | `/post/[id]` | Pilha |
| 04 | Mensagem direta | `/dm/[conversaId]` | Pilha |
| 05 | Perfil do jogador | `/(abas)/perfil` | Aba Perfil |
| 06 | Jornada | `/(abas)/jornada` | Aba Jornada |
| 07 | Alertas | `/(abas)/alertas` | Aba Alertas |
| 08 | Perfil de personagem | `/personagem/[id]` | Pilha |
| 09 | Registro de atividades | `/registro` | Pilha |
| 10 | Aparência | `/aparencia` | Pilha |
| 11 | Holofote Plus | `/plus` | Modal |
| 12 | Novo post | `/novo-post` | Modal |
| 13 | Respostas | `/post/[id]/respostas` | Pilha |
| 14 | Mensagens | `/(abas)/mensagens` | Aba Mensagens |
| 15 | História | `/historia/[id]` | Modal em tela cheia |
| 16 | Evento | `/evento/[id]` | Pilha |
| 17 | Evento ao vivo | `/evento/[id]/ao-vivo` | Modal em tela cheia |
| 18 | Marco liberado | `/marco/[id]` | Modal |
| 19 | Sem energia | `/sem-energia` | Folha (`formSheet`) |
| 20 | Resumo do dia | `/resumo-do-dia` | Modal, abre sozinho na primeira visita do dia |
| 21 | Mapa de relações | `/relacoes` | Pilha |

Cada tela tem uma versão clara e uma escura no Figma; o agente compara as duas no simulador. Estados vazios, carregando e erro seguem o mesmo cartão, com uma frase e uma ação.

## Fases de implementação

São dez fases em ordem; o agente só começa uma fase quando todos os critérios "Pronto quando" da anterior passam. Cada fase vira um branch e um PR, com a lista de tarefas abaixo como checklist.

1. **F0 · Fundação**
   - [ ] Monorepo pnpm com Turborepo, TypeScript estrito, ESLint, Prettier, Vitest.
   - [ ] `infra/docker-compose.yml` com Postgres 17 + pgvector, Redis e Langfuse.
   - [ ] App Expo criado em `apps/mobile`, só iOS, retrato, `bundleIdentifier` definido, `ios.enableSceneSupport` ligado.
   - [ ] `CLAUDE.md` e `docs/PLANO.md` (este documento exportado em Markdown) na raiz.
   - [ ] CI no GitHub Actions: lint, typecheck e testes.
   - Pronto quando: `pnpm dev` sobe API, worker e Metro; o app abre no simulador iPhone 16e com a fonte Plus Jakarta Sans; o agente salva um screenshot pelo XcodeBuildMCP.
2. **F1 · Design system no app**
   - [ ] `packages/tokens` gerado das variáveis do Figma (script que lê pelo Figma MCP ou por JSON exportado).
   - [ ] ThemeProvider com claro, escuro e sistema; seis destaques trocados sem recarregar.
   - [ ] Todos os componentes da seção de design, mais uma tela `/dev/catalogo` que mostra cada um.
   - Pronto quando: o catálogo bate com o quadro "Componentes" do Figma em claro e escuro, e trocar o destaque muda progresso, links e brilho na hora.
3. **F2 · Backend base**
   - [ ] Schema Drizzle completo, migrações e seed do mundo "Pop Brasil" com o elenco do Figma.
   - [ ] Login anônimo por aparelho e JWT; rotas de leitura (feed, perfil, personagem, relações, alertas).
   - [ ] WebSocket com canal por mundo via Redis.
   - Pronto quando: o seed reproduz os números das telas (7,1 mil seguidores, Vic 38%, Duda 72%, Bento 88%) e os testes de API passam.
4. **F3 · Motor de regras**
   - [ ] Energia, atributos, tom, relações, desfazer, marcos, chances de evento e prévia, em `packages/engine`.
   - [ ] Testes de propriedade (fast-check): saldos nunca negativos, deltas sempre dentro dos limites, mesma semente dá o mesmo resultado.
   - Pronto quando: cobertura de 100% das linhas do motor e cada tabela da seção de regras reproduzida em teste.
5. **F4 · IA e worker**
   - [ ] `packages/llm`: adaptador do Go, cabeçalhos, roteador com reserva, modo template, schemas Zod e prompts versionados em `docs/PROMPTS.md`.
   - [ ] Worker BullMQ com filas `diretor`, `dm`, `entrega`, gravando `chamada_llm` e enviando ao Langfuse.
   - [ ] Evals com as 30 ações de exemplo.
   - Pronto quando: os evals passam os critérios; com a chave real, um post gera reações entregues ao longo de minutos; custo médio registrado de no máximo US$ 0,001 por chamada; derrubar o provedor ativa o modo template sem erro na tela.
6. **F5 · Núcleo social (telas 01, 02, 03, 12, 13, 04, 14, 07)**
   - [ ] Telas ligadas à API com TanStack Query, atualização otimista em curtir e publicar.
   - [ ] Reações chegando por WebSocket, aviso "novas respostas" e "digitando".
   - Pronto quando: o fluxo Maestro "criar mundo, postar, ver respostas chegando, responder, mandar DM" passa no iPhone 16e em claro e escuro.
7. **F6 · Progressão e economia (05, 06, 08, 09, 18, 19, 21)**
   - [ ] Jornada com atos e marcos, marco liberado, registro com desfazer, mapa de relações.
   - [ ] Energia com recarga, folha "sem energia", gemas, anúncio simulado.
   - Pronto quando: o fluxo Maestro "gastar até zero, abrir a folha, usar 10 gemas, voltar a postar" passa, e cumprir os requisitos de um marco abre a tela 18.
8. **F7 · Histórias, eventos e lote diário (15, 16, 17, 20)**
   - [ ] Histórias com enquete e expiração de 24 h.
   - [ ] Evento agendado com campanha e ao vivo com cronômetro de 30 s.
   - [ ] Job de lote às 04h30 UTC: feed do dia, resumo do dia, memórias e fichas novas.
   - Pronto quando: com relógio simulado, um evento roda de ponta a ponta e o resumo do dia abre sozinho na primeira visita.
9. **F8 · Conta e monetização (10, 11)**
   - [ ] Sign in with Apple, aparência salva na conta, notificações.
   - [ ] RevenueCat com arquivo StoreKit local: Plus mensal, anual e pacotes de gemas.
   - Pronto quando: comprar o Plus no sandbox muda o máximo de energia para 24 e remove anúncios.
10. **F9 · Polimento e aparelho real**
    - [ ] Hapticos, animações, VoiceOver, Dynamic Type, ícone e splash.
    - [ ] Opcional: App Intent "Novo post" para o botão de Ação.
    - [ ] Build no iPhone 16e físico e TestFlight.
    - Pronto quando: no aparelho real, o Instruments não mostra o feed abaixo de 55 fps, e o checklist da App Store (seção de segurança) está todo marcado.

## Testes e verificação no simulador

Nada é dado como pronto sem prova: teste automatizado para regra e API, e screenshot do simulador iPhone 16e comparado ao Figma para tela. Os testes de IA rodam contra um provedor falso por padrão e contra o Go só quando pedido.

| Camada | Ferramenta | O que cobre | Quando roda |
| --- | --- | --- | --- |
| Motor | Vitest e fast-check | Todas as regras e limites | Todo commit |
| API | Vitest com Postgres e Redis do Docker | Rotas, transações de energia, estornos, WebSocket | Todo commit |
| LLM | Provedor falso com respostas gravadas | Parsing, reparo, reserva, modo template | Todo commit |
| Evals | Script `pnpm evals` com a chave real | Qualidade e custo dos prompts | Ao mudar prompt ou modelo |
| Componentes | Jest com React Native Testing Library | Estados e acessibilidade | Todo commit |
| Fluxos | Maestro no simulador iPhone 16e | Os fluxos de "Pronto quando" de cada fase | Fim de cada tarefa de tela |
| Visual | XcodeBuildMCP (`screenshot`, árvore de UI) e Figma MCP | Tela contra o frame do Figma, claro e escuro | Fim de cada tarefa de tela |

**Rotina visual do agente para cada tela:**

1. Compilar e abrir no simulador iPhone 16e (`build_sim` e `boot_sim` do XcodeBuildMCP).
2. Abrir a tela pelo deep link `holofote://<rota>` com dados do seed.
3. Capturar screenshot no tema claro e no escuro (`xcrun simctl ui booted appearance dark`).
4. Ler o frame correspondente no Figma (`get_screenshot` e `get_design_context`).
5. Listar as diferenças de espaçamento, cor, tipografia e texto, corrigir e repetir até não sobrar diferença visível.
6. Salvar os dois screenshots em `docs/telas/<numero>-claro.png` e `-escuro.png` para revisão humana.

**Relógio simulado:** `packages/engine` recebe a hora por injeção. Em dev, `POST /v1/dev/relogio` avança o tempo do mundo para testar recarga, períodos, eventos e o lote sem esperar.

**Modo sem rede de IA:** `LLM_PROVIDER=falso` responde com JSON gravado. O agente desenvolve as fases F5 a F9 assim e só liga o Go para os evals e para a demonstração de cada fase, poupando o limite.

## Segurança, moderação, privacidade e App Store

O app manda o texto do jogador para modelos de terceiros, então precisa de consentimento explícito antes da primeira ação. Desde novembro de 2025, a regra 5.1.2(i) da App Store exige revelar com clareza quando dados pessoais vão para "IA de terceiros" e pedir permissão explícita ([TechCrunch](https://techcrunch.com/2025/11/13/apples-new-app-review-guidelines-clamp-down-on-apps-sharing-personal-data-with-third-party-ai)).

- [ ] **Consentimento de IA:** passo no onboarding (tela 01) explicando que posts, comentários e mensagens são processados por modelos de IA de terceiros pelo OpenCode, com aceite e link para a política. Sem aceite, o jogo não começa.
- [ ] **Chave protegida:** a chave do Go só existe no servidor, em variável de ambiente ou cofre de segredos. Teste no CI que procura o padrão da chave no bundle do app e falha se achar.
- [ ] **Limite de taxa:** por usuário e por IP na API, além da energia. Protege a cota do Go contra script.
- [ ] **Moderação de entrada:** filtro local antes de debitar; o campo `moderacao` do diretor como segunda checagem, sem chamada extra. Bloqueio explica o motivo em uma frase.
- [ ] **Moderação de saída:** o worker descarta reações com termos proibidos e troca por fala pronta.
- [ ] **Sem pessoas reais:** o elenco é sempre fictício. O prompt proíbe imitar celebridades reais, e a criação de mundo recusa nomes de pessoas públicas reais (lista de bloqueio e checagem no job de ficha).
- [ ] **Denúncia e bloqueio:** ação "denunciar" em qualquer texto gerado e opção de silenciar um personagem, para a regra de conteúdo gerado da App Store.
- [ ] **Faixa etária:** responder o questionário de classificação considerando conteúdo gerado por IA; tom do mundo limitado a 12+ no MVP.
- [ ] **Dados mínimos:** guardar só o identificador da Apple, o mundo e o que o jogo usa. Exclusão de conta apaga tudo, inclusive as memórias e as chamadas registradas.
- [ ] **Retenção no provedor:** só modelos sem treino e com retenção zero (seção do provedor). Conferir todo mês a renovação do acordo da DeepSeek.
- [ ] **Privacidade na loja:** rótulo de privacidade declarando conteúdo do usuário enviado a terceiros para funcionalidade do app, sem rastreamento.
- [ ] **LGPD:** política em português, base legal de execução de contrato e consentimento, canal para pedidos do titular.

## Riscos e questões em aberto

O maior risco é de provedor, não de código: o Go é voltado a agentes de programação e a uma pessoa só. O adaptador único e o modo template existem para que esse risco custe uma troca de variável, e não uma reescrita.

| Risco | Sinal | Resposta |
| --- | --- | --- |
| Uso do Go fora do perfil esperado | Aviso, bloqueio ou 429 constante | Migrar para cobrança por consumo (Console ou DeepSeek) mudando `LLM_BASE_URL`, chave e modelos |
| Modelo some da lista do Go | `/v1/models` sem o id no boot | Reserva assume; trocar o id no `.env` e rodar os evals |
| Janela de 5 h esgotada em teste | Erros de limite no Langfuse | Desenvolver com `LLM_PROVIDER=falso`; ligar o Go só em evals e demos |
| JSON inválido ou fora do personagem | Taxa de reparo acima de 1% | Ajustar prompt, reduzir reatores, trocar o modelo do papel |
| Fim do acordo de retenção zero da DeepSeek | Mudança na página do Go | Passar o diretor para um modelo com retenção zero (por exemplo, MiMo Flash) |
| Desempenho a 60 Hz | Quedas no feed com esferas e sombras | Pré-renderizar esferas como imagem, reduzir sombras empilhadas |
| Revisão da App Store | Rejeição por 5.1.2(i) ou conteúdo gerado | Consentimento, denúncia, bloqueio e faixa etária da seção de segurança |

**Perguntas para o dono do projeto:**

- [ ] Onde o backend vai rodar no teste fechado (por exemplo, Fly.io ou Railway, com Postgres gerenciado)?
- [ ] Qual provedor por consumo será usado no lançamento público: OpenCode Console ou API da DeepSeek?
- [ ] Há conta no Apple Developer Program (necessária para Sign in with Apple em aparelho, push e TestFlight)?
- [ ] O nome "Holofote" e o bundle id `app.holofote` estão livres e aprovados?
- [ ] Quantos universos além de "Pop Brasil" entram no MVP (o Figma mostra Reality show, Faculdade de magia, Startup caótica e Time de vôlei)?

## Instruções para o agente

O agente trabalha fase por fase, com este documento em `docs/PLANO.md` e o `CLAUDE.md` abaixo na raiz. Para começar, exporte este doc em Markdown, coloque-o no repositório vazio e abra o Claude Code com o prompt inicial.

**Prompt inicial no Claude Code:**

```
Leia docs/PLANO.md e CLAUDE.md. Execute a fase F0 inteira, em modo de planejamento primeiro:
liste as tarefas, confirme os servidores MCP (XcodeBuildMCP, Xcode, Figma) e só então implemente.
Ao terminar, mostre o screenshot do simulador iPhone 16e e o resultado de cada critério "Pronto quando".
```

**`CLAUDE.md` (copiar para a raiz):**

```markdown
# Holofote

Rede social em que só o jogador é humano; o elenco é IA. Plano completo: docs/PLANO.md.

## Alvo
- iOS, iPhone, retrato. Referência: simulador "iPhone 16e" (390 x 844 pt, notch, 60 Hz).
- Use sempre as ferramentas do XcodeBuildMCP para compilar, abrir e capturar a tela, em vez de xcodebuild cru.
- Toda tela termina com screenshot claro e escuro comparado ao frame do Figma (fileKey z4hwlJgPHTikSzQ9yfjAI9).

## Regras que não se quebram
- A chave do OpenCode Go só existe em apps/server e apps/worker. Nunca no app, nunca no git.
- No máximo uma chamada de LLM por ação do jogador. Números saem de packages/engine, nunca do modelo.
- Toda ação que chama IA debita energia antes, na mesma transação do evento.
- Prefixo do prompt idêntico byte a byte por mundo. Cabeçalhos User-Agent próprio e x-opencode-session.
- Cores, sombras e fontes só por packages/tokens. Nada de hex em tela.
- Textos de interface e de personagens em português do Brasil, sem emojis.

## Comandos
- pnpm dev (Docker, API, worker, Metro)
- pnpm test, pnpm typecheck, pnpm lint
- pnpm evals (usa a chave real; rodar só ao mudar prompt ou modelo)
- maestro test maestro/

## Como trabalhar
- Uma fase por branch. Planeje antes de codar. Peça confirmação antes de mudar uma decisão travada do plano.
- Desenvolva com LLM_PROVIDER=falso; ligue o Go só para evals e demonstração.
- Ao fim de uma tarefa: testes verdes, typecheck limpo, screenshots salvos em docs/telas.
- Use um subagente para revisar cada PR com olhar de fora antes de declarar a fase pronta.
```

**Definição de pronto de qualquer tarefa:**

- [ ] Testes novos cobrindo o comportamento, e todos os testes passando.
- [ ] `pnpm typecheck` e `pnpm lint` limpos.
- [ ] Para tela: screenshots claro e escuro no iPhone 16e batendo com o Figma, VoiceOver lendo os elementos principais.
- [ ] Para IA: chamada registrada em `chamada_llm`, custo dentro do teto, modo template testado.
- [ ] Nenhuma decisão travada alterada sem registro em `docs/DECISOES.md`.
