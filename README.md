# ATHLON

Production-oriented monorepo foundation for the ATHLON sports nutrition and accessories catalog.

## Requirements

- Node.js 22+
- pnpm 11+
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
and the production build.

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
