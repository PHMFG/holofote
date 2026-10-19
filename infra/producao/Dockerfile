# Imagem única da API e do worker (o comando muda no compose). Roda o TypeScript direto com tsx,
# como no dev: os pacotes internos exportam o fonte (ver CLAUDE.md).
FROM node:24-slim

ENV CI=1 \
    NODE_ENV=production \
    TZ=UTC
RUN npm install -g pnpm@11.21.0 && rm -rf /root/.npm

WORKDIR /app

# Só os manifestos primeiro: a camada do pnpm install só refaz quando as dependências mudam.
# O package.json do app entra para o lockfile bater, mas o app não é instalado (--filter).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/worker/package.json apps/worker/
COPY apps/mobile/package.json apps/mobile/
COPY packages/db/package.json packages/db/
COPY packages/engine/package.json packages/engine/
COPY packages/llm/package.json packages/llm/
COPY packages/shared/package.json packages/shared/
COPY packages/tokens/package.json packages/tokens/
RUN pnpm install --frozen-lockfile --prod=false \
      --filter "@holofote/server..." --filter "@holofote/worker..." --filter "@holofote/db..."

COPY packages/db packages/db
COPY packages/engine packages/engine
COPY packages/llm packages/llm
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/worker apps/worker
