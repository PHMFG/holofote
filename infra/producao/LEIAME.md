# Holofote em produção (servidor de casa)

O backend roda no `servidor` (alias SSH `servidor`, Debian 13) em Docker e fica público em
HTTPS pelo Tailscale Funnel:

- API: https://seu-servidor.exemplo.ts.net/v1 (saúde em `/v1/saude`)
- Atualizações do app: https://seu-servidor.exemplo.ts.net/v1/atualizacoes/manifesto

Nada abre porta no roteador. Os containers reiniciam sozinhos (`restart: unless-stopped`), e
Docker e Tailscale sobem com o servidor.

## Pastas no servidor

| Caminho                   | O que é                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `~/holofote/codigo`       | Cópia do repositório (sem `node_modules`, `.env` e `ios/`)           |
| `~/holofote/segredos`     | `compose.env` (senha do banco, JWT, URL pública) e `worker.env` (IA) |
| `~/holofote/atualizacoes` | Atualizações do app, uma pasta por runtime e por envio               |

Os segredos são gerados no próprio servidor ou copiados por `scp`, nunca passam pelo git.

## Tarefas do dia a dia (do Mac, na raiz do repositório)

Mudou o backend (API, worker, banco):

```bash
infra/producao/implantar.sh
```

Mudou o app (telas, lógica, textos, imagens), sem módulo nativo novo:

```bash
cd apps/mobile && EXPO_PUBLIC_API_URL=https://seu-servidor.exemplo.ts.net pnpm publicar
```

O celular baixa a versão nova ao abrir o app e a aplica quando o jogador sai e volta.

Mudou algo nativo (biblioteca com código nativo, plugin, SDK, ícone): suba o `runtimeVersion` em
`apps/mobile/app.config.ts`, gere um `.ipa` novo e reinstale pelo AltStore. Atualizações por ar só
chegam a builds com o mesmo runtime.

Trocar a chave da IA (depois de mudar `apps/worker/.env` no Mac):

```bash
infra/producao/implantar.sh --chave
```

## Gerar o .ipa (AltStore)

```bash
cd apps/mobile
export LANG=en_US.UTF-8 EXPO_PUBLIC_API_URL=https://seu-servidor.exemplo.ts.net
npx expo prebuild --platform ios --clean
xcodebuild -workspace ios/Holofote.xcworkspace -scheme Holofote -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -archivePath build/Holofote.xcarchive archive \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=""
mkdir -p build/Payload && cp -R build/Holofote.xcarchive/Products/Applications/*.app build/Payload/
(cd build && zip -qry Holofote.ipa Payload)
```

O `.ipa` sai sem assinatura; o AltStore assina com o Apple ID do jogador. Depois do release, rode
`npx expo prebuild --platform ios --clean` sem a variável para voltar ao build do simulador.

## Ver o que está acontecendo

```bash
ssh servidor 'cd ~/holofote/codigo && docker compose -f infra/producao/docker-compose.yml --env-file ../segredos/compose.env ps'
ssh servidor 'docker logs --tail 50 -f holofote-worker-1'
ssh servidor 'tailscale funnel status'
```
