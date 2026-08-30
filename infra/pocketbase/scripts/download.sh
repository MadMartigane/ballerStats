#!/usr/bin/env bash
# Download the PocketBase binary (v0.40.0) next to this directory if missing.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION="0.40.0"
PB_BIN="$ROOT_DIR/pocketbase"

if [ -x "$PB_BIN" ] && "$PB_BIN" --version 2>/dev/null | grep -q "$VERSION"; then
  echo "pocketbase $VERSION déjà présent ($PB_BIN)"
  exit 0
fi

case "$(uname -s)" in
  Linux) OS="linux" ;;
  Darwin) OS="darwin" ;;
  *)
    echo "OS non supporté: $(uname -s)" >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  x86_64 | amd64) ARCH="amd64" ;;
  aarch64 | arm64) ARCH="arm64" ;;
  *)
    echo "Architecture non supportée: $(uname -m)" >&2
    exit 1
    ;;
esac

URL="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_${OS}_${ARCH}.zip"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Téléchargement de PocketBase ${VERSION} (${OS}/${ARCH})..."
curl -fsSL "$URL" -o "$TMP_DIR/pb.zip"
unzip -oq "$TMP_DIR/pb.zip" -d "$TMP_DIR"
chmod +x "$TMP_DIR/pocketbase"
mv "$TMP_DIR/pocketbase" "$PB_BIN"

"$PB_BIN" version