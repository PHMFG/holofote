#!/usr/bin/env bash
# Prepara o servidor (Debian 13) para hospedar o Holofote: Docker com o plugin compose e o
# Tailscale, ambos dos repositórios oficiais. Idempotente: rodar de novo não quebra nada.
set -euo pipefail

if ! command -v docker >/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq ca-certificates curl rsync
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
fi

if ! command -v tailscale >/dev/null; then
  . /etc/os-release
  sudo curl -fsSL "https://pkgs.tailscale.com/stable/debian/${VERSION_CODENAME}.noarmor.gpg" \
    -o /usr/share/keyrings/tailscale-archive-keyring.gpg
  sudo curl -fsSL "https://pkgs.tailscale.com/stable/debian/${VERSION_CODENAME}.tailscale-keyring.list" \
    -o /etc/apt/sources.list.d/tailscale.list
  sudo apt-get update -qq
  sudo apt-get install -y -qq tailscale
fi

sudo systemctl enable --now docker tailscaled
mkdir -p ~/holofote/atualizacoes
docker --version
docker compose version
tailscale version | head -1
echo PRONTO
