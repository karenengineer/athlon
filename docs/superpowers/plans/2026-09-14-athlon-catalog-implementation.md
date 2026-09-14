# ATHLON Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать с нуля production-ready трёхъязычный каталог ATHLON с Angular SSR, NestJS, PostgreSQL, Prisma и защищённой административной панелью.

**Architecture:** pnpm monorepo содержит независимые приложения `web` и `api`; Angular получает типизированный клиент из OpenAPI, а NestJS единолично владеет доменной логикой и PostgreSQL. Публичный каталог, административный контур и хранение изображений разделены интерфейсами, чтобы позднее добавить варианты, остатки, корзину и заказы без изменения существующих потребителей каталога.

**Tech Stack:** pnpm workspaces, Angular SSR, TypeScript strict, SCSS, Transloco, Angular Material только для admin UI, NestJS, Prisma, PostgreSQL, OpenAPI, Sharp, Argon2, JWT cookies, Vitest для Angular, Jest/Supertest для NestJS, Playwright, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-14-athlon-catalog-design.md`

## Global Constraints

- Проект создаётся полностью с нуля; существующая спецификация и пользовательские файлы не удаляются.
- Использовать последние стабильные совместимые версии зависимостей на момент scaffold; точные версии фиксируются lockfile.
- Публичные locale: `hy`, `ru`, `en`; fallback locale: `ru`; admin может быть только на русском.
- Верхнеуровневые категории строго две: Sports nutrition и Accessories.
- Валюта — `AMD`; цена nullable; отсутствующая цена не заменяется выдуманным числом.
- Корзина, checkout, платежи, аккаунты покупателей и заказы не входят в первую версию.
- Фирменные изображения сохраняют пропорции, цвета, логотип и текст без генеративных изменений.
- Цвета публичного интерфейса: `#080809`, `#E5001B`, белый и светлая витрина около `#F0F0F2`.
- Спортпитание должно быть видно в первом desktop viewport главной страницы.
- DTO validation, серверная авторизация, безопасные cookies, CORS allowlist, rate limiting и проверка загрузок обязательны.
- Все секреты поступают из environment variables; `.env.example` содержит только имена и безопасные примеры.
- Каждый этап заканчивается тестами, lint, production build применимых приложений и отдельным коммитом.

---

## Planned repository map

```text
athlon-sport/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── common/
│   │   │   │   ├── errors/
│   │   │   │   ├── filters/
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   └── pagination/
│   │   │   ├── config/
│   │   │   ├── database/
│   │   │   ├── health/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── categories/
│   │   │   ├── brands/
│   │   │   ├── products/
│   │   │   ├── media/
│   │   │   ├── storage/
│   │   │   ├── site-settings/
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   └── test/
│   └── web/
│       ├── public/
│       │   ├── brand/
│       │   ├── placeholders/
│       │   ├── robots.txt
│       │   └── sitemap.xml
│       └── src/app/
│           ├── core/
│           │   ├── api/
│           │   ├── auth/
│           │   ├── i18n/
│           │   ├── seo/
│           │   └── config/
│           ├── layout/
│           ├── shared/
│           ├── features/
│           │   ├── home/
│           │   ├── catalog/
│           │   ├── product/
│           │   ├── search/
│           │   ├── about/
│           │   ├── contacts/
│           │   ├── not-found/
│           │   └── admin/
│           ├── app.config.ts
│           └── app.routes.ts
├── packages/
│   └── api-client/
├── infrastructure/
│   └── docker-compose.yml
├── docs/
├── .env.example
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── README.md
```

## Module contracts

### Backend modules

