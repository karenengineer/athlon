#!/usr/bin/env bash
set -euo pipefail
# Only the external HTTPS boundary is replaced. Capture the actual request's
# arguments/config/payload; hostile failures deliberately contain the fixture
# token to prove they never reach the notifier's user-visible output.
curl() {
  if [[ "${1:-}" == --disable && "${2:-}" == --version ]]; then
    case "${TELEGRAM_TEST_CURL_VERSION:-supported}" in
      supported) printf 'curl 8.5.0 (fixture) libcurl/8.5.0\n' ;;
      old) printf 'curl 8.3.0 (fixture) libcurl/8.3.0\n' ;;
      malformed) printf '%s\n' "$TELEGRAM_BOT_TOKEN" ;;
      stalled) while :; do :; done ;;
    esac
    return 0
  fi
  printf '%s\n' "$@" > "$TELEGRAM_TEST_FIXTURE/args"
  local config='' output='' payload='' connect='' max='' limit=''
  local disable=0 https=0 silent=0
  [[ "${1:-}" == --disable ]] && disable=1
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --config) config="$2"; shift 2 ;;
      --output) output="$2"; shift 2 ;;
      --data-binary) payload="${2#@}"; shift 2 ;;
      --connect-timeout) connect="$2"; shift 2 ;;
      --max-time) max="$2"; shift 2 ;;
      --max-filesize) limit="$2"; shift 2 ;;
      --proto) [[ "$2" == '=https' ]] && https=1; shift 2 ;;
      --silent) silent=1; shift ;;
      --header|--request|--write-out) shift 2 ;;
      *) shift ;;
    esac
  done
  [[ "$config" == - && "$disable" == 1 && "$https" == 1 && "$silent" == 1 ]] || return 91
  [[ "$connect" =~ ^[0-9]+$ && "$connect" -gt 0 && "$connect" -le 10 ]] || return 92
  [[ "$max" =~ ^[0-9]+$ && "$max" -gt 0 && "$max" -le 30 ]] || return 93
  [[ "$limit" =~ ^[0-9]+$ && "$limit" -gt 0 && "$limit" -le 65536 ]] || return 94
  [[ -n "$output" && -f "$payload" ]] || return 95
  cat > "$TELEGRAM_TEST_FIXTURE/config"
  cp "$payload" "$TELEGRAM_TEST_FIXTURE/payload.json"
  stat -f '%Lp' "$payload" > "$TELEGRAM_TEST_FIXTURE/mode" 2>/dev/null || stat -c '%a' "$payload" > "$TELEGRAM_TEST_FIXTURE/mode"
  case "${TELEGRAM_TEST_RESPONSE:-success}" in
    success) printf '{"ok":true,"result":{"message_id":42}}' > "$output"; printf 200 ;;
    http) printf '{"ok":true,"description":"%s"}' "$TELEGRAM_BOT_TOKEN" > "$output"; printf 500 ;;
    redirect) printf '{"ok":true}' > "$output"; printf 302 ;;
    api) printf '{"ok":false,"description":"%s"}' "$TELEGRAM_BOT_TOKEN" > "$output"; printf 200 ;;
    malformed) printf '%s' "$TELEGRAM_BOT_TOKEN" > "$output"; printf 200 ;;
    truthy) printf '{"ok":"true"}' > "$output"; printf 200 ;;
    empty) : > "$output"; printf 200 ;;
    timeout) printf 'curl: timeout https://api.telegram.org/bot%s/sendMessage\n' "$TELEGRAM_BOT_TOKEN" >&2; return 28 ;;
    transport) printf 'curl: TLS failure %s\n' "$TELEGRAM_BOT_TOKEN" >&2; return 60 ;;
  esac
}
# This script doubles as a PATH-level curl fixture, so even `command curl`
# cannot fall through to the real network executable.
if [[ "${BASH_SOURCE[0]##*/}" == curl ]]; then
  curl "$@"
  exit
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture="$(mktemp -d)"
trap 'rm -rf -- "$fixture"' EXIT
mkdir "$fixture/bin"
ln -s "$ROOT/scripts/tests/notify-telegram.test.sh" "$fixture/bin/curl"
export PATH="$fixture/bin:$PATH"
export TELEGRAM_TEST_FIXTURE="$fixture"
export TELEGRAM_BOT_TOKEN='123456:secret-fixture_TOKEN'
export TELEGRAM_CHAT_ID='-100123456789'
export DEPLOY_STATUS=success
export DEPLOY_COMMIT=143cb18b5704bc6186de3453e96d84b20e50e569
export DEPLOY_RUN_URL=https://github.com/fixture/athlon/actions/runs/12345
export DEPLOY_COMMIT_SUBJECT='Release "catalog" \\ fixes <b>plain text</b>'

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

