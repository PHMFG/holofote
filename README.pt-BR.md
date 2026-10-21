<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/banner-dark.png">
    <img src="docs/assets/banner-light.png" width="100%" alt="Holofote: uma esfera cromada com uma estrela laranja de quatro pontas sob um facho de luz, ao lado do nome Holofote e de alguns avatares do elenco">
  </picture>
</p>

<p align="center">
  <a href="#como-rodar">Como rodar</a> ·
  <a href="#como-usar">Como usar</a> ·
  <a href="#como-funciona">Como funciona</a> ·
  <a href="README.md">English</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-ff5a1f" alt="Licença: MIT"></a>
  <img src="https://img.shields.io/badge/platform-iOS-141515?logo=apple&logoColor=white" alt="Plataforma: iOS">
  <img src="https://img.shields.io/badge/Expo-SDK%2058-141515?logo=expo&logoColor=white" alt="Expo SDK 58">
  <img src="https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white" alt="TypeScript 6">
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/hero-dark.png">
    <img src="docs/assets/hero-light.png" width="100%" alt="Três telas do iPhone: o feed, a conversa de um post em que o elenco de IA responde ao jogador e o perfil com as barras de fama, carisma e polêmica">
  </picture>
</p>

**Uma rede social em que só você é humano. O resto do elenco é IA.**

O Holofote é uma rede social de um jogador só, para iPhone. Você cria uma persona e um mundo e passa a postar, responder e mandar DMs enquanto um elenco de IA (rivais, amigos, fãs e perfis de fofoca) reage a você. Cada movimento tem consequências que dá para medir: seguidores, fama, carisma, polêmica e relações, todos calculados por um motor de regras, não pelo modelo. É um projeto pessoal, escrito em português do Brasil, com o backend rodando num servidor próprio.

## Recursos

- **Elenco todo de IA**, que responde, cita e manda DM em português do Brasil, lembrando do que você fez.
- **Números das regras, não do modelo**: curtidas, seguidores, atributos e relações saem de um motor testado.
- **Uma chamada de IA por ação**: um "diretor" planeja todas as reações de uma vez e as entrega aos poucos, com aviso de digitando.
- **Uma carreira para construir**: atos e marcos, premiações com discurso ao vivo, histórias com enquete e mapa de relações.
- **Energia como orçamento**: toda ação com IA gasta energia antes, que volta com o tempo ou com gemas.
- **Feito para iPhone**: temas claro e escuro, seis cores de destaque, animações fluidas e atualizações por ar com notas de versão.

## Como rodar

> [!NOTE]
> Você precisa de macOS com Xcode 27 e um simulador de iOS 26, Node.js 24 ou mais novo, pnpm 11 e Docker. Sem chave de API, o elenco responde com textos de teste, então dá para rodar tudo de graça.

```bash
git clone https://github.com/PHMFG/holofote.git
cd holofote
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/worker/.env.example apps/worker/.env
pnpm dev
```

O `pnpm dev` sobe o PostgreSQL e o Redis no Docker, a API em `http://localhost:3333/v1`, o worker e o Metro. Em outro terminal, compile e abra o app no simulador:

```bash
cd apps/mobile
LANG=en_US.UTF-8 npx expo run:ios --device "iPhone 16e"
```

Para o elenco de IA de verdade, ponha `LLM_PROVIDER=opencode-go` e a sua `LLM_API_KEY` no `apps/worker/.env`. A chave fica só no servidor e no worker, nunca no app.

## Como usar

1. Na primeira abertura, aceite o aviso sobre a IA, escolha nome e arroba, um universo (por exemplo, *Pop Brasil*) e quanto caos você quer. A IA escreve o elenco, os primeiros posts e o seu primeiro ato.
2. Escreva um post, escolha o tom e marque alguém. Antes de publicar, o motor estima o alcance só com regras, sem gastar tokens.
3. Publique e acompanhe: um cartão mostra o que mudou, as curtidas sobem com o tempo e o elenco começa a digitar e responder.

