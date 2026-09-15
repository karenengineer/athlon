#!/usr/bin/env bash
set -euo pipefail
: "${ATHLON_SSH_KEY:?Set ATHLON_SSH_KEY to the downloaded Lightsail PEM path}"
REMOTE="ubuntu@18.158.105.59"
SSH=(
  ssh
  -i "$ATHLON_SSH_KEY"
  -o IdentitiesOnly=yes
  -o BatchMode=yes
  -o ConnectTimeout=15
  -o ConnectionAttempts=2
  -o ControlMaster=no
  -o ControlPath=none
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=3
)
printf -v RSYNC_SSH \
  'ssh -i %q -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 -o ConnectionAttempts=2 -o ControlMaster=no -o ControlPath=none -o ServerAliveInterval=15 -o ServerAliveCountMax=3' \
  "$ATHLON_SSH_KEY"

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

rsync -az --timeout=60 \
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
  --exclude '*.[pP][eE][mM]' \
  "$REPO_ROOT/" "$REMOTE:/opt/athlon/"

"${SSH[@]}" "$REMOTE" bash -s -- "$seed_mode" <<'REMOTE_SCRIPT'
set -euo pipefail

seed_mode="$1"
cd /opt/athlon
umask 077

exec 9>.env.lock
if ! flock -w 60 9; then
  printf 'Timed out waiting for the production environment lock.\n' >&2
  exit 1
fi

if [[ ! -e .env ]]; then
  postgres_password="$(openssl rand -hex 32)"
  access_token_secret="$(openssl rand -hex 32)"
  refresh_token_secret="$(openssl rand -hex 32)"

  env_contents=''
  while IFS= read -r line || [[ -n "$line" ]]; do
    key="${line%%=*}"
    case "$key" in
      POSTGRES_PASSWORD)
        rendered_line="POSTGRES_PASSWORD=$postgres_password"
        ;;
      DATABASE_URL)
        rendered_line="DATABASE_URL=postgresql://athlon:$postgres_password@postgres:5432/athlon?schema=public"
        ;;
      ACCESS_TOKEN_SECRET)
        rendered_line="ACCESS_TOKEN_SECRET=$access_token_secret"
        ;;
      REFRESH_TOKEN_SECRET)
        rendered_line="REFRESH_TOKEN_SECRET=$refresh_token_secret"
        ;;
      *)
        rendered_line="$line"
        ;;
    esac
    env_contents+="$rendered_line"$'\n'
  done < infrastructure/production.env.example

  set -o noclobber
  if ! exec 8>.env; then
    set +o noclobber
    printf 'The production environment appeared during creation; refusing to overwrite it.\n' >&2
    exit 1
  fi
  set +o noclobber
  printf '%s' "$env_contents" >&8
  exec 8>&-
fi

flock -u 9
exec 9>&-

if [[ ! -f .env ]]; then
  printf '/opt/athlon/.env is not a regular file.\n' >&2
  exit 1
fi
chmod 600 .env

read_dotenv_value() {
  local key="$1"
  local raw
  raw="$(awk -v key="$key" '
    {
      line = $0
      sub(/^[[:space:]]*/, "", line)
      if (substr(line, 1, length(key)) == key) {
        rest = substr(line, length(key) + 1)
        if (rest ~ /^[[:space:]]*=/) {
          sub(/^[[:space:]]*=[[:space:]]*/, "", rest)
          value = rest
          found = 1
        }
      }
    }
    END {
      if (found) print value
    }
  ' .env)"
  raw="${raw%$'\r'}"
  raw="${raw#"${raw%%[![:space:]]*}"}"
  raw="${raw%"${raw##*[![:space:]]}"}"

  case "${raw:0:1}" in
    '"')
      raw="${raw:1}"
      raw="${raw%%\"*}"
      ;;
    "'")
      raw="${raw:1}"
      raw="${raw%%\'*}"
      ;;
    *)
      raw="${raw%%[[:space:]]#*}"
      raw="${raw%"${raw##*[![:space:]]}"}"
      ;;
  esac

  printf '%s' "$raw"
}

if [[ "$seed_mode" == 1 ]]; then
  admin_email="$(read_dotenv_value ADMIN_EMAIL)"
  admin_password="$(read_dotenv_value ADMIN_PASSWORD)"
  if [[ -z "$admin_email" || -z "$admin_password" ]]; then
    printf 'Set non-empty ADMIN_EMAIL and ADMIN_PASSWORD in /opt/athlon/.env before using --seed.\n' >&2
    exit 1
  fi
fi

site_domain="$(read_dotenv_value SITE_DOMAIN)"
if [[ -z "$site_domain" ]]; then
  printf 'SITE_DOMAIN must be set in /opt/athlon/.env.\n' >&2
  exit 1
fi

COMPOSE=(docker compose --env-file .env -f infrastructure/docker-compose.production.yml)
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" build api web
"${COMPOSE[@]}" up -d --wait --wait-timeout 120 postgres
"${COMPOSE[@]}" run --rm migrate

if [[ "$seed_mode" == 1 ]]; then
  "${COMPOSE[@]}" run --rm --no-deps seed
fi

"${COMPOSE[@]}" up -d --no-deps --wait --wait-timeout 120 api
"${COMPOSE[@]}" up -d --no-deps --wait --wait-timeout 120 web
"${COMPOSE[@]}" up -d --no-deps --wait --wait-timeout 120 caddy
"${COMPOSE[@]}" exec -T api node -e \
  "fetch('http://127.0.0.1:3000/api/v1/health/live', { signal: AbortSignal.timeout(15000) }).then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"
curl --fail --silent --show-error --output /dev/null --connect-timeout 10 --max-time 30 \
  -H "Host: $site_domain" http://127.0.0.1/
REMOTE_SCRIPT
