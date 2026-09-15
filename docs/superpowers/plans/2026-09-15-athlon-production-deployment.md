# ATHLON Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, deploy, and verify the existing ATHLON Angular SSR catalog and NestJS API on the approved AWS Lightsail instance at `https://athlon.am`.

**Architecture:** A single production Docker Compose stack runs Caddy, Angular SSR, NestJS, and PostgreSQL on the `athlon-production` Lightsail host. Caddy is the only public application service; database, API, and SSR ports stay on a private Docker network, while named volumes preserve PostgreSQL data, uploads, and TLS state.

**Tech Stack:** Node.js 22, pnpm 11.19, Angular 21 SSR, NestJS 11, Prisma 7, PostgreSQL 17, Docker Compose, Caddy 2, Bash, AWS Lightsail Ubuntu 24.04.

**Spec:** `docs/superpowers/specs/2026-09-15-athlon-production-deployment-design.md`

## Global Constraints

- Use the existing Frankfurt Lightsail instance `athlon-production` at static IPv4 `18.158.105.59`.
- Keep the instance plan at USD 12 per month and keep paid automatic snapshots disabled.
- Publish only TCP 80 and 443 for the application; do not publish PostgreSQL, NestJS 3000, or Angular SSR 4000.
- Keep secrets only in `/opt/athlon/.env` on the server with mode `600`.
- Preserve HY, RU, and EN behavior and do not add cart, ordering, or payment features.
- Do not run `docker compose down -v` or any command that removes production volumes.
- Run migrations before promoting the new API container.

---

## File Map

- `apps/web/src/app/core/api/api-base-url.ts`: injectable browser/SSR API base URL.
- `apps/web/src/app/core/api/catalog-api.service.ts`: consume the injected API base URL.
- `apps/web/src/app/app.config.server.ts`: provide the internal Docker API URL during SSR.
- `apps/web/src/app/core/api/api-base-url.spec.ts`: verify browser default and server override behavior.
- `apps/api/src/config/environment.schema.ts`: validate production-only switches.
- `apps/api/src/bootstrap.ts`: disable Swagger by default in production.
- `apps/api/test/platform.e2e-spec.ts`: verify the Swagger production switch.
- `.dockerignore`: keep build contexts small and exclude credentials and generated output.
- `apps/api/Dockerfile`: build and run the NestJS/Prisma service.
- `apps/web/Dockerfile`: build and run the Angular SSR service.
- `infrastructure/docker-compose.production.yml`: production service graph and volumes.
- `infrastructure/Caddyfile`: TLS termination and reverse-proxy routing.
- `infrastructure/production.env.example`: production variable names and safe examples.
- `scripts/bootstrap-production-server.sh`: idempotent Ubuntu host preparation.
- `scripts/deploy-production.sh`: source synchronization, build, migration, seed, and health checks.
- `scripts/backup-production.sh`: timestamped PostgreSQL backup without deleting prior backups.
- `README.md`: production deployment, DNS, update, backup, and rollback instructions.

---

### Task 1: Make the Angular SSR API origin environment-aware

**Files:**

- Create: `apps/web/src/app/core/api/api-base-url.ts`
- Create: `apps/web/src/app/core/api/api-base-url.spec.ts`
- Modify: `apps/web/src/app/core/api/catalog-api.service.ts`
- Modify: `apps/web/src/app/app.config.server.ts`

**Interfaces:**

- Produces: `API_BASE_URL: InjectionToken<string>` with browser default `/api/v1`.
- Consumes: `SSR_API_BASE_URL`, set to `http://api:3000/api/v1` in Docker Compose.

- [ ] **Step 1: Write the failing API base URL tests**

