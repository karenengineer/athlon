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
chmod 600 "$ATHLON_SSH_KEY"
./scripts/deploy-production.sh
```

On its first run, the script bootstraps the host, generates database and token secrets,
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
services, and checks the API and Caddy response.

```bash
./scripts/deploy-production.sh
ssh -i "$ATHLON_SSH_KEY" ubuntu@18.158.105.59
cd /opt/athlon
docker compose --env-file .env -f infrastructure/docker-compose.production.yml ps
```

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

Before deploying an update, preserve the currently running server-local images under
explicit tags:

```bash
docker image tag athlon-api:production athlon-api:previous
docker image tag athlon-web:production athlon-web:previous
```

If the new release must be rolled back, retag the prior local images as the production
images and restart the long-running services without building or deleting volumes:

```bash
docker image tag athlon-api:previous athlon-api:production
docker image tag athlon-web:previous athlon-web:production
docker compose --env-file .env -f infrastructure/docker-compose.production.yml \
  up -d --no-build --no-deps --wait --wait-timeout 120 api web caddy
docker compose --env-file .env -f infrastructure/docker-compose.production.yml ps
```

Do not use `docker compose down -v`, `docker volume rm`, or any rollback command that
removes production volumes. If the update included a schema change that cannot work
with the earlier release, restore the matching database backup before restarting it.

## Scope

The backend implements multilingual categories, brands, products, image metadata, search,
filters, sorting, pagination, site settings, and secure administrator sessions. The public
Angular SSR application provides localized home, catalog, search, and product-detail routes
with responsive loading, empty, and error states. Cart, orders, and payments are intentionally
excluded from this phase.

# athlon

# athlon
