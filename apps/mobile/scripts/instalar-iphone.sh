#!/usr/bin/env bash
# Compila o app em Release, assina com o Apple ID do Xcode (conta grátis serve) e instala no
# iPhone ligado no cabo (ou pareado por Wi-Fi no Xcode). Substitui o AltStore.
#
# Uso (de apps/mobile):  pnpm instalar-iphone
# Antes, uma vez: Xcode > Ajustes > Contas com o seu Apple ID; iPhone confiando no Mac e com o
# Modo de Desenvolvedor ligado. Com conta grátis o app vale 7 dias: rode de novo para renovar.
#
# Variáveis opcionais: TEAM (ID do time, se o Xcode tiver mais de um), BUNDLE_ID (se o padrão já
# estiver registrado por outra pessoa na Apple), EXPO_PUBLIC_API_URL (servidor; padrão o de casa).
set -euo pipefail
cd "$(dirname "$0")/.."

export LANG=en_US.UTF-8
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://seu-servidor.exemplo.ts.net}"

# Time de assinatura: o primeiro que o Xcode conhece, se não vier em TEAM.
if [[ -z "${TEAM:-}" ]]; then
  TEAM="$(defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier 2>/dev/null \
    | grep -m1 -E 'teamID = ' | sed -E 's/.*teamID = "?([A-Z0-9]+)"?;.*/\1/' || true)"
fi
if [[ -z "${TEAM:-}" ]]; then
  echo "Nenhum time no Xcode. Abra Xcode > Ajustes > Contas e entre com o seu Apple ID." >&2
  exit 1
fi

# iPhone conectado (cabo ou Wi-Fi) que o Xcode enxerga.
LISTA="$(mktemp)"
trap 'rm -f "$LISTA"' EXIT
xcrun devicectl list devices --json-output "$LISTA" >/dev/null
APARELHO="$(node -e '
  const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).result.devices
    .filter((x) => x.hardwareProperties?.platform === "iOS" && x.hardwareProperties?.reality === "physical"
      && x.connectionProperties?.pairingState === "paired" && x.connectionProperties?.tunnelState !== "unavailable");
  console.log(d[0] ? `${d[0].identifier} ${d[0].hardwareProperties.udid}` : "");
' "$LISTA")"
read -r APARELHO UDID <<<"$APARELHO"
if [[ -z "${APARELHO:-}" ]]; then
  echo "Nenhum iPhone pareado. Ligue no cabo, toque em Confiar e ative o Modo de Desenvolvedor." >&2
  exit 1
fi

echo "Time $TEAM, aparelho $APARELHO, servidor $EXPO_PUBLIC_API_URL"
npx expo prebuild --platform ios --clean >/dev/null

EXTRA=()
if [[ -n "${BUNDLE_ID:-}" ]]; then EXTRA+=("PRODUCT_BUNDLE_IDENTIFIER=$BUNDLE_ID"); fi

xcodebuild -workspace ios/Holofote.xcworkspace -scheme Holofote -configuration Release \
  -destination "platform=iOS,id=$UDID" -derivedDataPath build/aparelho \
  -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic \
  ${EXTRA[@]+"${EXTRA[@]}"} -quiet build

xcrun devicectl device install app --device "$APARELHO" \
  build/aparelho/Build/Products/Release-iphoneos/Holofote.app

# Volta a pasta ios/ ao modo do simulador (sem servidor de produção nem updates por ar).
EXPO_PUBLIC_API_URL= npx expo prebuild --platform ios --clean >/dev/null
echo "Instalado. Na primeira vez, confie no desenvolvedor em Ajustes > Geral > VPN e Gerenciamento de Dispositivos."
