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

## Scope

The backend implements multilingual categories, brands, products, image metadata, search,
filters, sorting, pagination, site settings, and secure administrator sessions. The public
Angular SSR application provides localized home, catalog, search, and product-detail routes
with responsive loading, empty, and error states. Cart, orders, and payments are intentionally
excluded from this phase.
# athlon
