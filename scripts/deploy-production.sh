#!/usr/bin/env bash
set -euo pipefail
die() { printf '%s\n' "$*" >&2; exit 2; }
seed_mode=0
bootstrap_mode=0
for arg in "$@"; do
  case "$arg" in
    --seed) seed_mode=1 ;;
    --bootstrap) bootstrap_mode=1 ;;
    *) die "Usage: $0 [--bootstrap] [--seed]" ;;
  esac
done
[[ "${ATHLON_SKIP_BOOTSTRAP:-0}" == 0 || "${ATHLON_SKIP_BOOTSTRAP:-0}" == 1 ]] || die 'ATHLON_SKIP_BOOTSTRAP must be 0 or 1.'
ci_mode=0
if [[ "${ATHLON_SKIP_BOOTSTRAP:-0}" == 1 || ( -n "${CI:-}" && "${CI:-}" != false && "${CI:-}" != 0 ) ]]; then
  ci_mode=1
  [[ "$seed_mode" == 0 ]] || die 'CI deployment forbids --seed.'
  [[ "$bootstrap_mode" == 0 ]] || die 'CI deployment forbids --bootstrap.'
  [[ -n "${ATHLON_SSH_HOST:-}" && -n "${ATHLON_SSH_USER:-}" && -n "${ATHLON_DEPLOY_REVISION:-}" ]] || die 'CI requires explicit host, user and full commit revision.'
fi
: "${ATHLON_SSH_KEY:?Set ATHLON_SSH_KEY to the private deployment key path}"
: "${ATHLON_KNOWN_HOSTS:?Set ATHLON_KNOWN_HOSTS to a vetted known-hosts file path}"
[[ -f "$ATHLON_SSH_KEY" && -r "$ATHLON_SSH_KEY" ]] || die 'Deployment key must be a readable file.'
[[ -f "$ATHLON_KNOWN_HOSTS" && -r "$ATHLON_KNOWN_HOSTS" && -s "$ATHLON_KNOWN_HOSTS" ]] || die 'Trusted known-hosts file must be readable and nonempty.'
for path in "$ATHLON_SSH_KEY" "$ATHLON_KNOWN_HOSTS"; do
  [[ "$path" != *$'\n'* && "$path" != *$'\r'* ]] || die 'SSH file paths must not contain line breaks.'
