#!/usr/bin/env bash
# Bootstrap DEV ONLY: creates the local superuser, the demo club, its owner
# and the owner club_members row. Idempotent. Never run against production.
#
# Requires PocketBase to be running (pnpm run pb:serve).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PB_BIN="$ROOT_DIR/pocketbase"
BASE_URL="${POCKETBASE_URL:-http://127.0.0.1:8090}"

SUPERUSER_EMAIL="dev@baller.local"
DEV_PASSWORD="DevDevDev1!"
OWNER_EMAIL="owner@baller.local"
OWNER_NAME="Dev Owner"
CLUB_NAME="Dev Club"

"$SCRIPT_DIR/download.sh"

echo "==> upsert superuser $SUPERUSER_EMAIL (données locales uniquement)"
"$PB_BIN" superuser upsert "$SUPERUSER_EMAIL" "$DEV_PASSWORD" --dir "$ROOT_DIR/pb_data"

echo "==> attente de l'API sur $BASE_URL"
for _i in $(seq 1 30); do
  if curl -fsS "$BASE_URL/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! curl -fsS "$BASE_URL/api/health" >/dev/null 2>&1; then
  echo "PocketBase ne répond pas sur $BASE_URL (lancer 'pnpm run pb:serve' d'abord)" >&2
  exit 1
fi

echo "==> connexion superuser"
SUPER_TOKEN="$(curl -fsS -X POST "$BASE_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$SUPERUSER_EMAIL\",\"password\":\"$DEV_PASSWORD\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')"

api() { # METHOD PATH [JSON_BODY]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -fsS -X "$method" "$BASE_URL$path" \
      -H 'Content-Type: application/json' \
      -H "Authorization: $SUPER_TOKEN" \
      -d "$body"
  else
    curl -fsS -X "$method" "$BASE_URL$path" \
      -H 'Content-Type: application/json' \
      -H "Authorization: $SUPER_TOKEN"
  fi
}

json_field() { # JSON_STDIN FIELD
  python3 -c "import sys,json;print(json.load(sys.stdin).get('$1'))"
}

first_item_id() { # JSON_STDIN
  python3 -c 'import sys,json;items=json.load(sys.stdin).get("items",[]);print(items[0]["id"] if items else "")'
}

urlenc() { # VALUE -> percent-encoded
  python3 -c 'import urllib.parse,sys;sys.stdout.write(urllib.parse.quote(sys.argv[1]))' "$1"
}

# --- owner user ---------------------------------------------------------
FILTER_OWNER="$(urlenc "email='$OWNER_EMAIL'")"
OWNER_ID="$(api GET "/api/collections/users/records?perPage=1&filter=$FILTER_OWNER" | first_item_id)"
if [ -z "$OWNER_ID" ]; then
  echo "==> création du user $OWNER_EMAIL"
  OWNER_ID="$(api POST /api/collections/users/records \
    "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$DEV_PASSWORD\",\"passwordConfirm\":\"$DEV_PASSWORD\",\"name\":\"$OWNER_NAME\"}" \
    | json_field "id")"
else
  echo "==> reset du mot de passe de $OWNER_EMAIL (idempotent)"
  api PATCH "/api/collections/users/records/$OWNER_ID" \
    "{\"email\":\"$OWNER_EMAIL\",\"password\":\"$DEV_PASSWORD\",\"passwordConfirm\":\"$DEV_PASSWORD\",\"name\":\"$OWNER_NAME\"}" >/dev/null
fi

# --- club ----------------------------------------------------------------
FILTER_CLUB="$(urlenc "name='$CLUB_NAME'")"
CLUB_ID="$(api GET "/api/collections/clubs/records?perPage=1&filter=$FILTER_CLUB" | first_item_id)"
if [ -z "$CLUB_ID" ]; then
  echo "==> création du club $CLUB_NAME"
  CLUB_ID="$(api POST /api/collections/clubs/records \
    "{\"name\":\"$CLUB_NAME\",\"owner\":\"$OWNER_ID\"}" \
    | json_field "id")"
fi

# --- club_members (owner) --------------------------------------------------
FILTER_MEM="$(urlenc "club='$CLUB_ID'&&user='$OWNER_ID'")"
MEM_COUNT="$(api GET "/api/collections/club_members/records?perPage=1&filter=$FILTER_MEM" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("totalItems",0))')"
if [ "$MEM_COUNT" = "0" ]; then
  echo "==> ajout du rôle owner dans club_members"
  api POST /api/collections/club_members/records \
    "{\"club\":\"$CLUB_ID\",\"user\":\"$OWNER_ID\",\"role\":\"owner\"}" >/dev/null
fi

echo ""
echo "=== BallerStats PocketBase local — prêt ==="
echo "Admin UI    : http://127.0.0.1:8090/_/"
echo "Superuser   : $SUPERUSER_EMAIL / $DEV_PASSWORD"
echo "Owner login : $OWNER_EMAIL / $DEV_PASSWORD  (club: $CLUB_NAME)"
echo "SPA         : utiliser VITE_POCKETBASE_URL=$BASE_URL"
echo "(identifiants de DEV uniquement — ne jamais utiliser en production)"