```ts
import { TestBed } from "@angular/core/testing";
import { API_BASE_URL } from "./api-base-url";

describe("API_BASE_URL", () => {
  it("uses the public relative API path by default", () => {
    TestBed.configureTestingModule({});
    expect(TestBed.inject(API_BASE_URL)).toBe("/api/v1");
  });

  it("can be overridden by the server configuration", () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: API_BASE_URL, useValue: "http://api:3000/api/v1" },
      ],
    });
    expect(TestBed.inject(API_BASE_URL)).toBe("http://api:3000/api/v1");
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails because the token is missing**

Run: `pnpm --filter @athlon/web test -- --include src/app/core/api/api-base-url.spec.ts`

Expected: FAIL with an import/module resolution error for `./api-base-url`.

- [ ] **Step 3: Add the injection token and use it in the catalog API service**

```ts
// apps/web/src/app/core/api/api-base-url.ts
import { InjectionToken } from "@angular/core";

export const API_BASE_URL = new InjectionToken<string>("API_BASE_URL", {
  providedIn: "root",
  factory: () => "/api/v1",
});
```

Replace the `PLATFORM_ID`/`isPlatformServer` branch in `CatalogApiService` with:

```ts
private readonly baseUrl = inject(API_BASE_URL);
```

Provide the Docker-internal value in `app.config.server.ts`:

```ts
import { API_BASE_URL } from "./core/api/api-base-url";

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: API_BASE_URL,
      useFactory: () =>
        process.env["SSR_API_BASE_URL"] ?? "http://localhost:3000/api/v1",
    },
  ],
};
```

- [ ] **Step 4: Run focused tests, typecheck, and the SSR production build**

Run:

```bash
pnpm --filter @athlon/web test -- --include src/app/core/api/api-base-url.spec.ts
pnpm --filter @athlon/web exec tsc -p tsconfig.app.json --noEmit
pnpm --filter @athlon/web build
```

Expected: all commands exit `0`; Angular produces `apps/web/dist/web/server/server.mjs`.

- [ ] **Step 5: Commit the SSR configuration change**

```bash
git add apps/web/src/app/core/api/api-base-url.ts \
  apps/web/src/app/core/api/api-base-url.spec.ts \
  apps/web/src/app/core/api/catalog-api.service.ts \
  apps/web/src/app/app.config.server.ts
git commit -m "fix(web): configure API origin for production SSR"
```

---

### Task 2: Disable Swagger by default in production

**Files:**

- Modify: `apps/api/src/config/environment.schema.ts`
- Modify: `apps/api/src/bootstrap.ts`
- Modify: `apps/api/test/platform.e2e-spec.ts`

**Interfaces:**

- Produces: `SWAGGER_ENABLED: boolean`, defaulting to `false` when `NODE_ENV=production` and `true` otherwise.
- Consumes: Nest `ConfigService` in `configureApplication()`.

- [ ] **Step 1: Add a failing production Swagger test**

Add a test application initialized with `NODE_ENV=production` and
`SWAGGER_ENABLED=false`, then assert:

```ts
await request(productionApp.getHttpServer()).get("/api/docs").expect(404);
```

Restore the previous environment variables in `afterAll` so other suites are isolated.

- [ ] **Step 2: Run the platform suite and confirm the new test fails**

Run: `pnpm --filter @athlon/api test:e2e -- --runTestsByPath test/platform.e2e-spec.ts`

Expected: FAIL because `/api/docs` is currently registered unconditionally.

- [ ] **Step 3: Validate and apply the Swagger switch**

Add to the Joi schema:

```ts
SWAGGER_ENABLED: Joi.boolean().default(
  process.env.NODE_ENV !== "production",
),
```

Wrap `SwaggerModule.createDocument` and `SwaggerModule.setup` in:

```ts
if (config.get<boolean>("SWAGGER_ENABLED", false)) {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("ATHLON API")
      .setVersion("1")
      .addCookieAuth()
      .build(),
  );
  SwaggerModule.setup("api/docs", app, document);
}
```

- [ ] **Step 4: Run API tests, lint, and build**

```bash
pnpm --filter @athlon/api test
pnpm --filter @athlon/api test:e2e
pnpm --filter @athlon/api lint
pnpm --filter @athlon/api build
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit the API hardening change**

