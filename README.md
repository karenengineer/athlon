# ATHLON

Production-oriented monorepo foundation for the ATHLON sports nutrition and accessories catalog.

## Requirements

- Node.js 22 (>=22.12.0; Actions use 22.22.2)
- pnpm 11.19.0 (the pinned packageManager version)
- Docker with Docker Compose

## Local setup

```bash
cp .env.example .env
pnpm install
docker compose -f infrastructure/docker-compose.yml up -d postgres
pnpm --filter @athlon/api db:deploy
pnpm --filter @athlon/api db:seed
pnpm dev
```

The API is available at `http://localhost:3000/api/v1`. Swagger UI is available at
`http://localhost:3000/api/docs`. The Angular application runs at `http://localhost:4200`
and proxies browser API requests to the NestJS development server.

To create the initial administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`
before running the seed. The password must contain at least 12 characters.

Uploaded image variants are stored under `UPLOAD_DIR` (local development defaults to
`./uploads`). The application uses a storage adapter so an object-storage implementation
can replace local disk storage later without changing the catalog domain.

## Verification

```bash
pnpm verify
```

This checks formatting, the Prisma schema, TypeScript, lint, tests, end-to-end tests,
the production build and production-shaped SSR. `pnpm test:ops` separately checks
shell syntax, isolated deploy/notifier behavior and parsed workflow security contracts.
CI additionally runs the isolated actual PostgreSQL suite and a bounded native Linux
`flock` contention/wait/release probe. A passing primitive probe plus deployment
fixtures is not proof of live concurrent production deployment behavior.

## Production operations

The production host is the `athlon-production` Lightsail instance at
`18.158.105.59`. Keep the downloaded Lightsail PEM file private, and never commit it
or a production `.env` file. The deployment script excludes both from synchronization;
the server keeps its protected environment at `/opt/athlon/.env` with mode `600`.

### DNS

At the domain registrar, create or replace these A records. Do not change unrelated
records such as MX or TXT records.

| Name  | Value           |
| ----- | --------------- |
| `@`   | `18.158.105.59` |
| `www` | `18.158.105.59` |

### First deployment and initial administrator

From a clean local checkout, set the PEM path and restrict access to the key:

```bash
export ATHLON_SSH_KEY=/Users/karenengineer/Downloads/LightsailDefaultKey-eu-central-1.pem
export ATHLON_KNOWN_HOSTS=/absolute/path/to/vetted-known_hosts
chmod 600 "$ATHLON_SSH_KEY"
./scripts/deploy-production.sh --bootstrap
```

Only the explicit `--bootstrap` operation bootstraps the host, generates database and token secrets,
and creates `/opt/athlon/.env` only if it does not already exist. It does not overwrite
an existing production environment. Before seeding, connect to the host and set
non-empty `ADMIN_EMAIL` and `ADMIN_PASSWORD` values in that protected file; do not put
the password in shell history, a commit, or chat.

```bash
ssh -i "$ATHLON_SSH_KEY" ubuntu@18.158.105.59
cd /opt/athlon
chmod 600 .env
```

Edit `.env` with a terminal editor, set the administrator values, then exit the SSH
session. The initial password must have at least 12 characters. Run the explicit seed
operation once the values are set:

```bash
./scripts/deploy-production.sh --seed
```

The `--seed` flag is deliberately rejected if either administrator value is empty.

### Deploying updates and checking services

After reviewing and committing a release locally, run the same deployment script
without `--seed`. It synchronizes the source (while preserving the server `.env`,
uploads, and backups), builds the API and web images, runs migrations, waits for
services, and checks public trusted HTTPS, www HTTPS, HTTP redirect, HSTS, health JSON,
HY/RU/EN pages and each localized products API. A backup is required before migrations.
Source uploads use unique private staging directories; one remote release lock protects
source promotion, image preservation, backup, migration, restart, smoke and REVISION.
`/opt/athlon/REVISION` records the commit only after all checks succeed. Failures exit
nonzero and keep the prior successful REVISION; they do not automatically roll back.

```bash
./scripts/deploy-production.sh
ssh -i "$ATHLON_SSH_KEY" ubuntu@18.158.105.59
cd /opt/athlon
docker compose --env-file .env -f infrastructure/docker-compose.production.yml ps
```

For CI, explicitly set `ATHLON_SSH_HOST`, `ATHLON_SSH_USER`, `ATHLON_SSH_KEY`,
`ATHLON_KNOWN_HOSTS`, `ATHLON_DEPLOY_REVISION` (full 40-character hexadecimal SHA),
and `ATHLON_SKIP_BOOTSTRAP=1`, then run `bash scripts/deploy-production.sh` from the
verified checkout. The remote application path is fixed at `/opt/athlon` and its
existing protected `.env` is required. CI always rejects `--seed` and `--bootstrap`.
Bootstrap is never implicit, including local updates. Both SSH and rsync enforce
`StrictHostKeyChecking=yes` with the vetted file. `ATHLON_KNOWN_HOSTS` is a file path,
not inline host-key contents: materialize the trusted secret in a temporary mode-600
file outside the checkout. Obtain its contents through a trusted connection; do not
blindly trust network `ssh-keyscan` or disable certificate/host-key checks.

Run `bash scripts/smoke-production.sh` independently for read-only public acceptance.
It uses Node for JSON validation, or the running API container's Node on the server.
All network requests have finite timeouts and TLS verification stays enabled.
Git/ignored scratch, editor state, environments, local builds, uploads, backups,
release locks/metadata and staging directories are excluded from both synchronization
phases. Images build from the exact staged checkout; runtime Compose operations
continue using `/opt/athlon` and its existing environment/volumes. Source synchronization
does not delete old server files; operators must review obsolete source/configuration
separately, and a build/runtime configuration error is a failed release. Staging directories under
`/opt/athlon/.deploy-staging`, backups and uniquely tagged rollback images accumulate;
retention and removal of individually reviewed obsolete resources are operator-managed.

### CI credentials and Telegram notifications

Store these in the GitHub **production environment secrets**, entered privately through
repository Settings, not in chat, commits, shell history, `.env` or `.env.example`:

- `DEPLOY_SSH_PRIVATE_KEY`: a dedicated deployment key, not the general-purpose personal Lightsail key.
- `DEPLOY_KNOWN_HOSTS`: host-key contents verified through a trusted connection; the workflow must materialize a private file for `ATHLON_KNOWN_HOSTS`.
- `TELEGRAM_BOT_TOKEN`: the Telegram bot's private token.
- `TELEGRAM_CHAT_ID`: the intended numeric chat ID (including the minus sign for a group).

Production environment variables are `DEPLOY_HOST` and `DEPLOY_USER`. Do not expose
these secrets to pull-request code or accept tokens/chat IDs from workflow inputs.
Configuring secrets, provisioning keys and activating automatic deployment are separate
authorized setup operations; adding the scripts alone does not enable deployment.

`bash scripts/notify-telegram.sh` uses Node.js 22 and **curl >=8.4** (needed for the
64 KiB cap on chunked/unknown-length responses). A bounded, secret-free version probe
rejects older, malformed or stalled curl installations before making the request.
The pinned Ubuntu 24.04 runner inventory currently supplies curl 8.5; manual callers
must also meet this prerequisite. It requires the two Telegram
secrets plus trusted workflow metadata: `DEPLOY_STATUS` (`started`, `success` or
`failure`), `DEPLOY_COMMIT` (full 40-character hexadecimal SHA), and `DEPLOY_RUN_URL`
(`https://github.com/<owner>/<repo>/actions/runs/<id>`, optionally `/attempts/<id>`).
Optional `DEPLOY_COMMIT_SUBJECT` becomes a plain-text single line, stripped of controls
and limited to 160 Unicode characters. The message identifies ATHLON / production,
status, a seven-character commit, subject and run URL; it has no Telegram parse mode.
Pass metadata through environment variables, never interpolated shell source.

