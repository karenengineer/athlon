#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"' EXIT
mkdir -p "$fixture/bin" "$fixture/remote"
export TEST_FIXTURE="$fixture" TEST_ROOT="$ROOT"
export TEST_NODE="$(command -v node)"
export ATHLON_SSH_KEY="$fixture/key" ATHLON_KNOWN_HOSTS="$fixture/known_hosts"
export ATHLON_SSH_HOST=deploy.example.test ATHLON_SSH_USER=ubuntu
export ATHLON_DEPLOY_REVISION=143cb18b5704bc6186de3453e96d84b20e50e569 ATHLON_SKIP_BOOTSTRAP=1
touch "$ATHLON_SSH_KEY"
printf 'fixture trusted host key\n' > "$ATHLON_KNOWN_HOSTS"
export PATH="$fixture/bin:$PATH"

# External operations are fixtures. SSH runs the actual remote program only after
# replacing its fixed production path with this exact temporary directory.
make_stub() { cp "$ROOT/scripts/tests/fixtures/$1" "$fixture/bin/$1"; chmod +x "$fixture/bin/$1"; }
for tool in ssh rsync docker curl flock mv date timeout; do make_stub "$tool"; done
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
reject() {
  : > "$fixture/events"
  if "$@" > "$fixture/output" 2>&1; then fail 'unsafe invocation accepted'; fi
  [[ ! -s "$fixture/events" ]] || fail 'rejected invocation reached network'
}

# Removing CI seed rejection must fail this case with an otherwise valid SHA.
reject bash "$ROOT/scripts/deploy-production.sh" --seed
printf 'PASS: CI seed rejected before network\n'
reject env ATHLON_DEPLOY_REVISION= bash "$ROOT/scripts/deploy-production.sh"
reject env ATHLON_DEPLOY_REVISION='main;false' bash "$ROOT/scripts/deploy-production.sh"
reject env ATHLON_SSH_HOST='-oProxyCommand=false' bash "$ROOT/scripts/deploy-production.sh"
reject env ATHLON_SSH_USER='ubuntu;false' bash "$ROOT/scripts/deploy-production.sh"
reject env ATHLON_KNOWN_HOSTS="$fixture/missing" bash "$ROOT/scripts/deploy-production.sh"
touch "$fixture/empty-hosts"
reject env ATHLON_KNOWN_HOSTS="$fixture/empty-hosts" bash "$ROOT/scripts/deploy-production.sh"
reject env ATHLON_SSH_HOST= bash "$ROOT/scripts/deploy-production.sh"
reject env ATHLON_SSH_USER= bash "$ROOT/scripts/deploy-production.sh"
reject env CI=true ATHLON_SKIP_BOOTSTRAP=0 bash "$ROOT/scripts/deploy-production.sh" --bootstrap
reject env CI=1 ATHLON_SKIP_BOOTSTRAP=0 bash "$ROOT/scripts/deploy-production.sh" --seed
printf 'PASS: CI settings and trusted hosts validated before network\n'

printf 'SITE_DOMAIN=athlonsport.am\nPOSTGRES_USER=fixture\nPOSTGRES_DB=fixture\nSERVER_ENV_SENTINEL\n' > "$fixture/remote/.env"
cp "$fixture/remote/.env" "$fixture/env-before"
printf 'old-revision\n' > "$fixture/remote/REVISION"
reset_events() { : > "$fixture/events"; }
reset_events
bash "$ROOT/scripts/deploy-production.sh" > "$fixture/output" 2>&1 || { cat "$fixture/output"; fail 'deploy success'; }
if grep -q backup-consumed-release-stdin "$fixture/events"; then fail 'backup consumed remaining SSH release commands'; fi
for sentinel in 'interactive=false migrate' 'wait-timeout 120 api' 'wait-timeout 120 web' 'wait-timeout 120 caddy' 'health/live' revision-write; do
  grep -q "$sentinel" "$fixture/events" || fail "stdin-executed release skipped $sentinel"
