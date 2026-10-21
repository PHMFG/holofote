#!/usr/bin/env bash
# Envia o backend para o servidor de casa (alias SSH "servidor") e sobe os containers.
# Rode da raiz do repositório no Mac: infra/producao/implantar.sh
# Na primeira vez cria os segredos no servidor (senha do banco e do JWT, gerados lá) e copia o
# apps/worker/.env (chave da IA) sem exibir nada. Depois disso só atualiza o código.
set -euo pipefail
cd "$(dirname "$0")/../.."
source infra/producao/config.sh

# Alias SSH do servidor (infra/producao/.env); fora de casa use SSH_HOST=<alias pelo Tailscale>.
HOST="${SSH_HOST:-servidor}"
DESTINO='~/holofote'

ssh "$HOST" "mkdir -p $DESTINO/codigo $DESTINO/segredos $DESTINO/atualizacoes && chmod 700 $DESTINO/segredos"

rsync -az --delete \
  --include '.env.example' --exclude '.env' --exclude '.env.*' \
  --exclude node_modules --exclude .git --exclude .turbo \
  --exclude apps/mobile/ios --exclude apps/mobile/android --exclude apps/mobile/.expo \
  --exclude docs/telas --exclude 'apps/mobile/assets' \
  ./ "$HOST:$DESTINO/codigo/"

# Segredos gerados no próprio servidor, uma vez só.
ssh "$HOST" "cd $DESTINO/segredos && if [ ! -f compose.env ]; then
  umask 077
  printf 'POSTGRES_PASSWORD=%s\nJWT_SEGREDO=%s\nURL_PUBLICA=\n' \"\$(openssl rand -hex 24)\" \"\$(openssl rand -hex 32)\" > compose.env
  echo 'segredos criados'
fi"

# Chave da IA: copiada só se ainda não existir lá (use --chave para trocar).
if [ "${1:-}" = "--chave" ] || ! ssh "$HOST" "test -f $DESTINO/segredos/worker.env"; then
  scp -q apps/worker/.env "$HOST:$DESTINO/segredos/worker.env"
  ssh "$HOST" "chmod 600 $DESTINO/segredos/worker.env"
  echo 'chave da IA copiada'
fi

ssh "$HOST" "cd $DESTINO/codigo && docker compose -f infra/producao/docker-compose.yml --env-file ../segredos/compose.env up -d --build --remove-orphans && docker compose -f infra/producao/docker-compose.yml --env-file ../segredos/compose.env ps"
