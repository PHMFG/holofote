#!/usr/bin/env bash
# Publica uma atualização por ar (JS e assets) do app no servidor, sem EAS.
#
# Uso (de apps/mobile):  EXPO_PUBLIC_API_URL=https://host.ts.net pnpm publicar
#
# Exporta o app para iOS, junta o expoConfig.json e envia por rsync/ssh ao host `servidor`, em
# ~/holofote/atualizacoes/<runtimeVersion>/<timestamp>/. A API serve a pasta de maior timestamp
# (apps/server/src/rotas/atualizacoes.ts); o app a baixa ao abrir e a aplica ao voltar para ele.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${EXPO_PUBLIC_API_URL:-}" ]]; then
  echo "Defina EXPO_PUBLIC_API_URL (a URL pública da API, a mesma do build instalado)." >&2
  exit 1
fi

HOST_SSH="servidor"
BASE_REMOTA="holofote/atualizacoes"
export LANG="${LANG:-en_US.UTF-8}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Exportando o app para iOS..."
npx expo export --platform ios --output-dir "$TMP"

# Config pública do app: o servidor a devolve no manifesto (extra.expoClient).
npx expo config --json --type public > "$TMP/expoConfig.json"

# A pasta do servidor é nomeada pela versão de runtime do build; ela tem de bater com o .ipa.
RUNTIME="$(node -p "const r = require(process.argv[1]).runtimeVersion; typeof r === 'string' ? r : ''" "$TMP/expoConfig.json")"
if [[ -z "$RUNTIME" ]]; then
  echo "runtimeVersion não encontrada no expoConfig.json (precisa ser um texto fixo)." >&2
  exit 1
fi

AGORA="$(date +%s)"
DESTINO="$BASE_REMOTA/$RUNTIME/$AGORA"
# Envia para uma pasta temporária (nome não numérico, que a API ignora) e renomeia no fim,
# para o app nunca ver uma atualização pela metade.
TEMPORARIO="$BASE_REMOTA/$RUNTIME/.enviando-$AGORA"

echo "Enviando para $HOST_SSH:~/$DESTINO ..."
ssh "$HOST_SSH" "mkdir -p '$TEMPORARIO'"
rsync -az --delete -e ssh "$TMP/" "$HOST_SSH:$TEMPORARIO/"
ssh "$HOST_SSH" "mv '$TEMPORARIO' '$BASE_REMOTA/$RUNTIME/$AGORA'"

ID="$(shasum -a 256 "$TMP/metadata.json" | cut -c1-32)"
echo "Atualização publicada."
echo "  runtime:  $RUNTIME"
echo "  hora:     $AGORA ($(date -r "$AGORA" '+%Y-%m-%d %H:%M:%S'))"
echo "  id:       ${ID:0:8}-${ID:8:4}-${ID:12:4}-${ID:16:4}-${ID:20:12}"
echo "No celular: abra o app (baixa a versão nova) e saia e volte para ele (aplica)."