done
cmp "$fixture/remote/.env" "$fixture/env-before" || fail 'server env changed'
[[ "$(cat "$fixture/remote/REVISION")" == "$ATHLON_DEPLOY_REVISION" ]] || fail 'revision not recorded'
stages=("$fixture/remote/.deploy-staging/"source.*)
[[ ! -e "${stages[0]}/.git" && ! -e "${stages[0]}/.env" && ! -e "${stages[0]}/.superpowers" ]] || fail 'private checkout state uploaded'
grep -Fq 'StrictHostKeyChecking=yes' "$fixture/events" || fail 'missing host pinning'
grep -Fq "UserKnownHostsFile=$ATHLON_KNOWN_HOSTS" "$fixture/events" || fail 'missing trusted file'
grep -Fq 'exclude=.superpowers/' "$fixture/events" || fail 'scratch copied'
grep -Fq 'exclude=.worktrees/' "$fixture/events" || fail 'worktrees copied'
grep -Fq 'stage-upload' "$fixture/events" || fail 'no isolated source upload'
if grep -Eq 'bootstrap|seed|down -v|volume rm|env-upload' "$fixture/events"; then fail 'unsafe CI operation'; fi
order() {
  local first second
  first="$(grep -n -m 1 "$1" "$fixture/events" | cut -d: -f1)"
  second="$(grep -n -m 1 "$2" "$fixture/events" | cut -d: -f1)"
  [[ "$first" -lt "$second" ]] || fail "$1 must precede $2"
}
order release-lock source-promotion
order source-promotion 'build api web'
order 'tag sha256:old-api' 'build api web'
order 'tag sha256:old-web' 'build api web'
grep 'build api web' "$fixture/events" | grep -q '\.deploy-staging/source\..*/infrastructure/docker-compose.production.yml' || fail 'build did not use isolated verified staged source'
order pg_dump 'interactive=false migrate'
order 'health/live' revision-write
[[ "$(cat "$fixture/remote/.previous-images")" == *'athlon-api:rollback-'* ]] || fail 'saved rollback tags missing'
printf 'PASS: staged locked promotion, real prior tags, backup/migrate, smoke/revision and env preservation\n'

mkdir -p "$fixture/checkout/scripts" "$fixture/checkout/.codex"
cp "$ROOT/scripts/deploy-production.sh" "$ROOT/scripts/backup-production.sh" "$ROOT/scripts/smoke-production.sh" "$fixture/checkout/scripts/"
cp -R "$ROOT/infrastructure" "$fixture/checkout/"
printf 'fixture-private-key\n' > "$fixture/checkout/private.key"
printf 'fixture-editor-state\n' > "$fixture/checkout/.codex/state"
reset_events
bash "$fixture/checkout/scripts/deploy-production.sh" > "$fixture/output" 2>&1 || { cat "$fixture/output"; fail 'credential exclusion deploy'; }
for staged in "$fixture/remote/.deploy-staging/"source.*; do
  [[ ! -e "$staged/private.key" && ! -e "$staged/.codex" ]] || fail 'credential or agent/editor state uploaded'
done
cmp "$fixture/remote/.env" "$fixture/env-before" || fail 'server env changed'
printf 'PASS: credential files and agent/editor state excluded from real fixture synchronization\n'

mv "$fixture/remote/.env" "$fixture/env-saved"
reset_events
if bash "$ROOT/scripts/deploy-production.sh" > "$fixture/output" 2>&1; then fail 'CI provisioned env requirement'; fi
if grep -q source-promotion "$fixture/events"; then fail 'source promoted without provisioned env'; fi
mv "$fixture/env-saved" "$fixture/remote/.env"
printf 'PASS: missing server environment rejected before promotion\n'