- `database`: предоставляет единственный `PrismaService`; остальные модули не создают собственные подключения.
- `categories`: дерево категорий, переводы, публикация, сортировка; запрещает создание третьей top-level категории без явного изменения продуктового требования.
- `brands`: бренд и необязательный логотип.
- `products`: каталог, переводы, цена, наличие, характеристики, публикация, featured/new, поиск и фильтры.
- `storage`: контракт сохранения, чтения и удаления объекта; первая реализация — локальная.
- `media`: проверка файла, создание размеров, метаданные и связь с продуктом; не знает физический путь хранения.
- `auth`: login, refresh rotation, logout, CSRF-защита и серверная роль `ADMIN`.
- `users`: хранение администратора и статуса активности; не содержит публичных customer accounts.
- `site-settings`: только разрешённые контактные и социальные ключи.
- `health`: liveness и readiness для API и PostgreSQL.

### Frontend modules

- `core/api`: сгенерированный OpenAPI client и единая обработка transport errors.
- `core/i18n`: locale parsing, runtime dictionaries, locale links и fallback `ru`.
- `core/auth`: admin session state, guard и refresh coordination.
- `core/seo`: title, description, canonical, hreflang, Open Graph и JSON-LD.
- `layout`: public header/footer/mobile navigation и отдельный admin shell.
- `features/home`: компактный hero, две категории и первый ряд спортпитания.
- `features/catalog`: URL-driven filters, sorting, pagination и cards.
- `features/product`: gallery, facts, CTA и related products.
- `features/admin`: lazy-loaded dashboard и CRUD screens.
- `shared`: небольшие презентационные компоненты без domain data access.

## Prisma model decisions

```text
Locale enum: HY | RU | EN
AvailabilityStatus enum: IN_STOCK | OUT_OF_STOCK | PREORDER | ON_REQUEST
AdminRole enum: ADMIN

Category 1--N CategoryTranslation
Category 1--N Category (self-relation through parentId)
Brand 1--N Product
Brand 1--N BrandTranslation
Product N--1 Category
Product 1--N ProductTranslation
Product 1--N ProductImage
ProductImage 1--N ProductImageTranslation
AdminUser 1--N RefreshSession
SiteSetting: allowlisted key/value pairs
```

`Product` содержит `id`, `sku`, `slug`, `categoryId`, nullable `brandId`, nullable `price` как decimal, `currency` со значением `AMD`, `availability`, `characteristics` как JSON, `featured`, `isNew`, `published`, `displayOrder`, timestamps. Переводимые поля вынесены в translation tables с уникальностью `(entityId, locale)`.

В первой версии вариантов и остатков нет. Позднее `ProductVariant` будет ссылаться на `Product`, `InventoryItem` — на вариант, `CartLine` и `OrderLine` — на вариант с snapshot названия и цены. Стабильные product IDs, SKU и public endpoints сохранятся.

## Route map

### Public Angular routes

```text
/                         -> locale resolution, затем redirect
/:locale                  -> home
/:locale/catalog          -> все товары
/:locale/catalog/:slug    -> категория
/:locale/search           -> результаты поиска
/:locale/product/:slug    -> карточка товара
/:locale/about            -> о компании
/:locale/contacts         -> контакты
/:locale/**               -> локализованная 404
```

### Administrative Angular routes

```text
/admin/login
/admin
/admin/products
/admin/products/new
/admin/products/:id/edit
/admin/categories
/admin/brands
/admin/settings
/admin/**                 -> admin 404
```

Все admin routes, кроме login, защищены клиентским guard для UX и обязательной серверной проверкой роли. Клиентский guard не считается средством безопасности.

## REST endpoint map

### Public

```text
GET  /api/v1/health/live
GET  /api/v1/health/ready
GET  /api/v1/public/settings
GET  /api/v1/categories?locale=ru
GET  /api/v1/brands?locale=ru
GET  /api/v1/products
GET  /api/v1/products/featured
GET  /api/v1/products/new
GET  /api/v1/products/search-suggestions
GET  /api/v1/products/:slug
```

`GET /products` принимает `locale`, `category`, `brand`, `availability`, `minPrice`, `maxPrice`, `sort`, `page`, `pageSize`, `q`. Сервер задаёт maximum `pageSize`, allowlist sort fields и возвращает только опубликованные записи.