done
host="${ATHLON_SSH_HOST-18.158.105.59}"
user="${ATHLON_SSH_USER-ubuntu}"
[[ "$host" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] || die 'Unsafe SSH host.'
[[ "$user" =~ ^[a-z_][a-z0-9_-]*$ ]] || die 'Unsafe SSH user.'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
revision="${ATHLON_DEPLOY_REVISION:-$(git -C "$REPO_ROOT" rev-parse HEAD)}"
[[ "$revision" =~ ^[0-9a-fA-F]{40}$ ]] || die 'Deployment revision must be a full hexadecimal commit SHA.'
REMOTE="$user@$host"
SSH=(ssh -i "$ATHLON_SSH_KEY" -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$ATHLON_KNOWN_HOSTS"
  -o ConnectTimeout=15 -o ConnectionAttempts=2 -o ControlMaster=no
  -o ControlPath=none -o ServerAliveInterval=15 -o ServerAliveCountMax=3)
printf -v RSYNC_SSH '%q ' "${SSH[@]}"
EXCLUDES=(.git .superpowers/ .worktrees/ .vscode/ .idea/ .codex/ .claude/ .cursor/
  .ssh/ .aws/ .DS_Store .env '.env.*' '*.key' '*.p12' '*.pfx'
  node_modules/ dist/ build/ .next/ .angular/ coverage/ uploads/ backups/
  .deploy-staging/ releases/ .release.lock .env.lock REVISION .previous-images
  '.previous-images.*' '.REVISION.*' '*.tsbuildinfo' '*.[pP][eE][mM]')
RSYNC_EXCLUDES=()
for exclusion in "${EXCLUDES[@]}"; do RSYNC_EXCLUDES+=("--exclude=$exclusion"); done
if [[ "$bootstrap_mode" == 1 ]]; then
  "${SSH[@]}" "$REMOTE" bash -s < "$SCRIPT_DIR/bootstrap-production-server.sh"
fi
# Upload only to a unique private stage; a single final connection owns the lock
# from promotion through public smoke and successful revision recording.
stage="$("${SSH[@]}" "$REMOTE" bash -s <<'STAGE_SCRIPT'
set -euo pipefail
umask 077
[[ -d /opt/athlon && -O /opt/athlon && ! -L /opt/athlon ]] || { printf 'Provision an owned /opt/athlon first.\n' >&2; exit 1; }
[[ ! -L /opt/athlon/.deploy-staging ]] || exit 1
install -d -m 700 /opt/athlon/.deploy-staging
mktemp -d /opt/athlon/.deploy-staging/source.XXXXXXXXXXXX
STAGE_SCRIPT
)"
[[ "$stage" =~ ^/opt/athlon/\.deploy-staging/source\.[A-Za-z0-9]{12}$ ]] || die 'Unexpected remote staging path.'
rsync -az --timeout=60 -e "$RSYNC_SSH" "${RSYNC_EXCLUDES[@]}" "$REPO_ROOT/" "$REMOTE:$stage/"
"${SSH[@]}" "$REMOTE" bash -s -- "$stage" "$revision" "$seed_mode" "$bootstrap_mode" "$ci_mode" <<'REMOTE_SCRIPT'
set -euo pipefail
stage="$1"
revision="$2"
seed_mode="$3"
bootstrap_mode="$4"
ci_mode="$5"
[[ "$stage" =~ ^/opt/athlon/\.deploy-staging/source\.[A-Za-z0-9]{12}$ && -d "$stage" && -O "$stage" && ! -L "$stage" && ! -L /opt/athlon/.deploy-staging ]] || exit 1
[[ "$revision" =~ ^[0-9a-fA-F]{40}$ ]] || exit 1
cd /opt/athlon
umask 077
[[ ! -L .release.lock && ! -L .env && ! -L .previous-images && ! -L REVISION ]] || exit 1
exec 9>.release.lock
flock -w 600 9 || { printf 'Timed out waiting for the production release lock.\n' >&2; exit 1; }
if [[ "$ci_mode" == 1 && ! -f .env ]]; then
  printf 'CI requires an already provisioned /opt/athlon/.env.\n' >&2; exit 1
fi
excludes=(.git .superpowers/ .worktrees/ .vscode/ .idea/ .codex/ .claude/ .cursor/
  .ssh/ .aws/ .DS_Store .env '.env.*' '*.key' '*.p12' '*.pfx'
  node_modules/ dist/ build/ .next/ .angular/ coverage/ uploads/ backups/
  .deploy-staging/ releases/ .release.lock .env.lock REVISION .previous-images
  '.previous-images.*' '.REVISION.*' '*.tsbuildinfo' '*.[pP][eE][mM]')
rsync_excludes=()
for exclusion in "${excludes[@]}"; do rsync_excludes+=("--exclude=$exclusion"); done
rsync -a --timeout=60 "${rsync_excludes[@]}" "$stage/" /opt/athlon/
if [[ ! -e .env ]]; then
  [[ "$bootstrap_mode" == 1 ]] || { printf 'Use explicit --bootstrap for first provisioning.\n' >&2; exit 1; }
  postgres_password="$(openssl rand -hex 32)"
  access_token_secret="$(openssl rand -hex 32)"
  refresh_token_secret="$(openssl rand -hex 32)"
  set -o noclobber
  exec 8>.env
  set +o noclobber
  while IFS= read -r line || [[ -n "$line" ]]; do
    case "${line%%=*}" in
      POSTGRES_PASSWORD) line="POSTGRES_PASSWORD=$postgres_password" ;;
      DATABASE_URL) line="DATABASE_URL=postgresql://athlon:$postgres_password@postgres:5432/athlon?schema=public" ;;
      ACCESS_TOKEN_SECRET) line="ACCESS_TOKEN_SECRET=$access_token_secret" ;;
      REFRESH_TOKEN_SECRET) line="REFRESH_TOKEN_SECRET=$refresh_token_secret" ;;
    esac
    printf '%s\n' "$line" >&8
  done < infrastructure/production.env.example
  exec 8>&-