for failure in backup migrate health page products redirect hsts www lock build; do
  printf 'old-revision\n' > "$fixture/remote/REVISION"
  reset_events
  if TEST_FAIL="$failure" bash "$ROOT/scripts/deploy-production.sh" > "$fixture/output" 2>&1; then fail "$failure accepted"; fi
  [[ "$(cat "$fixture/remote/REVISION")" == old-revision ]] || fail "$failure overwrote revision"
  if grep -q backup-consumed-release-stdin "$fixture/events"; then fail "$failure backup consumed SSH program stdin"; fi
  if [[ "$failure" != lock && "$failure" != build && "$failure" != backup ]]; then
    grep -q 'interactive=false migrate' "$fixture/events" || { cat "$fixture/output"; fail "$failure failed before its expected boundary"; }
  fi
  if [[ "$failure" == backup ]] && grep -q 'interactive=false migrate' "$fixture/events"; then fail 'migration after failed backup'; fi
  if [[ "$failure" == lock ]] && grep -q source-promotion "$fixture/events"; then fail 'promotion without lock'; fi
done
printf 'PASS: lock/build/backup/migration and every public smoke failure preserve REVISION\n'

# A standalone caller also deserves an intact continuation, without needing to
# know the backup implementation's Docker stdin behavior.
reset_events
bash -s -- "$fixture/remote/scripts/backup-production.sh" > "$fixture/output" 2>&1 <<'BACKUP_CALLER'
set -euo pipefail
bash "$1"
printf 'backup-caller-continuation\n' >> "$TEST_FIXTURE/events"
BACKUP_CALLER
if grep -q backup-consumed-release-stdin "$fixture/events"; then fail 'standalone backup consumed caller continuation'; fi
grep -q backup-caller-continuation "$fixture/events" || fail 'standalone backup skipped caller continuation'
reset_events
if TEST_FAIL=backup bash -s -- "$fixture/remote/scripts/backup-production.sh" > "$fixture/output" 2>&1 <<'BACKUP_FAILURE'
set -euo pipefail
bash "$1"
printf 'failed-backup-caller-continuation\n' >> "$TEST_FIXTURE/events"
BACKUP_FAILURE
then fail 'standalone backup failure was masked'; fi
if grep -q failed-backup-caller-continuation "$fixture/events"; then fail 'caller continued after failed backup'; fi
printf 'PASS: stdin-consuming dump cannot skip caller/release continuation; backup failures propagate\n'

reset_events
bash "$ROOT/scripts/smoke-production.sh" > "$fixture/output" 2>&1 || { cat "$fixture/output"; fail 'standalone smoke'; }
if grep -Eq -- '(^| )-k( |$)|--insecure' "$fixture/events"; then fail 'TLS bypass'; fi
for locale in hy ru en; do
  grep -Fq "https://athlonsport.am/$locale" "$fixture/events" || fail 'missing locale page'
  grep -Fq "products?locale=$locale" "$fixture/events" || fail 'missing localized products'
done
printf 'PASS: standalone smoke checks trusted TLS, redirect, HSTS, health JSON and HY/RU/EN catalog\n'

# Exercise the no-host-Node path with only fixtures/standard text tools reachable.
mkdir "$fixture/minimal"
for tool in bash grep tr; do ln -s "$(command -v "$tool")" "$fixture/minimal/$tool"; done
for tool in curl docker timeout; do ln -s "$fixture/bin/$tool" "$fixture/minimal/$tool"; done
reset_events
PATH="$fixture/minimal" /bin/bash "$ROOT/scripts/smoke-production.sh" > "$fixture/output" 2>&1 || { cat "$fixture/output"; fail 'container JSON fallback'; }
grep -q 'exec -T api node -e' "$fixture/events" || fail 'container JSON parser not used'
grep -q 'timeout --kill-after=5 20 docker compose' "$fixture/events" || fail 'container JSON startup is not bounded'
if TEST_FAIL=health PATH="$fixture/minimal" /bin/bash "$ROOT/scripts/smoke-production.sh" > "$fixture/output" 2>&1; then fail 'container JSON fallback accepted invalid health'; fi
printf 'PASS: container Node fallback validates explicitly piped JSON with non-TTY stdin\n'
