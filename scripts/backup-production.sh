#!/usr/bin/env bash
set -euo pipefail
umask 077

cd /opt/athlon

if [[ ! -f .env ]]; then
  printf '/opt/athlon/.env is missing.\n' >&2
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

POSTGRES_USER="$(read_dotenv_value POSTGRES_USER)"
POSTGRES_DB="$(read_dotenv_value POSTGRES_DB)"
if [[ -z "$POSTGRES_USER" || -z "$POSTGRES_DB" ]]; then
  printf 'POSTGRES_USER and POSTGRES_DB must be set in /opt/athlon/.env.\n' >&2
  exit 1
fi

install -d -m 700 /opt/athlon/backups
backup="/opt/athlon/backups/athlon-$(date +%Y%m%d-%H%M%S).sql.gz"
if ! (set -o noclobber; : > "$backup") 2>/dev/null; then
  printf 'Backup path already exists; run the command again.\n' >&2
  exit 1
fi

backup_created=1
cleanup_failed_backup() {
  local status=$?
  if [[ "$status" -ne 0 && "$backup_created" == 1 && -f "$backup" ]]; then
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