```bash
git add apps/api/src/config/environment.schema.ts \
  apps/api/src/bootstrap.ts apps/api/test/platform.e2e-spec.ts
git commit -m "fix(api): disable Swagger by default in production"
```

---

### Task 3: Add production container images

**Files:**

- Create: `.dockerignore`
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`

**Interfaces:**

- Produces: images `athlon-api` and `athlon-web` with commands `node dist/main.js` and `node dist/web/server/server.mjs`.
- Consumes: root `pnpm-lock.yaml`, `pnpm-workspace.yaml`, package manifests, and Node.js 22.

- [ ] **Step 1: Add a failing container-structure check**

Run:

```bash
test -f .dockerignore
test -f apps/api/Dockerfile
test -f apps/web/Dockerfile
```

Expected: FAIL because the files do not exist.

- [ ] **Step 2: Create a credential-safe `.dockerignore`**

```text
.git
.idea
.worktrees
node_modules
**/node_modules
**/dist
**/.angular
coverage
.env
.env.*
!.env.example
!infrastructure/production.env.example
uploads
*.pem
```

- [ ] **Step 3: Create the API multi-stage Dockerfile**

Use `node:22-bookworm-slim`, enable Corepack, activate `pnpm@11.19.0`, copy
workspace manifests first, install with `--frozen-lockfile`, copy sources, run
`pnpm --filter @athlon/api prisma:generate` and `pnpm --filter @athlon/api build`.
The runtime stage copies the built workspace and dependencies, sets
`WORKDIR /app/apps/api`, runs as the unprivileged `node` user after creating
`/app/uploads`, and starts `node dist/main.js`.

- [ ] **Step 4: Create the web multi-stage Dockerfile**

Use the same pinned Node and pnpm versions, run `pnpm --filter @athlon/web build`,
copy `apps/web/dist/web` and the runtime dependencies into the final stage, set
`PORT=4000`, run as `node`, and start:

```dockerfile
CMD ["node", "apps/web/dist/web/server/server.mjs"]
```

- [ ] **Step 5: Build both images and inspect their configured users**

```bash
docker build -f apps/api/Dockerfile -t athlon-api:test .
docker build -f apps/web/Dockerfile -t athlon-web:test .
docker image inspect athlon-api:test --format '{{.Config.User}}'
docker image inspect athlon-web:test --format '{{.Config.User}}'
```

Expected: both builds succeed and both inspect commands output `node`.

- [ ] **Step 6: Commit the container images**

```bash
git add .dockerignore apps/api/Dockerfile apps/web/Dockerfile
git commit -m "feat(infra): add production application images"
```

---

### Task 4: Define the private production stack and TLS proxy

**Files:**

- Create: `infrastructure/docker-compose.production.yml`
- Create: `infrastructure/Caddyfile`
- Create: `infrastructure/production.env.example`

**Interfaces:**

- Produces: Compose services `postgres`, `migrate`, `seed`, `api`, `web`, and `caddy`.
- Consumes: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, token secrets, admin seed values, and `SITE_DOMAIN`.

- [ ] **Step 1: Add a failing production Compose validation command**

```bash
docker compose --env-file infrastructure/production.env.example \
  -f infrastructure/docker-compose.production.yml config --quiet
