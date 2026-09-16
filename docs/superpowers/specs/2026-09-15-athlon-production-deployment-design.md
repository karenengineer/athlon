# ATHLON Production Deployment Design

## Goal

Deploy the existing ATHLON Angular SSR application, NestJS API, PostgreSQL database,
and uploaded product media to the `athlon-production` AWS Lightsail instance. The
public site must be available at `https://athlonsport.am` and `https://www.athlonsport.am`
without adding paid managed AWS services.

## Constraints

- Use the existing Lightsail instance in Frankfurt (`eu-central-1`): Ubuntu 24.04,
  2 GB RAM, 2 vCPU, and 60 GB SSD.
- Keep the monthly instance price at USD 12; optional snapshots remain disabled.
- Reuse the attached static IPv4 address `18.158.105.59`.
- Keep PostgreSQL and application ports private. Only HTTP, HTTPS, and SSH are
  exposed by the Lightsail firewall.
- Preserve the existing Angular, NestJS, Prisma, PostgreSQL, and pnpm monorepo.
- Do not add cart, ordering, payment, or unrelated product features.

## Chosen Architecture

Run four Docker Compose services on the single Lightsail instance:

1. `caddy` is the only public application container. It listens on ports 80 and
   443, obtains and renews Let's Encrypt certificates, redirects HTTP to HTTPS,
   proxies `/api/*` and `/uploads/*` to the API, and proxies all other requests to
   the Angular SSR server.
2. `web` runs the production Angular SSR output on the private Docker network.
3. `api` runs the compiled NestJS application on the private Docker network and
   connects to PostgreSQL by service name.
4. `postgres` runs PostgreSQL 17 with a persistent named volume and no published
   host port.

This is intentionally a single-host design. It is sufficient for the initial
catalog traffic and can later be split into managed database, object storage, and
multiple application instances without changing the public API.

## Repository Additions

- Production Dockerfiles for `apps/api` and `apps/web` using multi-stage builds.
- `infrastructure/docker-compose.production.yml` defining the four services,
  private networking, health checks, restart policies, persistent volumes, and
  resource-conscious defaults.
- `infrastructure/Caddyfile` defining the ATHLON reverse-proxy and TLS behavior.
- A server environment example containing names only, never real credentials.
- A local deployment script that synchronizes the repository over SSH, builds the
  containers, applies Prisma migrations, optionally runs the idempotent seed on
  first installation, and starts the stack.
- README instructions for first deployment, routine updates, verification,
  backup, restore, and rollback.

## Runtime Configuration and Secrets

Production secrets live only in `/opt/athlon/.env` on the server with mode `600`.
They are not committed, copied into Docker images, or printed in logs. The initial
deployment generates random PostgreSQL, access-token, refresh-token, and admin
credentials on the server. The administrator email is configured separately
before the first seed.

The API receives a production `DATABASE_URL`, exact CORS origins for
`https://athlonsport.am` and `https://www.athlonsport.am`, upload limits, cookie settings,
and the public site origin. Swagger is disabled in production unless explicitly
enabled for a maintenance session.

The Angular SSR process uses an internal API origin such as
`http://api:3000/api/v1` for server-side requests while browser requests continue
to use the public relative `/api/v1` path.

## Data Persistence

- PostgreSQL data is stored in a named Docker volume.
- Uploaded product images are stored in a separate named volume mounted by the API
  and served through the API route behind Caddy.
- Caddy certificate state is stored in named volumes so certificates survive
  container replacement.
- The deployment never removes volumes during an update.

Before destructive maintenance, PostgreSQL is backed up with `pg_dump` to a
timestamped file under `/opt/athlon/backups`. Automated paid Lightsail snapshots
remain out of scope for the initial deployment.

## Deployment Flow

1. Configure a small swap file on the 2 GB instance to prevent build failures.
2. Install Docker Engine and the Compose plugin from Ubuntu packages.
3. Create `/opt/athlon`, copy the application source from the local repository,
   and create the protected production environment file.
4. Build images, start PostgreSQL, apply Prisma migrations, run the first seed, and
   start API, Angular SSR, and Caddy.
5. Verify container health and API health over the static IP.
6. Point the root and `www` DNS records for `athlonsport.am` to the static IP.
7. After DNS propagation, verify certificate issuance, redirects, localized pages,
   catalog API responses, images, and administrator authentication over HTTPS.

Routine updates repeat source synchronization, image build, migration deployment,
and a rolling Compose restart. Database volumes remain attached.

## Security

- PostgreSQL, NestJS port 3000, and Angular SSR port 4000 are not published.
- HTTP and HTTPS are public; HTTPS is the canonical origin.
- SSH uses the downloaded Lightsail private key. Password login and root login
  remain disabled. The key file is mode `600` and must stay outside the repository.
- The API trusts proxy headers only through the Caddy service and uses secure,
  HTTP-only cookies in production.
- Secrets are generated randomly and stored only on the server.
- Uploaded files retain the API's MIME, size, and content validation.
- Container services run with the minimum practical privileges and restart
  automatically after host reboot.

The initial Lightsail SSH firewall rule remains public because the built-in browser
SSH client is currently unavailable. Key-only authentication mitigates this. A
stable administrator CIDR can be applied later if the user has a stable IP address.

## DNS and TLS

At the domain registrar, create these records:

- `A` record for `@` -> `18.158.105.59`
- `A` record for `www` -> `18.158.105.59`

Caddy requests certificates only after both records resolve to the server. Until
then, deployment is verified by IP and local health checks. No registrar password,
AWS password, private key, or DNS API token is placed in the repository or chat.

## Failure Handling and Rollback

- Containers use health checks and `unless-stopped` restart policies.
- Migration failure stops the deployment before the new application is promoted.
- The previous image remains locally available for a Compose image rollback.
- A failed web or API health check leaves Caddy returning an upstream error rather
  than exposing private services.
- Database restore uses the most recent explicit `pg_dump` backup.

## Verification

Before deployment, run the repository's lint, tests, and production builds. After
deployment, verify:

- `GET /api/v1/health` succeeds through Caddy;
- HY, RU, and EN public routes render through Angular SSR;
- catalog listing, search, product detail, and image URLs work;
- HTTP redirects to HTTPS after DNS propagation;
- TLS certificates cover both root and `www` names;
- API and database ports are unreachable from the public internet;
- the server survives a Compose restart without data loss.

## Non-goals and Initial Limitations

- No high availability, load balancer, managed PostgreSQL, CDN, object storage, or
  automated paid snapshots.
- No zero-downtime multi-instance release process.
- No full CI/CD pipeline; deployment is an explicit local command.
- DNS changes require access to the registrar account and may need one user action.
- Email delivery, cart, orders, and payments remain outside the catalog scope.

## Acceptance Criteria

The design is complete when the four-service stack runs on the Lightsail instance,
the database and uploads survive restarts, only intended ports are public, the
catalog passes production smoke checks, and `athlonsport.am` serves valid HTTPS for all
three locales.