### Authentication

```text
POST /api/v1/admin/auth/login
POST /api/v1/admin/auth/refresh
POST /api/v1/admin/auth/logout
GET  /api/v1/admin/auth/me
```

### Administration

```text
GET    /api/v1/admin/dashboard
GET    /api/v1/admin/products
POST   /api/v1/admin/products
GET    /api/v1/admin/products/:id
PATCH  /api/v1/admin/products/:id
DELETE /api/v1/admin/products/:id
POST   /api/v1/admin/products/:id/publish
POST   /api/v1/admin/products/:id/unpublish

GET    /api/v1/admin/categories
POST   /api/v1/admin/categories
PATCH  /api/v1/admin/categories/:id
DELETE /api/v1/admin/categories/:id

GET    /api/v1/admin/brands
POST   /api/v1/admin/brands
PATCH  /api/v1/admin/brands/:id
DELETE /api/v1/admin/brands/:id

POST   /api/v1/admin/products/:id/images
PATCH  /api/v1/admin/products/:id/images/order
PATCH  /api/v1/admin/products/:id/images/:imageId
DELETE /api/v1/admin/products/:id/images/:imageId

GET    /api/v1/admin/settings
PATCH  /api/v1/admin/settings
```

## Localization design

- UI dictionaries live under `apps/web/public/i18n/{hy,ru,en}.json` and load at runtime with SSR support.
- `localeGuard` validates the first public path segment; unsupported values redirect to `ru` while preserving the remaining safe path.
- Language switching rebuilds the Angular URL with the selected locale and preserves catalog query parameters.
- API requests send the locale explicitly; the API resolves the requested translation, then Russian fallback, then the first existing translation.
- Product, category, brand, image-alt and SEO translations use normalized Prisma tables.
- Admin forms show three fixed locale tabs and mark missing required name translations.
- Canonical and `hreflang` links are generated from the same route descriptor to prevent mismatches.

## Image-storage design

- `StorageAdapter.put`, `StorageAdapter.delete`, and `StorageAdapter.publicUrl` define the physical-storage boundary.
- `LocalStorageAdapter` stores generated filenames under a configured absolute directory and exposes them through a controlled static route.
- `MediaService` validates MIME allowlist, actual file signature, maximum bytes, image dimensions, and ownership before invoking storage.
- The image processor generates thumbnail, card, and detail variants and strips unsafe metadata.
- Database rows store storage keys and metadata, never workstation absolute paths.
- Product deletion removes database associations transactionally and schedules physical cleanup so a storage failure cannot corrupt catalog records.
- A future `S3StorageAdapter` will satisfy the same interface and can be selected by configuration.

---

### Task 1: Workspace foundation and reproducible local environment

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `infrastructure/docker-compose.yml`
- Create through official scaffolds: `apps/api/**`, `apps/web/**`
- Test: root workspace scripts and both generated test suites

**Interfaces:**
- Produces: root scripts `dev`, `build`, `lint`, `test`, `format:check`; PostgreSQL service named `postgres`; workspace packages `@athlon/api`, `@athlon/web`, and `@athlon/api-client`.

- [ ] Verify the installed Node package manager environment and record the selected stable runtime in `package.json#engines`.
- [ ] Add a failing workspace smoke check that expects both application packages and root scripts.
- [ ] Run the smoke check and confirm it fails because the workspace has not been scaffolded.
- [ ] Scaffold Angular SSR and NestJS with strict TypeScript and no Nx.
- [ ] Add Docker Compose healthcheck, named database volume, and environment interpolation without embedded credentials.
- [ ] Add root scripts and ignores for `.env`, build output, coverage, local uploads, Angular cache, and `.superpowers`.
- [ ] Run generated tests, lint, and production builds for both applications.
- [ ] Commit as `chore: scaffold ATHLON monorepo`.