The notifier sends the token-bearing URL through curl configuration on stdin, keeps
request/response files private and removes them on exit. It permits trusted HTTPS only,
uses 5-second connection and 15-second total timeouts with a 64 KiB response limit,
and requires both a successful HTTP status and JSON `ok: true`. Missing configuration
or unconfirmed delivery exits nonzero with a sanitized warning, never a raw API body
or curl error. The workflow must make notification steps nonblocking while preserving
the actual deployment result: a failed message must neither hide a failed deployment
nor mark a successful deployment as failed. Delivery cannot be tested for real until
the bot/chat and production secrets are configured privately.

Run isolated notification behavior tests with `bash scripts/tests/notify-telegram.test.sh`;
all curl requests are stubbed and use fixture credentials, never real Telegram.

### Activating GitHub Actions (separate authorized setup)

The workflow files are implementation, not evidence of activation. No production
environment, secrets, key, branch rule or real Telegram receipt is established by
the local tests. Review the complete plan independently before authorizing setup,
integration/push and a first monitored release. Never send credentials in this chat.

1. Confirm the private repository's GitHub plan supports the required production
   environment/secrets and desired protection rules. Availability differs by plan;
   the current account plan is unconfirmed. Keep the approved `production` environment
   architecture: do not make the repository public, buy an upgrade, move secrets to
   repository scope or weaken controls without an explicit decision. See
   [GitHub environment availability](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
2. With separate provisioning approval, generate a dedicated Ed25519 key locally
   using `ssh-keygen` in a private directory outside the checkout. The current script
   uses noninteractive SSH without a passphrase agent, so its CI private key must be
   passphrase-free and protected by mode 600 and environment access rules. Through
   an already trusted operator connection, install only its public key for `ubuntu`
   on `18.158.105.59`, using authorized-key restrictions such as `restrict` (no PTY
   or forwarding). Keep required noninteractive rsync/bash and existing Docker/owned
   `/opt/athlon` permissions; this is shell deployment access, not a read-only key.
   Do not replace personal keys or loosen server permissions. Keep the private key
   only in the production environment secret and protected operator storage.
3. Capture the host's public key/fingerprint through the trusted Lightsail console
   or an already independently verified connection. Compare the SSH fingerprint
   out of band and create the known-hosts entry for exactly `18.158.105.59`. Only then
   privately enter the vetted contents as `DEPLOY_KNOWN_HOSTS`. `ssh-keyscan` alone
   does not establish trust; a host-key change requires operator investigation.
4. In repository Settings → Environments, create `production`, restrict deployment
   branches to `main`, configure the available reviewer/bypass controls appropriate
   to the account, and enter the four secrets listed above. Add environment variables
   `DEPLOY_HOST=18.158.105.59` and `DEPLOY_USER=ubuntu`; the workflow refuses another
   target. Do not paste values into issue/task comments, app `.env`, logs or screenshots.
5. Protect `main` with reviewed pull requests and the observed **Verify release**
   check context from **Checks** (confirm its exact displayed name after the first
   secret-free PR run), require branches to be up to date, and review bypass/force-push
   permissions. Keep default workflow token permissions read-only. Changing any
   access control requires its own authorization.
6. After authorized integration into `main` and private setup, review the Actions
   run before relying on automatic releases. For a manual release, open **Deploy
   production** → **Run workflow** and select **main**. Non-main dispatches skip
   verification and deployment without accessing production secrets. Manual runs use
   the same frozen dependencies and all checks as main pushes, not a bypass.

`.github/workflows/ci.yml` runs on pull requests without production secrets and is
reused by `.github/workflows/deploy.yml` for main pushes/manual runs. It checks the
event SHA and returns that exact verified SHA; deployment checks it again and runs
the reviewed scripts from that checkout. No seed/bootstrap, runtime `.env` overwrite
or volume deletion occurs. Only the post-verification production job references
secrets. Its SSH key and known-hosts files live outside the checkout in a unique
private runner-temp directory, with mode 600 and failure/always cleanup of exact
owned paths (not broad recursive deletion). Forced runner termination can prevent
cleanup or notification; GitHub run state remains authoritative.

The `athlon-production` concurrency group disables in-progress cancellation and
the server release lock separately protects migrations and promotion. GitHub's
concurrency queue may replace an older pending run with a newer one; it does not
promise every intermediate push will deploy or FIFO ordering. Check the selected
SHA and `/opt/athlon/REVISION`. Queue, build, backup and smoke time is not guaranteed;
checks have a 30-minute job limit and deployment a 45-minute job limit. A timeout or
partial failed release needs operator inspection, not an automatic destructive
rollback; use the retained real image tags and compatible backup described below.
Immutable Action pins were verified against the official repositories; application
Node 22 is separate from the Actions' own Node24 runtime. Review updates deliberately.

### Setting up the private Telegram recipient

Create a deployment bot privately with [@BotFather](https://t.me/BotFather) using
`/newbot`, following the [official token guidance](https://core.telegram.org/bots/tutorial#obtain-your-bot-token).
Save its token privately and enter it only through GitHub production Settings.
The intended personal recipient **@karenengineer** must open that bot and press
**Start** (or send `/start`). A private user cannot be addressed by public username:
`TELEGRAM_CHAT_ID` must be the numeric private chat ID from that user's update,
not the username, a guessed number or the bot's own ID. No recipient ID is hardcoded.

Obtain it locally using the official [getUpdates API](https://core.telegram.org/bots/api#getupdates)
in a private, non-recorded Bash terminal with Node 22 and curl >=8.4. Never put the
token in a browser URL, shell command argument, shell history, debug trace or screenshot.
For example, run this subshell, enter the token only at the hidden prompt, and copy
only the resulting numeric ID directly into production Settings:

```bash
(
  set +x
  set +v
  set -euo pipefail
  umask 077
  telegram_setup_dir="$(mktemp -d)"
  trap 'unset telegram_setup_token; rm -f -- "$telegram_setup_dir/updates.json"; rmdir -- "$telegram_setup_dir"' EXIT
  read -r -s -p 'Bot token (hidden): ' telegram_setup_token
  printf '\n' >&2
  [[ "$telegram_setup_token" =~ ^[A-Za-z0-9:_-]{1,256}$ ]] || exit 1
  telegram_setup_status="$(printf 'url = "https://api.telegram.org/bot%s/getUpdates"\n' "$telegram_setup_token" |
    curl --disable --config - --silent --proto '=https' \
      --connect-timeout 5 --max-time 15 --max-filesize 65536 \
      --request POST --data 'timeout=0&limit=100' \
      --output "$telegram_setup_dir/updates.json" --write-out '%{http_code}' 2>/dev/null)"
  unset telegram_setup_token
  [[ "$telegram_setup_status" =~ ^2[0-9][0-9]$ ]] || exit 1
  node - "$telegram_setup_dir/updates.json" <<'CHAT_ID'
const fs = require('node:fs');
try {
  const body = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (body.ok !== true || !Array.isArray(body.result)) process.exit(1);
  const ids = [...new Set(body.result
    .filter(update => update.message?.chat?.type === 'private'
      && update.message?.from?.username === 'karenengineer')
    .map(update => update.message.chat.id)
    .filter(id => Number.isSafeInteger(id) && id > 0))];
  if (ids.length !== 1) process.exit(1);
  console.log(ids[0]);
} catch { process.exit(1); }
CHAT_ID
)
```

An empty/failed result is not a valid chat ID: confirm the intended account sent a
fresh private message to the correct bot. Updates expire and an existing webhook or
another poller can interfere; investigate privately rather than changing bot state
or dumping responses into chat/logs. No bot framework or long-running poller is needed.
A secret being present proves configuration only; after authorized activation, confirm
actual start/final receipt in the intended private chat without exposing the token.

### What triggers a release and who reports failures

Reviewed code commits pushed/merged into protected `main` run checks, then deployment.
A local commit alone does not trigger GitHub. Administrative catalog saves persist
immediately in PostgreSQL and do not need a Git commit, push or deployment; public
visibility still follows publication settings.

Telegram sends **started**, then **success/failure** for a production deployment
attempt. The final status comes from the deploy step's actual outcome; failures
before that step cannot become success. Failed verification never starts the
production job and sends no Telegram deployment success (or start/failure) message.
Missing/broken Telegram configuration produces a sanitized, visible nonblocking
step warning; it neither hides deployment failure nor fails a successful release.
The GitHub run can still fail for credential cleanup or other non-notification errors.

For CI/verification failures, configure your own GitHub Actions web/email preferences
under account Settings → Notifications → Actions; select all runs or failed runs as
desired and verify the notification email. GitHub controls which participating runs
generate email; these workflows do not send email, notify on every local commit,
or promise instant delivery. See [GitHub notification settings](https://docs.github.com/en/subscriptions-and-notifications/get-started/configuring-notifications).
GitHub's run outcome/logs remain the source of truth if Telegram or the runner fails.

### Backups and restore

Create a timestamped, compressed PostgreSQL backup on the host before migrations or
other maintenance. The script retains previous backups and prints the new backup path.

```bash
ssh -i "$ATHLON_SSH_KEY" ubuntu@18.158.105.59
cd /opt/athlon
./scripts/backup-production.sh
```

A restore replaces the current database. First take a fresh backup and select the
specific `/opt/athlon/backups/athlon-YYYYmmdd-HHMMSS.sql.gz` file to restore. Stop
application traffic, recreate only the PostgreSQL database, and load that backup:

```bash
./scripts/backup-production.sh
docker compose --env-file .env -f infrastructure/docker-compose.production.yml stop api web caddy
docker compose --env-file .env -f infrastructure/docker-compose.production.yml exec -T postgres \
  sh -ec 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB"; createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
gunzip -c /opt/athlon/backups/athlon-YYYYmmdd-HHMMSS.sql.gz | \
  docker compose --env-file .env -f infrastructure/docker-compose.production.yml exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
docker compose --env-file .env -f infrastructure/docker-compose.production.yml \
  up -d --no-deps --wait --wait-timeout 120 api web caddy
```

Use a database backup that matches the application release being restored. The commands
above do not remove the PostgreSQL, uploads, or Caddy volumes.

### Rollback without removing volumes

Each deployment records actual running API/web image IDs under unique retained tags
before the build. `/opt/athlon/.previous-images` lists the real tags for the most
recent attempt; an initial provision has no prior application images. Inspect the
file and retain the chosen tags alongside the matching backup/release. Do not guess
`:previous` tags or source this metadata as shell code:

```bash
cat /opt/athlon/.previous-images
# api=athlon-api:rollback-<actual-stage-id>
# web=athlon-web:rollback-<actual-stage-id>
```

If the new release must be rolled back, retag the prior local images as the production
images and restart the long-running services without building or deleting volumes.
In an operator SSH session in `/opt/athlon`, acquire the same release lock first,
replace the placeholders with the exact inspected tags, and check public smoke:

```bash
set -euo pipefail
exec 9>/opt/athlon/.release.lock
flock -w 600 9
docker image tag 'athlon-api:rollback-<actual-stage-id>' athlon-api:production
docker image tag 'athlon-web:rollback-<actual-stage-id>' athlon-web:production
docker compose --env-file .env -f infrastructure/docker-compose.production.yml \
  up -d --no-build --no-deps --wait --wait-timeout 120 api web caddy
docker compose --env-file .env -f infrastructure/docker-compose.production.yml ps
bash scripts/smoke-production.sh
flock -u 9
exec 9>&-
```

Do not use `docker compose down -v`, `docker volume rm`, or any rollback command that
removes production volumes. If the update included a schema change that cannot work
with the earlier release, restore the matching database backup before restarting it.
Image rollback does not undo migrations or restore prior source/Compose/Caddy
configuration; review those for compatibility. REVISION is not changed automatically
by manual rollback: record a successful restored revision only after its smoke checks.

## Catalog administration

Open `/admin/login`, then `/admin/products`, `/admin/categories`, or `/admin/brands`.
Create/edit URLs use `/admin/products/new` and `/admin/products/:id/edit`,
`/admin/categories/new` and `/admin/categories/:id/edit`, and `/admin/brands/new`
and `/admin/brands/:id/edit`.
Administration is lazy-loaded, client-rendered and marked `noindex, nofollow`; private
catalog/session data is not rendered into shared SSR HTML. Use existing administrator
accounts: this UI does not create accounts or change passwords.

The browser reuses HttpOnly access/refresh cookies and the configured readable CSRF
cookie. Administrative mutations attach that cookie value only to same-origin API
requests; tokens are never stored in localStorage. HY is the interface default, with
RU/EN switching and independent HY/RU/EN translation tabs. Editing a translation
preserves other languages and untouched nullable optional fields. Lists use server
filters, sorting and URL pagination. Dirty product/alt forms warn before navigation.
The local preview displays unsaved text/JSON without publishing a draft; the public
link is offered only for a persisted published product.

Save a new product before uploading images. JPEG, PNG and WebP uploads have a
5,242,880-byte client/API maximum; the server verifies declared type against decoded
raster content, rejects animation, limits each axis to 8192 and total pixels to
16,000,000 (bounded for the 2GB host), and writes randomized WebP variants. Uploads
require RU alternative text; HY/EN are optional, each limited to 250 characters.
Images support localized alt editing, a single primary flag, ordering and named
deletion. Ownership/duplicates are checked before transactional order/primary writes.
Individual image deletion attempts removal of its exact named variants. Whole-product
deletion currently cascades image metadata only: orphaned variant-file cleanup is
deferred to a separate operational follow-up: review exact-key cleanup/outbox or
orphan reconciliation with dry-run evidence and live-reference safeguards before
authorizing any cleanup. No production cleanup is part of this implementation.
Never delete the upload directory wholesale.

Verification commands:

```bash
pnpm verify # includes built production-shaped SSR requests after the build
pnpm test:ssr # requires a current web production build; loopback fixtures only
ATHLON_PG_INTEGRATION=1 pnpm --filter @athlon/api test:e2e --testPathPatterns=catalog-postgres.e2e-spec
```

The opt-in acceptance test creates/migrates a uniquely named PostgreSQL 17 Docker
container with a dedicated database and a loopback-only random port; it never accepts
an existing/production connection or runs seeds. It stops only its own container and
removes only its own temporary upload directory. Separate fixture E2E tests decode real
image bytes and cover authorization/CSRF, corrupt/mismatched/oversized content and
foreign image IDs. Local headless Chrome acceptance at 375px and 1440px covers login,
authenticated product list/editor, preview and media layout using temporary profiles
and in-memory fixtures, not production credentials. Production SSR allows exactly
`athlonsport.am`, `www.athlonsport.am`, and `127.0.0.1` (the internal Compose
healthcheck only); there are no wildcard hosts. The web port is not published:
Caddy is the public request boundary and replaces incoming forwarded host/proto/for
values. Angular trusts only those three headers, not forwarded ports/prefixes.
The web healthcheck requests HY and requires actual SSR/home markers, so HTTP 200
CSR fallback is unhealthy; it is not proof of API/catalog content or public TLS.
`pnpm test:ssr` independently verifies visible localized product content using the
production manifest, Caddy-style headers, untrusted-host/protocol rejection and
admin client/noindex/zero-API behavior. No production environment overrides are
needed. `pnpm dev` continues to use Angular's local dev-server host handling; for
a standalone built-server localhost QA session, explicitly use
`NG_ALLOWED_HOSTS=localhost pnpm --filter @athlon/web serve:ssr:web` (QA only).

## Scope

The backend implements multilingual categories, brands, products, image metadata, search,
filters, sorting, pagination, site settings, and secure administrator sessions. The public
Angular SSR application provides localized home, catalog, search, and product-detail routes
with responsive loading, empty, and error states. Cart, orders, and payments are intentionally
excluded from this phase.

# athlon

# athlon
