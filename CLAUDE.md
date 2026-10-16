# Holofote

Rede social em que só o jogador é humano; o elenco é IA. Plano completo: docs/PLANO.md. Desvios do plano: docs/DECISOES.md. Índice das telas no Figma: docs/FIGMA.md.

## Alvo

- iOS, iPhone, retrato. Referência: simulador "iPhone 16e" (390 x 844 pt, notch, 60 Hz).
- Use as ferramentas do XcodeBuildMCP para compilar, abrir e capturar a tela quando estiverem configuradas. Sem elas, use `npx expo run:ios --device "iPhone 16e"` e a ferramenta de simulador do Claude desktop (screenshot, toque, árvore de UI).
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
- pnpm test (Vitest nos pacotes Node e Jest no app), pnpm typecheck, pnpm lint
- pnpm --filter @holofote/tokens gerar (regenera os tokens a partir de packages/tokens/figma/variaveis.json)
- pnpm infra:langfuse (sobe o Langfuse local, que não entra no pnpm dev)
- pnpm evals (usa a chave real; rodar só ao mudar prompt ou modelo)
- maestro test maestro/

## Monorepo

- pnpm com `nodeLinker: hoisted` (em pnpm-workspace.yaml): uma cópia só de react e react-native para o app e os pacotes.
- Pacotes internos exportam o fonte TypeScript direto (`exports: ./src/index.ts`); tsx e Metro compilam.
- O app usa CNG: `apps/mobile/ios` é gerado por `expo prebuild` e não vai para o git. Configuração nativa só em `app.config.ts` e plugins.
- O caminho do projeto tem acentos (`Programação`): o plugin `apps/mobile/plugins/caminho-utf8.js` mantém o `pod install` funcionando. Rode builds com `LANG=en_US.UTF-8`.
- API em http://localhost:3333/v1, Metro em 8081, Langfuse em 3000.

## Design system

- Tokens: `packages/tokens` (`montarTema(modo, destaque)`). Para atualizar do Figma, rode `packages/tokens/figma/exportar.js` pelo `use_figma`, salve o retorno em `figma/variaveis.json` e rode `gerar`.
- Componentes em `apps/mobile/src/ui`, um arquivo cada, mais `<Nome>.historia.tsx`. Use `Camada` para fundo, gradiente e sombra, `Texto` para texto e `Icone` para ícones do lucide.
- Catálogo: `holofote://dev/catalogo` (só em desenvolvimento). Especificação dos componentes no Figma: docs/COMPONENTES.md.

## Como trabalhar

- Uma fase por branch. Planeje antes de codar. Peça confirmação antes de mudar uma decisão travada do plano.
- Desenvolva com LLM_PROVIDER=falso; ligue o Go só para evals e demonstração.
- Ao fim de uma tarefa: testes verdes, typecheck limpo, screenshots salvos em docs/telas.
- Use um subagente para revisar cada PR com olhar de fora antes de declarar a fase pronta.
