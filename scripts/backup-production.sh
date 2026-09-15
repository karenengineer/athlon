#!/usr/bin/env bash
set -euo pipefail

cd /opt/athlon

if [[ ! -f .env ]]; then
  printf '/opt/athlon/.env is missing.\n' >&2
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

POSTGRES_USER="$(read_env_value POSTGRES_USER)"
POSTGRES_DB="$(read_env_value POSTGRES_DB)"
if [[ -z "$POSTGRES_USER" || -z "$POSTGRES_DB" ]]; then
  printf 'POSTGRES_USER and POSTGRES_DB must be set in /opt/athlon/.env.\n' >&2
  exit 1
fi

mkdir -p /opt/athlon/backups
backup="/opt/athlon/backups/athlon-$(date +%Y%m%d-%H%M%S).sql.gz"
if [[ -e "$backup" ]]; then
  printf 'Backup path already exists; run the command again.\n' >&2
  exit 1
fi

cleanup_failed_backup() {
  local status=$?
  if [[ "$status" -ne 0 && -f "$backup" ]]; then
    rm -f -- "$backup"
  fi
  exit "$status"
}
trap cleanup_failed_backup EXIT

docker compose --env-file .env -f infrastructure/docker-compose.production.yml \
  exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip -9 > "$backup"
test -s "$backup"
chmod 600 "$backup"

trap - EXIT
printf '%s\n' "$backup"
