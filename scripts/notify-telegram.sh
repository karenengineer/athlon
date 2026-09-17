#!/usr/bin/env bash
# Turn off inherited tracing before any credential is read. Never print a raw
# curl error or Telegram response: either may contain the token-bearing URL.
set +x
set +v
set -euo pipefail
umask 077

warn() { printf 'Telegram notification warning: %s\n' "$1" >&2; }
for setting in TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID DEPLOY_STATUS DEPLOY_COMMIT DEPLOY_RUN_URL; do
  if [[ -z "${!setting:-}" ]]; then
    warn "Missing $setting; configure production secrets and trusted deployment metadata."
    exit 1
  fi
done
for tool in node curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    warn "Required tool $tool is unavailable (Node.js 22 and curl are required)."
    exit 1
  fi
done

if ! scratch="$(mktemp -d 2>/dev/null)"; then
  warn 'Cannot create private temporary request files.'
  exit 1
fi
payload_file="$scratch/payload.json"
response_file="$scratch/response.json"
cleanup() { rm -f -- "$payload_file" "$response_file"; rmdir -- "$scratch"; }
trap cleanup EXIT

# Environment values are data, never shell/JavaScript source. Node validates
# metadata and serializes JSON; only a bounded single-line subject is included.
if ! node > "$payload_file" 2>/dev/null <<'PAYLOAD'
const env = process.env;
const valid = /^[A-Za-z0-9:_-]{1,256}$/.test(env.TELEGRAM_BOT_TOKEN)
  && /^-?[0-9]{1,20}$/.test(env.TELEGRAM_CHAT_ID)
  && ['started', 'success', 'failure'].includes(env.DEPLOY_STATUS)
  && /^[a-fA-F0-9]{40}$/.test(env.DEPLOY_COMMIT)
  && env.DEPLOY_RUN_URL.length <= 512
  && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[0-9]+(?:\/attempts\/[0-9]+)?$/.test(env.DEPLOY_RUN_URL);
if (!valid) process.exit(1);
const subject = [...(env.DEPLOY_COMMIT_SUBJECT || 'not provided')
  .replace(/[\x00-\x1f\x7f-\x9f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu, ' ')]
  .slice(0, 160).join('');
const text = [
  'ATHLON / production',
  `Status: ${env.DEPLOY_STATUS}`,
  `Commit: ${env.DEPLOY_COMMIT.slice(0, 7).toLowerCase()}`,
  `Subject: ${subject}`,
  `Run: ${env.DEPLOY_RUN_URL}`,
].join('\n');
process.stdout.write(JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }));
PAYLOAD
then
  warn 'Invalid configuration or deployment metadata; use a safe bot token, numeric chat ID, started/success/failure status, full commit SHA and trusted GitHub HTTPS run URL.'
  exit 1
fi

# printf is a shell builtin: the token URL never becomes a process argument.
# --disable is first so local curlrc cannot enable traces, redirects or retries.
# The response is private, size-limited and never echoed on any failure path.
if ! http_status="$(printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$TELEGRAM_BOT_TOKEN" |
  curl --disable --config - --silent --show-error \
    --proto '=https' --connect-timeout 5 --max-time 15 --max-filesize 65536 \
    --request POST --header 'Content-Type: application/json' \
    --data-binary "@$payload_file" --output "$response_file" \
    --write-out '%{http_code}' 2>/dev/null)"; then
  warn 'Delivery unconfirmed: HTTPS request failed or timed out; check connectivity and production Telegram secrets.'
  exit 1
fi
if [[ ! "$http_status" =~ ^2[0-9][0-9]$ ]]; then
  warn 'Delivery unconfirmed: Telegram returned an unsuccessful HTTP status; check production Telegram secrets and bot access.'
  exit 1
fi
if ! node - "$response_file" 2>/dev/null <<'RESPONSE'
const fs = require('node:fs');
try {
  const body = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (!body || body.ok !== true) process.exit(1);
} catch {
  process.exit(1);
}
RESPONSE
then
  warn 'Delivery unconfirmed: Telegram API did not confirm success; check production Telegram secrets and bot access.'
  exit 1
fi
printf 'Telegram notification delivered.\n'
