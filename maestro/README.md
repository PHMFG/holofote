# Fluxos Maestro

Rodam no simulador "iPhone 16e" contra a API, o worker e o Metro locais.

1. Suba o Docker (`pnpm dev` sobe Postgres e Redis), a API (`pnpm --filter @holofote/server dev`),
   o worker (`pnpm --filter @holofote/worker dev`; com `LLM_PROVIDER=opencode-go` para a IA de
   verdade) e o Metro (`pnpm --filter @holofote/mobile start`).
2. Instale o app de desenvolvimento no simulador (`npx expo run:ios` em `apps/mobile`).
3. Para começar com um jogador novo, zere o chaveiro do simulador (o id do aparelho fica lá; o
   mundo antigo continua no banco):

```bash
xcrun simctl keychain booted reset
```

4. Rode da raiz do repositório, na ordem (as capturas vão para `docs/telas/`):

```bash
~/.maestro/bin/maestro test maestro/criar-mundo-e-postar.yaml
```

```bash
~/.maestro/bin/maestro test maestro/energia-debug.yaml
```

O Maestro 2 grava as capturas dentro da pasta do resultado. Copie para `docs/telas/` depois de
cada execução:

```bash
cp "$(ls -td ~/.maestro/tests/*/ | head -1)"*/takeScreenshot/docs/telas/*.png docs/telas/
```

| Fluxo                       | O que cobre                                                                       |
| --------------------------- | --------------------------------------------------------------------------------- |
| `criar-mundo-e-postar.yaml` | Consentimento, criar mundo pela IA, resumo do dia, feed, postar, reações chegando |
| `energia-debug.yaml`        | Gastar até zero, abrir a folha Sem energia, recarregar no debug, postar de novo   |
| `abrir-app.yaml`            | Sub-fluxo: abre o dev client no Metro local e fecha o menu de desenvolvedor       |

Fluxos de captura extras (rodam com o mundo criado por `criar-mundo-e-postar.yaml`):

| Fluxo                 | O que cobre                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `tour-telas.yaml`     | Passeio por todas as telas, claro e escuro (usa `passeio.yaml`)                                       |
| `evento-ao-vivo.yaml` | Avança o relógio do mundo até as 18h05 do evento e captura 16 e 17 ao vivo (precisa de `APARELHO_ID`) |
| `marco-liberado.yaml` | Captura 18 · Marco liberado; antes, libere o marco 1 no banco (instrução no cabeçalho do fluxo)       |

Depois das capturas, reduza para no máximo 1266 px de altura: `sips -Z 1266 docs/telas/*.png`.