run() {
  rm -f -- "$fixture/args" "$fixture/config" "$fixture/payload.json"
  local result=0
  "$@" > "$fixture/stdout" 2> "$fixture/stderr" || result=$?
  if grep -Fq -- "$TELEGRAM_BOT_TOKEN" "$fixture/stdout" "$fixture/stderr"; then fail 'token leaked to output'; fi
  if grep -Fq -- "$TELEGRAM_CHAT_ID" "$fixture/stdout" "$fixture/stderr"; then fail 'chat ID leaked to output'; fi
  return "$result"
}
reject() {
  if run "$@"; then fail 'unconfirmed or unsafe notification accepted'; fi
  [[ -s "$fixture/stderr" ]] || fail 'failure has no actionable warning'
}
reject_before_network() {
  reject "$@"
  [[ ! -e "$fixture/args" ]] || fail 'invalid configuration reached network'
}

[[ -f "$ROOT/scripts/notify-telegram.sh" ]] || fail 'notifier behavior is missing'
for version in old malformed stalled; do
  reject_before_network env TELEGRAM_TEST_CURL_VERSION="$version" bash "$ROOT/scripts/notify-telegram.sh"
done
printf 'PASS: curl >=8.4 prerequisite rejects old/invalid/stalled version probes before secret-bearing requests\n'
for status in started success failure; do
  run env DEPLOY_STATUS="$status" bash "$ROOT/scripts/notify-telegram.sh" || fail "$status delivery was not confirmed"
  TEST_STATUS="$status" node <<'ASSERT'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = process.env.TELEGRAM_TEST_FIXTURE;
const payload = JSON.parse(fs.readFileSync(`${root}/payload.json`, 'utf8'));
assert.deepEqual(Object.keys(payload).sort(), ['chat_id', 'text']);
assert.equal(payload.chat_id, '-100123456789');
assert.equal(payload.text, `ATHLON / production\nStatus: ${process.env.TEST_STATUS}\nCommit: 143cb18\nSubject: Release "catalog" \\\\ fixes <b>plain text</b>\nRun: https://github.com/fixture/athlon/actions/runs/12345`);
const args = fs.readFileSync(`${root}/args`, 'utf8').trim().split('\n');
assert(!args.join('\n').includes(process.env.TELEGRAM_BOT_TOKEN));
assert.equal(args[args.indexOf('--request') + 1], 'POST');
assert.equal(args[args.indexOf('--header') + 1], 'Content-Type: application/json');
assert(!args.some(arg => ['--insecure', '-k', '--location', '-L', '--verbose', '-v', '--trace', '--trace-ascii'].includes(arg)));
const responseFile = args[args.indexOf('--output') + 1];
const payloadFile = args[args.indexOf('--data-binary') + 1].slice(1);
assert(!fs.existsSync(responseFile));
assert(!fs.existsSync(payloadFile));
assert(!fs.existsSync(require('node:path').dirname(payloadFile)));
assert.equal(fs.readFileSync(`${root}/config`, 'utf8'), `url = "https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage"\n`);
assert.equal(fs.readFileSync(`${root}/mode`, 'utf8').trim(), '600');
ASSERT
done
printf 'PASS: statuses, plain serialized JSON, short SHA/run URL, private payload and token-free curl arguments\n'