```

Expected: FAIL because the production Compose and environment files do not exist.

- [ ] **Step 2: Create the production environment example**

```dotenv
NODE_ENV=production
SITE_DOMAIN=athlon.am
POSTGRES_DB=athlon
POSTGRES_USER=athlon
POSTGRES_PASSWORD=replace-with-random-value
DATABASE_URL=postgresql://athlon:replace-with-random-value@postgres:5432/athlon?schema=public
CORS_ORIGINS=https://athlon.am,https://www.athlon.am
ACCESS_TOKEN_SECRET=replace-with-at-least-32-random-characters
REFRESH_TOKEN_SECRET=replace-with-at-least-32-other-random-characters
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000
CSRF_COOKIE_NAME=athlon_csrf
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_BYTES=5242880
ADMIN_EMAIL=
ADMIN_PASSWORD=
SWAGGER_ENABLED=false
SSR_API_BASE_URL=http://api:3000/api/v1
```

- [ ] **Step 3: Create the Caddy reverse-proxy configuration**

```caddyfile
{$SITE_DOMAIN}, www.{$SITE_DOMAIN} {
  encode zstd gzip

  @api path /api/* /uploads/*
  reverse_proxy @api api:3000

  reverse_proxy web:4000

  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
    -Server
  }
}
```

- [ ] **Step 4: Create the Compose service graph**

Define PostgreSQL 17 with `pg_isready`, `athlon_postgres_data`, and no `ports`.
Define one-shot `migrate` and profile-gated `seed` services from the API image.
Define `api` with `UPLOAD_DIR=/app/uploads`, `athlon_uploads`, and a Node `fetch`
health check against `/api/v1/health/live`. Define `web` with
`SSR_API_BASE_URL=http://api:3000/api/v1` and a Node `fetch` health check against
`http://127.0.0.1:4000/ru`. Define Caddy with only `80:80` and `443:443`, the
checked-in Caddyfile, `caddy_data`, and `caddy_config`. Every long-running service
uses `restart: unless-stopped`; `api` waits for successful migration and `web` waits
for healthy API.

- [ ] **Step 5: Validate the rendered Compose model and public ports**

```bash
docker compose --env-file infrastructure/production.env.example \
  -f infrastructure/docker-compose.production.yml config > /tmp/athlon-compose.yml
rg -n 'published: "?(80|443)"?' /tmp/athlon-compose.yml
! rg -n 'published: "?(3000|4000|5432)"?' /tmp/athlon-compose.yml
```

Expected: only 80 and 443 are published; the negated search exits `0`.

- [ ] **Step 6: Commit the production stack**

```bash
git add infrastructure/docker-compose.production.yml \
  infrastructure/Caddyfile infrastructure/production.env.example
git commit -m "feat(infra): add production Compose stack"
```

---

### Task 5: Add idempotent bootstrap, deployment, and backup scripts

**Files:**

- Create: `scripts/bootstrap-production-server.sh`
- Create: `scripts/deploy-production.sh`
- Create: `scripts/backup-production.sh`

**Interfaces:**

- Produces: commands invoked from the local repository with `ATHLON_SSH_KEY` and fixed host `ubuntu@18.158.105.59`.
- Consumes: production Compose file and protected `/opt/athlon/.env`.

- [ ] **Step 1: Add failing shell syntax checks**

```bash
bash -n scripts/bootstrap-production-server.sh
bash -n scripts/deploy-production.sh
bash -n scripts/backup-production.sh
```

Expected: FAIL because the scripts do not exist.

- [ ] **Step 2: Create the idempotent server bootstrap script**

The script must use `set -euo pipefail`, verify the current user is `ubuntu`, create
a 2 GB `/swapfile` only when no swap exists, install `docker.io`,
`docker-compose-v2`, `rsync`, and `curl` through `apt-get`, enable Docker, add
`ubuntu` to the Docker group, and create `/opt/athlon/backups` owned by `ubuntu`.
It must never rewrite an existing `/opt/athlon/.env`.

- [ ] **Step 3: Create the local deployment script**

The script must:

```bash
set -euo pipefail
: "${ATHLON_SSH_KEY:?Set ATHLON_SSH_KEY to the downloaded Lightsail PEM path}"
REMOTE="ubuntu@18.158.105.59"
SSH=(ssh -i "$ATHLON_SSH_KEY" -o IdentitiesOnly=yes)
RSYNC_SSH="ssh -i $ATHLON_SSH_KEY -o IdentitiesOnly=yes"
```

Then it must run the bootstrap script remotely, synchronize the repository to
`/opt/athlon` while excluding `.git`, `.env`, `node_modules`, build artifacts,
uploads, and PEM files, create `/opt/athlon/.env` only when missing using
server-side `openssl rand -hex 32`, validate Compose, build `api` and `web`, start
PostgreSQL, run migrations, start the long-running services, and verify both the
internal API health check and an HTTP response through Caddy. Seeding must run only
when invoked with `--seed`, and the script must reject `--seed` when `ADMIN_EMAIL`
or `ADMIN_PASSWORD` is empty.

- [ ] **Step 4: Create the non-destructive backup script**

The script must create `/opt/athlon/backups/athlon-YYYYmmdd-HHMMSS.sql.gz` with:

```bash
docker compose --env-file .env -f infrastructure/docker-compose.production.yml \
  exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip -9 > "$backup"
test -s "$backup"
```

It must retain existing backups and print only the resulting path, not credentials.

- [ ] **Step 5: Run syntax and secret-leak checks**

```bash
bash -n scripts/bootstrap-production-server.sh
bash -n scripts/deploy-production.sh
bash -n scripts/backup-production.sh
! rg -n 'BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|18\.158\.105\.59.*password' scripts infrastructure
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit deployment automation**

```bash
git add scripts/bootstrap-production-server.sh scripts/deploy-production.sh \
  scripts/backup-production.sh
git commit -m "feat(infra): automate Lightsail deployment and backup"
```

---

### Task 6: Document production operations and run local verification

**Files:**

- Modify: `README.md`

**Interfaces:**

- Consumes: scripts and Compose interfaces from Tasks 3-5.
- Produces: operator instructions for first deploy, update, DNS, backup, restore, and rollback.

- [ ] **Step 1: Add exact production commands to README**

Document:

```bash
export ATHLON_SSH_KEY=/Users/karenengineer/Downloads/LightsailDefaultKey-eu-central-1.pem
./scripts/deploy-production.sh --seed
./scripts/deploy-production.sh
ssh -i "$ATHLON_SSH_KEY" ubuntu@18.158.105.59
cd /opt/athlon
./scripts/backup-production.sh
docker compose --env-file .env -f infrastructure/docker-compose.production.yml ps
```

Document the registrar records `@ -> 18.158.105.59` and
`www -> 18.158.105.59`, the rule against committing `.env` or the PEM file, and a
rollback that selects the prior local image tag without removing volumes.

- [ ] **Step 2: Run the full repository verification**

Run: `pnpm verify`

Expected: formatting, Prisma validation/generation, typecheck, lint, unit tests,
end-to-end tests, and both production builds all exit `0`.

- [ ] **Step 3: Run Docker production checks**

```bash
docker compose --env-file infrastructure/production.env.example \
  -f infrastructure/docker-compose.production.yml config --quiet
docker build -f apps/api/Dockerfile -t athlon-api:verify .
docker build -f apps/web/Dockerfile -t athlon-web:verify .
```

Expected: all commands exit `0`.

- [ ] **Step 4: Commit the operations documentation**

```bash
git add README.md
git commit -m "docs: add ATHLON production operations guide"
```

---

### Task 7: Deploy to Lightsail and verify the pre-DNS stack

**Files:**

- Server-only: `/opt/athlon/.env`
- Server-only: `/opt/athlon/backups/`

**Interfaces:**

- Consumes: `/Users/karenengineer/Downloads/LightsailDefaultKey-eu-central-1.pem` and Tasks 1-6.
- Produces: running production containers on `18.158.105.59`.

- [ ] **Step 1: Confirm repository state and SSH access**

```bash
git status --short
chmod 600 /Users/karenengineer/Downloads/LightsailDefaultKey-eu-central-1.pem
ssh -i /Users/karenengineer/Downloads/LightsailDefaultKey-eu-central-1.pem \
  -o IdentitiesOnly=yes ubuntu@18.158.105.59 'cloud-init status --wait'
```

Expected: clean worktree, SSH succeeds, and cloud-init reports `status: done`.

- [ ] **Step 2: Configure the administrator values privately**

Ask the user for the administrator email. Have the user enter the initial password
directly into a local hidden prompt; do not place it in chat, shell history, git, or
tool output. Write the resulting values to `/opt/athlon/.env` over the encrypted SSH
session and keep the file mode at `600`.

- [ ] **Step 3: Run the first deployment**

```bash
ATHLON_SSH_KEY=/Users/karenengineer/Downloads/LightsailDefaultKey-eu-central-1.pem \
  ./scripts/deploy-production.sh --seed
```

Expected: bootstrap, builds, PostgreSQL health, migration, seed, and Compose startup
all succeed.

- [ ] **Step 4: Verify services and persistence**

```bash
ssh -i /Users/karenengineer/Downloads/LightsailDefaultKey-eu-central-1.pem \
  ubuntu@18.158.105.59 \
  'cd /opt/athlon && docker compose --env-file .env -f infrastructure/docker-compose.production.yml ps'
nc -vz -w 5 18.158.105.59 80
nc -vz -w 5 18.158.105.59 443
! nc -vz -w 5 18.158.105.59 3000
! nc -vz -w 5 18.158.105.59 4000
! nc -vz -w 5 18.158.105.59 5432
```

Expected: long-running containers are healthy; only 80 and 443 accept application
traffic, while 3000, 4000, and 5432 are closed publicly.

- [ ] **Step 5: Create and verify the first backup**

Run the remote backup script, verify the gzip file is non-empty, and list only its
name and size.

---

### Task 8: Point the domain and complete HTTPS smoke testing

**Files:**

- No repository changes unless verification reveals a defect.

**Interfaces:**

- Consumes: Name.am DNS access and the Lightsail static IP.
- Produces: public `https://athlon.am` and `https://www.athlon.am`.

- [ ] **Step 1: Update registrar DNS**

Create or replace the root and `www` A records with `18.158.105.59`. Do not change
MX, TXT, or unrelated records. If the registrar requires login, CAPTCHA, OTP, or a
final DNS-write confirmation, hand that exact step to the user according to browser
safety policy.

- [ ] **Step 2: Verify authoritative DNS**

```bash
dig +short A athlon.am
dig +short A www.athlon.am
```

Expected: both return `18.158.105.59`.

- [ ] **Step 3: Verify TLS and redirects**

```bash
curl -fsSI http://athlon.am | rg '^HTTP/|^location:'
curl -fsSI https://athlon.am | rg '^HTTP/|^strict-transport-security:'
curl -fsSI https://www.athlon.am | rg '^HTTP/|^strict-transport-security:'
```

Expected: HTTP redirects to HTTPS and both HTTPS names return a successful response
with HSTS.

- [ ] **Step 4: Run localized catalog smoke tests**

```bash
curl -fsS https://athlon.am/api/v1/health/live
curl -fsS https://athlon.am/hy >/dev/null
curl -fsS https://athlon.am/ru >/dev/null
curl -fsS https://athlon.am/en >/dev/null
curl -fsS 'https://athlon.am/api/v1/products?locale=ru&page=1&pageSize=8' >/dev/null
```

Expected: health returns `{"status":"ok"}` and every request exits `0`.

- [ ] **Step 5: Verify restart persistence and record the release**

Restart the Compose stack without `-v`, repeat the health and product requests, and
record the deployed git commit with:

```bash
git rev-parse HEAD
ssh -i /Users/karenengineer/Downloads/LightsailDefaultKey-eu-central-1.pem \
  ubuntu@18.158.105.59 'cat /opt/athlon/REVISION'
```

Expected: revisions match and catalog data remains available after restart.