### Task 2: Prisma catalog schema, migrations, and demonstrative seed

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/seed.ts`
- Create: `apps/api/prisma/migrations/**`
- Create: `apps/api/src/database/database.module.ts`
- Create: `apps/api/src/database/prisma.service.ts`
- Test: `apps/api/test/database/catalog-schema.e2e-spec.ts`

**Interfaces:**
- Produces: Prisma models and enums specified above; injectable `PrismaService`; seed command `pnpm --filter @athlon/api db:seed`.

- [ ] Write schema integration assertions for unique SKU, unique translation locale per entity, nullable price, category parent relation, and deletion restrictions.
- [ ] Run the schema test and confirm it fails before the models exist.
- [ ] Define enums, catalog models, admin session models, settings, indexes, and referential actions.
- [ ] Generate and apply the initial migration against the disposable test database.
- [ ] Add a deterministic seed containing exactly two top-level categories, example children, three locales, brands, and at least twelve clearly demonstrative products.
- [ ] Add environment-gated initial-admin creation with Argon2 and no default production password.
- [ ] Run schema tests twice to verify migration and seed idempotence.
- [ ] Commit as `feat(api): add catalog database schema and seed`.

### Task 3: API platform, error contract, health, and OpenAPI

**Files:**
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/src/config/environment.schema.ts`
- Create: `apps/api/src/common/errors/api-error.ts`
- Create: `apps/api/src/common/filters/api-exception.filter.ts`
- Create: `apps/api/src/common/interceptors/request-id.interceptor.ts`
- Create: `apps/api/src/common/pagination/page-query.dto.ts`
- Create: `apps/api/src/health/health.module.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Test: `apps/api/test/platform.e2e-spec.ts`

**Interfaces:**
- Produces: global prefix `/api/v1`; error envelope `{code,message,fieldErrors?,path,timestamp,requestId}`; health endpoints; generated OpenAPI JSON.

- [ ] Write failing e2e cases for rejected unknown DTO fields, stable validation errors, request IDs, health routes, CORS, and absence of stack traces.
- [ ] Run the focused e2e suite and confirm expected failures.
- [ ] Configure environment validation, Helmet, narrow CORS, global validation, request IDs, exception mapping, and Swagger.
- [ ] Implement liveness without dependencies and readiness with a PostgreSQL check.
- [ ] Generate the OpenAPI artifact and validate it during CI-equivalent tests.
- [ ] Run API unit tests, e2e tests, lint, and build.
- [ ] Commit as `feat(api): establish secure API platform`.

### Task 4: Public catalog API

**Files:**
- Create: `apps/api/src/categories/**`
- Create: `apps/api/src/brands/**`
- Create: `apps/api/src/products/**`
- Create: `apps/api/src/site-settings/public-settings.controller.ts`
- Create: `apps/api/src/site-settings/site-settings.service.ts`
- Test: `apps/api/test/public-catalog.e2e-spec.ts`

**Interfaces:**
- Produces: public endpoints listed in the REST map; `PaginatedProductResponse`; locale fallback behavior; URL-safe filter DTO.

- [ ] Write failing e2e cases for published-only results, all filters, allowlisted sorting, bounded pagination, localized fallback, slug lookup, featured/new lists, related items, and absent price.
- [ ] Run the focused suite and confirm public endpoints are missing.
- [ ] Implement focused repositories and services for categories, brands, product listing, detail, search suggestions, and public settings.
- [ ] Ensure public DTOs expose stored facts only and never admin/session fields.
- [ ] Add query indexes identified by the real generated SQL and verify representative query plans do not perform avoidable full scans.
- [ ] Regenerate OpenAPI and the `packages/api-client` TypeScript client.
- [ ] Run API tests, lint, and build.
- [ ] Commit as `feat(api): add multilingual public catalog`.

### Task 5: Admin authentication and authorization

**Files:**
- Create: `apps/api/src/users/**`
- Create: `apps/api/src/auth/**`
- Create: `apps/api/src/common/guards/admin-role.guard.ts`
- Create: `apps/api/src/common/guards/csrf.guard.ts`
- Test: `apps/api/test/admin-auth.e2e-spec.ts`

**Interfaces:**
- Produces: login, refresh, logout, and me endpoints; rotated refresh sessions; reusable server-side `AdminRoleGuard`.

- [ ] Write failing cases for valid login, invalid credentials, inactive user, secure cookie attributes, refresh rotation, replay rejection, logout revocation, CSRF rejection, and rate limiting.
- [ ] Run the auth suite and confirm endpoint failures.
- [ ] Implement credential verification, short-lived access cookies, hashed refresh-session secrets, atomic rotation, logout, and me.
- [ ] Apply guards and rate limits at controller boundaries and redact all secrets from logs.
- [ ] Run auth tests, complete API tests, lint, and build.
- [ ] Commit as `feat(api): add secure admin sessions`.

### Task 6: Administrative catalog API and local media storage

**Files:**
- Create: `apps/api/src/storage/storage-adapter.ts`
- Create: `apps/api/src/storage/local-storage.adapter.ts`
- Create: `apps/api/src/storage/storage.module.ts`
- Create: `apps/api/src/media/**`
- Add admin controllers and DTOs under: `apps/api/src/products/`, `categories/`, `brands/`, `site-settings/`
- Test: `apps/api/test/admin-catalog.e2e-spec.ts`
- Test: `apps/api/test/media-security.e2e-spec.ts`

**Interfaces:**
- Produces: authenticated CRUD endpoints; `StorageAdapter`; card/detail/thumbnail variants; safe media metadata DTOs.

- [ ] Write failing CRUD tests for translations, nullable price, publication, featured/new, ordering, destructive constraints, and third top-level category rejection.
- [ ] Write failing media tests for valid image, MIME spoofing, oversize file, unsafe filename, ordering, primary image, and unauthorized access.
- [ ] Run both suites and confirm failures.
- [ ] Implement admin DTOs, transactions, constraints, audit-safe responses, and dashboard counts.
- [ ] Implement local adapter, processing variants, metadata persistence, controlled serving, and compensating physical cleanup.
- [ ] Regenerate OpenAPI and the API client.
- [ ] Run all API tests, lint, and build.
- [ ] Commit as `feat(api): add admin catalog and media management`.

### Task 7: Angular shell, runtime localization, and brand assets

**Files:**
- Modify: `apps/web/src/app/app.config.ts`
- Modify: `apps/web/src/app/app.routes.ts`
- Create: `apps/web/src/app/core/i18n/**`
- Create: `apps/web/src/app/core/api/**`
- Create: `apps/web/src/app/layout/public-shell/**`
- Create: `apps/web/src/app/layout/header/**`
- Create: `apps/web/src/app/layout/footer/**`
- Create: `apps/web/public/i18n/hy.json`
- Create: `apps/web/public/i18n/ru.json`
- Create: `apps/web/public/i18n/en.json`
- Copy without modification: supplied files into `apps/web/public/brand/**`
- Test: `apps/web/src/app/core/i18n/locale-routing.spec.ts`
- Test: `apps/web/src/app/layout/header/header.spec.ts`

**Interfaces:**
- Consumes: generated `@athlon/api-client`.
- Produces: locale-prefixed public shell, language switcher, mobile navigation, shared API error mapping, exact preserved brand assets.

- [ ] Write failing tests for locale resolution, invalid locale redirect, query preservation during switch, active navigation, keyboard drawer behavior, and image aspect-ratio preservation.
- [ ] Run focused frontend tests and confirm failures.
- [ ] Implement SSR-safe dictionary loading, locale state, routes, public shell, header, footer, search entry, and accessible mobile navigation.
- [ ] Copy the three supplied brand images byte-for-byte and add descriptive asset names without modifying sources.
- [ ] Apply global design tokens for ATHLON colors, typography, spacing, focus, and reduced motion.
- [ ] Run frontend tests, lint, SSR build, and hydration smoke check.
- [ ] Commit as `feat(web): add localized ATHLON application shell`.

### Task 8: Home page with visible sports-nutrition showcase

**Files:**
- Create: `apps/web/src/app/features/home/home.routes.ts`
- Create: `apps/web/src/app/features/home/home-page.component.*`
- Create: `apps/web/src/app/features/home/home.store.ts`
- Create: `apps/web/src/app/shared/product-card/**`
- Create: `apps/web/src/app/shared/product-grid/**`
- Create: `apps/web/public/placeholders/product-placeholder.svg`
- Test: `apps/web/src/app/features/home/home-page.component.spec.ts`
- Test: `apps/web/e2e/home.spec.ts`

**Interfaces:**
- Consumes: categories, featured products, new products, and public settings API.
- Produces: reusable `ProductCardComponent`; approved dark-header/light-showcase home page.

- [ ] Write failing component cases for exactly two top-level categories, nullable price copy, image fallback, loading, empty, and retry states.
- [ ] Write a failing desktop browser assertion that the first sports-nutrition product row intersects the initial viewport at the target desktop size.
- [ ] Run tests and confirm the home feature is absent.
- [ ] Implement compact hero, two category controls, light product showcase, popular/new sections, contact-aware CTA, and responsive layout.
- [ ] Verify no layout shift from brand or product images and no hidden horizontal overflow at target widths.
- [ ] Run focused tests, accessibility scan, lint, and SSR build.
- [ ] Commit as `feat(web): build ATHLON catalog home page`.

### Task 9: Catalog, search, and product detail

**Files:**
- Create: `apps/web/src/app/features/catalog/**`
- Create: `apps/web/src/app/features/search/**`
- Create: `apps/web/src/app/features/product/**`
- Create: `apps/web/src/app/shared/breadcrumbs/**`
- Create: `apps/web/src/app/shared/loading/**`
- Test: focused specs within each feature
- Test: `apps/web/e2e/catalog.spec.ts`
- Test: `apps/web/e2e/product.spec.ts`

**Interfaces:**
- Consumes: public product list/detail/suggestions endpoints and URL query parameters.
- Produces: linkable filter state, search results, product detail, gallery, contact action, and related products.

- [ ] Write failing unit cases for query parsing/serialization, invalid filter recovery, pagination, locale switch preservation, gallery keyboard behavior, and missing contact settings.
- [ ] Write failing browser flows for search, combined filters, sort, page navigation, product open, breadcrumbs, language switch, and related product navigation.
- [ ] Run focused tests and confirm failures.
- [ ] Implement URL-owned catalog state with signals, debounced search, filters, sorting, pagination, skeletons, empty/error recovery, gallery, characteristics, and related products.
- [ ] Ensure product CTA is absent when configuration is absent and no phone/social value is invented.
- [ ] Run frontend tests, browser tests, accessibility checks, lint, and SSR build.
- [ ] Commit as `feat(web): add catalog discovery and product detail`.

### Task 10: Admin Angular application

**Files:**
- Create: `apps/web/src/app/core/auth/**`
- Create: `apps/web/src/app/layout/admin-shell/**`
- Create: `apps/web/src/app/features/admin/admin.routes.ts`
- Create: `apps/web/src/app/features/admin/login/**`
- Create: `apps/web/src/app/features/admin/dashboard/**`
- Create: `apps/web/src/app/features/admin/products/**`
- Create: `apps/web/src/app/features/admin/categories/**`
- Create: `apps/web/src/app/features/admin/brands/**`
- Create: `apps/web/src/app/features/admin/settings/**`
- Test: focused specs under `features/admin/**`
- Test: `apps/web/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: all authenticated admin endpoints and cookie session behavior.
- Produces: lazy admin shell, session state, complete catalog CRUD UI, translation tabs, media manager, and guarded routes.

- [ ] Write failing tests for unauthenticated routing, login errors, refresh coordination without loops, logout, role rejection, form validation, unsaved-change protection, and delete confirmation.
- [ ] Write failing browser flow for login, create draft, fill HY/RU/EN content, upload/reorder image, preview, publish, edit, unpublish, and delete.
- [ ] Run focused tests and confirm failures.
- [ ] Implement admin session store and interceptor, then the shell and feature screens as independent lazy routes.
- [ ] Implement product forms with typed nested translations, nullable price, availability, characteristics, image ordering, featured/new, preview, and publication actions.
- [ ] Implement category, brand, and allowlisted site-setting management.
- [ ] Run frontend tests, admin browser test, accessibility scan, lint, and SSR build.
- [ ] Commit as `feat(web): add ATHLON catalog administration`.

### Task 11: SEO, SSR metadata, sitemap, and public content pages

**Files:**
- Create: `apps/web/src/app/core/seo/**`
- Create: `apps/web/src/app/features/about/**`
- Create: `apps/web/src/app/features/contacts/**`
- Create: `apps/web/src/app/features/not-found/**`
- Create: `apps/web/src/app/app.routes.server.ts`
- Modify: `apps/web/public/robots.txt`
- Create: `apps/api/src/seo/seo.module.ts`
- Create: `apps/api/src/seo/sitemap.controller.ts`
- Create: `apps/api/src/seo/sitemap.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/web/src/app/core/seo/seo.service.spec.ts`
- Test: `apps/web/e2e/seo.spec.ts`

**Interfaces:**
- Consumes: localized routes, products, categories, translations, settings, and stored images.
- Produces: canonical, hreflang, Open Graph, Product/BreadcrumbList JSON-LD, localized 404, robots, and sitemap.

- [ ] Write failing SSR/browser assertions for localized title/description, canonical, all hreflang alternatives, factual structured data, 404 status behavior, robots, and sitemap published-only URLs.
- [ ] Run the SEO suite and confirm missing metadata.
- [ ] Implement a route-descriptor-based SEO service so canonical and hreflang cannot diverge.
- [ ] Implement about, contacts, localized not-found, Product and BreadcrumbList structured data, robots, and dynamic sitemap.
- [ ] Validate structured data and rendered HTML without client JavaScript.
- [ ] Run frontend tests, SEO browser tests, lint, and SSR build.
- [ ] Commit as `feat(web): complete localized SEO and content pages`.

### Task 12: Cross-application verification and operator documentation

**Files:**
- Create or finalize: `README.md`
- Finalize: `.env.example`
- Test: root verification scripts, API e2e, web e2e, accessibility checks

**Interfaces:**
- Consumes: completed applications and infrastructure.
- Produces: documented clean-checkout setup and one root verification command.

- [ ] Add a clean-checkout setup test in a temporary working directory using only tracked files and `.env.example`-derived local values.
- [ ] Run it before documentation is complete and record the exact failing setup step.
- [ ] Document prerequisites, environment variables, database lifecycle, migrations, seed, initial admin, development, tests, builds, media directory, and production considerations.
- [ ] Add a required root `pnpm verify` command covering format check, lint, unit tests, integration tests, Playwright browser tests, accessibility checks, and production builds.
- [ ] Run dependency audit and classify any remaining finding rather than silently ignoring it.
- [ ] Run the full verification command from a clean state and save the final command outputs for handoff.
- [ ] Confirm acceptance criteria: three locales, two top-level categories, sports nutrition above the fold, working admin CRUD, no commerce flows, and no invented contact or price data.
- [ ] Commit as `docs: finalize ATHLON setup and verification`.

## Execution checkpoints

- Checkpoint A after Task 3: both apps scaffolded, database available, secure platform and OpenAPI operational.
- Checkpoint B after Task 6: complete API, admin security, storage, seed, and generated client pass tests.
- Checkpoint C after Task 9: public multilingual catalog matches the approved visual hierarchy and uses the real API.
- Checkpoint D after Task 12: administration, SEO, tests, documentation, and clean-checkout verification complete.

No implementation stage begins until this plan is approved.