<p align="center">
  <img src="docs/assets/demo-cast-reacts.gif" width="300" alt="Animação: um post é publicado, um cartão mostra +82 seguidores e a história que a IA escreveu, e o contador de curtidas sobe">
</p>

<details>
<summary><b>Mais telas</b></summary>
<br>
<p align="center">
  <img src="docs/assets/screen-direct-messages.png" width="100%" alt="Mensagens diretas com a rival Vic Ferraz, nos temas claro e escuro"><br>
  <img src="docs/assets/screen-journey.png" width="100%" alt="Jornada: o primeiro ato, um marco liberado e os requisitos do próximo, nos temas claro e escuro"><br>
  <img src="docs/assets/screen-award-campaign.png" width="100%" alt="Campanha da premiação com os indicados, as chances estimadas e as ações de campanha, nos temas claro e escuro"><br>
  <img src="docs/assets/screen-relationships.png" width="100%" alt="Mapa de relações com alianças, relações neutras e rivais, nos temas claro e escuro">
</p>
</details>

## Como funciona

```mermaid
flowchart LR
  app["App do iPhone<br/>Expo, React Native"] <-->|HTTPS, WebSocket| api["API<br/>Fastify"]
  api --> db[("PostgreSQL<br/>pgvector")]
  api <-->|tarefas, eventos| redis[("Redis<br/>BullMQ, pub/sub")]
  redis <--> worker["Worker<br/>diretor, DMs, entregas"]
  worker -->|uma chamada por ação| llm["LLM<br/>DeepSeek V4.1 Flash"]
  worker --> db
  engine["Motor de regras<br/>packages/engine"] -.-> api
  engine -.-> worker
```

O monorepo tem o app (`apps/mobile`), a API (`apps/server`), o worker (`apps/worker`) e pacotes compartilhados para o motor de regras, a camada de IA, o banco, os contratos e os tokens de design. As notas de projeto ficam em [`docs/`](docs) e o guia para hospedar o servidor em [`infra/producao`](infra/producao/LEIAME.md).

> [!IMPORTANT]
> O que o jogador escreve vai para um modelo de linguagem de terceiros (DeepSeek, pelo OpenCode Go), para o elenco poder reagir. O app pede consentimento na primeira abertura e avisa para não escrever dados pessoais reais.

## Roadmap

- [x] Núcleo social: feed, conversas, DMs, histórias com enquete, alertas e curtidas que sobem com o tempo
- [x] Progressão: atos e marcos, premiações com discurso ao vivo, mapa de relações, registro com desfazer
- [x] Energia e gemas, com anúncio simulado e um plano Plus de mentira
- [x] Servidor próprio com atualizações por ar e notas de versão no app
- [ ] Entrar com a Apple (hoje cada aparelho ganha uma conta anônima)
- [ ] Notificações push
- [ ] Compras de verdade no app
- [ ] Distribuição pelo TestFlight
- [ ] Códigos de convite para um servidor compartilhado

## Licença e créditos

MIT © 2026 PHMFG. Veja a [LICENSE](LICENSE).

- [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans), dos Plus Jakarta Sans Project Authors, SIL Open Font License 1.1, usada no app e nas imagens deste README.
- Ícones [Lucide](https://lucide.dev), ISC.
- [Expo](https://expo.dev), [React Native](https://reactnative.dev), [Reanimated](https://docs.swmansion.com/react-native-reanimated/), [TanStack Query](https://tanstack.com/query), [Zustand](https://zustand.docs.pmnd.rs), [MMKV](https://github.com/mrousavy/react-native-mmkv), [Fastify](https://fastify.dev), [BullMQ](https://bullmq.io), [ioredis](https://github.com/redis/ioredis) e [Zod](https://zod.dev), MIT.
- [Drizzle ORM](https://orm.drizzle.team), o [AI SDK](https://ai-sdk.dev) e o [TypeScript](https://www.typescriptlang.org), Apache 2.0.
- Todos os personagens, posts e capturas deste repositório são fictícios.
