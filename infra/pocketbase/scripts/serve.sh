#!/usr/bin/env bash
# Serve PocketBase locally (127.0.0.1:8090) with the BallerStats
# migrations, hooks and data directory. Downloads the binary first.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PB_BIN="$ROOT_DIR/pocketbase"

"$SCRIPT_DIR/download.sh"
mkdir -p "$ROOT_DIR/pb_data"

exec "$PB_BIN" serve \
  --http=127.0.0.1:8090 \
  --dir "$ROOT_DIR/pb_data" \
  --migrationsDir "$ROOT_DIR/pb_migrations" \
  --hooksDir "$ROOT_DIR/pb_hooks" \
  --automigrate=0 \
  --origins=http://127.0.0.1:3000 \
  --origins=http://localhost:3000