fi
[[ -f .env ]] || exit 1
read_dotenv_value() {
  local raw
  raw="$(awk -v key="$1" '
    { line=$0; sub(/^[[:space:]]*/, "", line)
      if (substr(line, 1, length(key)) == key) {
        rest=substr(line, length(key)+1)
        if (rest ~ /^[[:space:]]*=/) { sub(/^[[:space:]]*=[[:space:]]*/, "", rest); value=rest; found=1 }
      }
    } END { if (found) print value }' .env)"
  raw="${raw%$'\r'}"
  raw="${raw#"${raw%%[![:space:]]*}"}"
  raw="${raw%"${raw##*[![:space:]]}"}"
  case "${raw:0:1}" in
    '"') raw="${raw:1}"; raw="${raw%%\"*}" ;;
    "'") raw="${raw:1}"; raw="${raw%%\'*}" ;;
    *) raw="${raw%%[[:space:]]#*}"; raw="${raw%"${raw##*[![:space:]]}"}" ;;
  esac
  printf '%s' "$raw"
}
if [[ "$seed_mode" == 1 ]]; then
  [[ -n "$(read_dotenv_value ADMIN_EMAIL)" && -n "$(read_dotenv_value ADMIN_PASSWORD)" ]] || {
    printf 'Set non-empty ADMIN_EMAIL and ADMIN_PASSWORD in /opt/athlon/.env before using --seed.\n' >&2; exit 1;
  }
fi
[[ "$(read_dotenv_value SITE_DOMAIN)" == athlonsport.am ]] || { printf 'SITE_DOMAIN must be athlonsport.am.\n' >&2; exit 1; }
COMPOSE=(docker compose --env-file .env -f infrastructure/docker-compose.production.yml)
"${COMPOSE[@]}" config --quiet
# Preserve actual running image IDs under unique retained tags before building.
# A first provision has no running application to preserve.
rollback_id="${stage##*.}"
manifest="$(mktemp /opt/athlon/.previous-images.XXXXXXXXXXXX)"
for service in api web; do
  container="$("${COMPOSE[@]}" ps -q "$service")"
  if [[ -n "$container" ]]; then
    [[ "$container" != *$'\n'* ]] || { printf 'Expected one application container.\n' >&2; exit 1; }
    image="$(docker inspect --format '{{.Image}}' "$container")"
    [[ "$image" == sha256:* ]] || exit 1
    tag="athlon-$service:rollback-$rollback_id"
    docker image tag "$image" "$tag"
    printf '%s=%s\n' "$service" "$tag" >> "$manifest"
  fi
done
mv -- "$manifest" .previous-images
# Build-only Compose uses the exact staged checkout, not stale retained source.
# Explicit image names stay unchanged; runtime operations keep /opt/athlon's
# Compose project/env and persistent volumes, never a staging project.
docker compose --env-file /opt/athlon/.env -f "$stage/infrastructure/docker-compose.production.yml" build api web
"${COMPOSE[@]}" up -d --wait --wait-timeout 120 postgres
bash scripts/backup-production.sh
"${COMPOSE[@]}" run --rm --interactive=false migrate
if [[ "$seed_mode" == 1 ]]; then "${COMPOSE[@]}" run --rm --no-deps --interactive=false seed; fi
for service in api web caddy; do
  "${COMPOSE[@]}" up -d --no-deps --wait --wait-timeout 120 "$service"
done
bash scripts/smoke-production.sh
revision_file="$(mktemp /opt/athlon/.REVISION.XXXXXXXXXXXX)"
printf '%s\n' "$revision" > "$revision_file"
mv -- "$revision_file" REVISION
# Stages, retained images and backups are operator-managed; no broad deletion.
REMOTE_SCRIPT
