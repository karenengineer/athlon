#!/usr/bin/env bash
set -euo pipefail
: "${ATHLON_SSH_KEY:?Set ATHLON_SSH_KEY to the downloaded Lightsail PEM path}"
REMOTE="ubuntu@18.158.105.59"
SSH=(ssh -i "$ATHLON_SSH_KEY" -o IdentitiesOnly=yes)
RSYNC_SSH="ssh -i $ATHLON_SSH_KEY -o IdentitiesOnly=yes"

seed_mode=0
case "$#" in
  0)
    ;;
  1)
    if [[ "$1" != "--seed" ]]; then
      printf 'Usage: %s [--seed]\n' "$0" >&2
      exit 2
    fi
    seed_mode=1
    ;;
  *)
    printf 'Usage: %s [--seed]\n' "$0" >&2
    exit 2
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

"${SSH[@]}" "$REMOTE" bash -s < "$SCRIPT_DIR/bootstrap-production-server.sh"

rsync -az \
  -e "$RSYNC_SSH" \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'build/' \
  --exclude '.next/' \
  --exclude '.angular/' \
  --exclude 'coverage/' \
  --exclude 'uploads/' \
  --exclude 'backups/' \
  --exclude '*.tsbuildinfo' \
  --exclude '*.pem' \
  --exclude '*.PEM' \
  "$REPO_ROOT/" "$REMOTE:/opt/athlon/"

"${SSH[@]}" "$REMOTE" bash -s -- "$seed_mode" <<'REMOTE_SCRIPT'
set -euo pipefail

seed_mode="$1"
cd /opt/athlon

env_tmp=''
cleanup_env_tmp() {
  if [[ -n "$env_tmp" && -e "$env_tmp" ]]; then
    rm -f -- "$env_tmp"
  fi
}
trap cleanup_env_tmp EXIT

if [[ ! -e .env ]]; then
  umask 077
  postgres_password="$(openssl rand -hex 32)"
  access_token_secret="$(openssl rand -hex 32)"
  refresh_token_secret="$(openssl rand -hex 32)"
  env_tmp="$(mktemp .env.tmp.XXXXXX)"

  while IFS= read -r line || [[ -n "$line" ]]; do
    key="${line%%=*}"
    case "$key" in
      POSTGRES_PASSWORD)
        printf 'POSTGRES_PASSWORD=%s\n' "$postgres_password"
        ;;
      DATABASE_URL)
        printf 'DATABASE_URL=postgresql://athlon:%s@postgres:5432/athlon?schema=public\n' \
          "$postgres_password"
        ;;
      ACCESS_TOKEN_SECRET)
        printf 'ACCESS_TOKEN_SECRET=%s\n' "$access_token_secret"
        ;;
      REFRESH_TOKEN_SECRET)
        printf 'REFRESH_TOKEN_SECRET=%s\n' "$refresh_token_secret"
        ;;
      *)
        printf '%s\n' "$line"
        ;;
    esac
  done < infrastructure/production.env.example > "$env_tmp"

  chmod 600 "$env_tmp"
  mv "$env_tmp" .env
  env_tmp=''
fi

if [[ ! -f .env ]]; then
  printf '/opt/athlon/.env is not a regular file.\n' >&2
  exit 1
fi
chmod 600 .env

read_env_value() {
  local key="$1"
  awk -v key="$key" '
    index($0, key "=") == 1 {
      sub(/^[^=]*=/, "")
      print
      exit
    }
  ' .env
}

if [[ "$seed_mode" == 1 ]]; then
  admin_email="$(read_env_value ADMIN_EMAIL)"
  admin_password="$(read_env_value ADMIN_PASSWORD)"
  if [[ -z "$admin_email" || -z "$admin_password" ]]; then
    printf 'Set non-empty ADMIN_EMAIL and ADMIN_PASSWORD in /opt/athlon/.env before using --seed.\n' >&2
    exit 1
  fi
fi

site_domain="$(read_env_value SITE_DOMAIN)"
if [[ -z "$site_domain" ]]; then
  printf 'SITE_DOMAIN must be set in /opt/athlon/.env.\n' >&2
  exit 1
fi

COMPOSE=(docker compose --env-file .env -f infrastructure/docker-compose.production.yml)
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" build api web
"${COMPOSE[@]}" up -d --wait postgres
"${COMPOSE[@]}" run --rm migrate

if [[ "$seed_mode" == 1 ]]; then
  "${COMPOSE[@]}" run --rm --no-deps seed
fi

"${COMPOSE[@]}" up -d --no-deps --wait api
"${COMPOSE[@]}" up -d --no-deps --wait web
"${COMPOSE[@]}" up -d --no-deps --wait caddy
"${COMPOSE[@]}" exec -T api node -e \
  "fetch('http://127.0.0.1:3000/api/v1/health/live').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"
curl --fail --silent --show-error --output /dev/null --max-time 30 \
  -H "Host: $site_domain" http://127.0.0.1/
REMOTE_SCRIPT
