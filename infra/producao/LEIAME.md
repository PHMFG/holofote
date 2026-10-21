# Holofote em produção (servidor de casa)

O backend roda num servidor Linux de casa (Debian), em Docker, e fica público em HTTPS pelo
Tailscale Funnel. O endereço público e os aliases SSH ficam em `infra/producao/.env`, fora do git
(formato em [`.env.example`](.env.example)):

- API: `<URL_PUBLICA>/v1` (saúde em `/v1/saude`)
- Atualizações do app: `<URL_PUBLICA>/v1/atualizacoes/manifesto`

Nada abre porta no roteador. Os containers reiniciam sozinhos (`restart: unless-stopped`), e
Docker e Tailscale sobem com o servidor. Para preparar um servidor novo (Docker e Tailscale dos
repositórios oficiais): `infra/producao/preparar-servidor.sh`, depois `tailscale up` e
`tailscale funnel --bg 3333` nele.

## Pastas no servidor

| Caminho                   | O que é                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `~/holofote/codigo`       | Cópia do repositório (sem `node_modules`, `.env` e `ios/`)           |
| `~/holofote/segredos`     | `compose.env` (senha do banco, JWT, URL pública) e `worker.env` (IA) |
| `~/holofote/atualizacoes` | Atualizações do app, uma pasta por runtime e por envio               |

Os segredos são gerados no próprio servidor ou copiados por `scp`, nunca passam pelo git.

Fora de casa, o Mac alcança o servidor pelo Tailscale: tenha no `~/.ssh/config` um segundo alias
apontando para o nome do servidor no Tailscale e rode os scripts com `SSH_HOST=<esse alias>`.

## Tarefas do dia a dia (do Mac, na raiz do repositório)

Mudou o backend (API, worker, banco):

```bash
infra/producao/implantar.sh
```

Mudou o app (telas, lógica, textos, imagens), sem módulo nativo novo:

```bash
cd apps/mobile && pnpm publicar
```

O celular baixa a versão nova ao abrir o app e a aplica quando o jogador sai e volta. Antes de
publicar, ponha uma entrada no topo de `apps/mobile/src/novidades.ts` com o que mudou, em frases
curtas para o jogador: o app abre mostrando essas notas uma vez, e o histórico fica no perfil. O
`pnpm publicar` recusa publicar sem uma entrada nova.

Mudou algo nativo (biblioteca com código nativo, plugin, SDK, ícone): suba o `runtimeVersion` em
`apps/mobile/app.config.ts` e instale de novo no iPhone (abaixo). Atualizações por ar só chegam a
builds com o mesmo runtime.

Trocar a chave da IA (depois de mudar `apps/worker/.env` no Mac):

```bash
infra/producao/implantar.sh --chave
```

## Instalar no iPhone

```bash
cd apps/mobile && pnpm instalar-iphone
```

Compila em Release apontando para `URL_PUBLICA`, assina com o Apple ID do Xcode (conta grátis
serve; `TEAM` em `infra/producao/.env`) e instala no iPhone ligado no cabo ou no mesmo Wi-Fi. Uma
vez só: Xcode > Ajustes > Apple Accounts com o Apple ID, Modo de Desenvolvedor ligado no iPhone e
o desenvolvedor autorizado em Ajustes > Geral > VPN e Gerenciamento de Dispositivos. Com conta
grátis o app vale 7 dias: rode o mesmo comando para renovar (os dados ficam no servidor).

## Ver o que está acontecendo

```bash
ssh servidor 'cd ~/holofote/codigo && docker compose -f infra/producao/docker-compose.yml --env-file ../segredos/compose.env ps'
ssh servidor 'docker logs --tail 50 -f holofote-worker-1'
ssh servidor 'tailscale funnel status'
```