for field in TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID DEPLOY_STATUS DEPLOY_COMMIT DEPLOY_RUN_URL; do
  reject_before_network env "$field=" bash "$ROOT/scripts/notify-telegram.sh"
  grep -Fq "$field" "$fixture/stderr" || fail 'missing configuration warning does not identify required setting'
done
reject_before_network env DEPLOY_STATUS='success;echo injected' bash "$ROOT/scripts/notify-telegram.sh"
reject_before_network env DEPLOY_COMMIT='main' bash "$ROOT/scripts/notify-telegram.sh"
reject_before_network env DEPLOY_RUN_URL='https://evil.example/actions/runs/1' bash "$ROOT/scripts/notify-telegram.sh"
reject_before_network env DEPLOY_RUN_URL=$'https://github.com/fixture/athlon/actions/runs/1\nmalicious' bash "$ROOT/scripts/notify-telegram.sh"
reject_before_network env TELEGRAM_CHAT_ID=$'1\nurl = "https://evil.example"' bash "$ROOT/scripts/notify-telegram.sh"
reject_before_network env TELEGRAM_BOT_TOKEN=$'token"\nurl = "https://evil.example"' bash "$ROOT/scripts/notify-telegram.sh"
reject_before_network env TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN"$'\n' bash "$ROOT/scripts/notify-telegram.sh"
reject_before_network env TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID"$'\n' bash "$ROOT/scripts/notify-telegram.sh"
reject_before_network env DEPLOY_COMMIT="$DEPLOY_COMMIT"$'\n' bash "$ROOT/scripts/notify-telegram.sh"
reject_before_network env DEPLOY_RUN_URL="$DEPLOY_RUN_URL"$'\n' bash "$ROOT/scripts/notify-telegram.sh"
printf 'PASS: missing settings and invalid/unsafe metadata rejected before network\n'

for response in http redirect api malformed truthy empty timeout transport; do
  reject env TELEGRAM_TEST_RESPONSE="$response" bash "$ROOT/scripts/notify-telegram.sh"
  [[ -e "$fixture/args" ]] || fail "$response never exercised the HTTP boundary"
done
printf 'PASS: HTTP/API/malformed/empty/timeout/TLS failures are nonzero and sanitized\n'

run env DEPLOY_COMMIT_SUBJECT=$'first\nsecond\rthird\tcontrol\033[31m\342\200\250line\342\200\256bidi\342\200\217mark\330\234arabic' bash "$ROOT/scripts/notify-telegram.sh" || fail 'control metadata delivery'
node <<'ASSERT'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const text = JSON.parse(fs.readFileSync(`${process.env.TELEGRAM_TEST_FIXTURE}/payload.json`, 'utf8')).text;
assert.equal(text.split('\n').length, 5);
assert(!/[\x00-\x09\x0b-\x1f\x7f-\x9f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u.test(text));
ASSERT
long_subject="$(printf '%0200d' 0)"
run env DEPLOY_COMMIT_SUBJECT="$long_subject" bash "$ROOT/scripts/notify-telegram.sh" || fail 'bounded metadata delivery'
node <<'ASSERT'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const text = JSON.parse(fs.readFileSync(`${process.env.TELEGRAM_TEST_FIXTURE}/payload.json`, 'utf8')).text;
const subject = text.split('\n').find(line => line.startsWith('Subject: ')).slice(9);
assert.equal([...subject].length, 160);
ASSERT
run env DEPLOY_COMMIT_SUBJECT= bash "$ROOT/scripts/notify-telegram.sh" || fail 'optional subject should not block delivery'
printf 'PASS: control characters removed and optional commit metadata bounded to one line\n'

reject env TELEGRAM_TEST_RESPONSE=timeout bash -x "$ROOT/scripts/notify-telegram.sh"
printf 'PASS: inherited shell tracing cannot expose credentials\n'
