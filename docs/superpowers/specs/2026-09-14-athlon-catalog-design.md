# ATHLON Catalog Design

## 1. Purpose and scope

ATHLON is a multilingual catalog for sports nutrition and accessories. The first release is a product showcase: visitors can browse, search, filter, and inspect products, then use configured contact links to ask about availability. It does not include a cart, checkout, online payment, customer accounts, orders, or shipment tracking.

The domain and service boundaries must allow those commerce capabilities to be added later without rewriting the product catalog. The first release will therefore retain product fields such as SKU, price, currency, and availability, while postponing inventory transactions, variants, carts, orders, and payments.

## 2. Confirmed product decisions

- The repository is empty and the entire project will be created from scratch.
- The public catalog has two top-level categories:
  - Sports nutrition.
  - Accessories.
- The public site supports Armenian, Russian, and English.
- Russian is the fallback locale and the administration interface may remain Russian-only.
- Prices use AMD and may be absent. When absent, the UI displays a localized “Contact for price” message.
- Sports-nutrition products are visible within the first desktop viewport of the home page.
- An authenticated administrator manages products, translations, categories, brands, images, prices, availability, and publishing state.

## 3. Repository structure

The project uses a pnpm workspace without Nx to keep build tooling explicit and lightweight.

```text
athlon-sport/
├── apps/
│   ├── web/                    # Angular SSR application
│   └── api/                    # NestJS REST API
├── packages/
│   └── api-client/             # generated TypeScript client from OpenAPI
├── infrastructure/
│   └── docker-compose.yml      # local PostgreSQL service
├── docs/
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── README.md
```

The API owns domain rules and persistence. The web application never imports Prisma or API implementation types. Its API types and client are generated from the OpenAPI document.

## 4. System architecture

### 4.1 Web application

The web application uses the latest stable Angular version available when the project is scaffolded, with strict TypeScript, standalone components, signals, lazy-loaded routes, SCSS, SSR, and hydration.

It contains two application areas:

- Public storefront under locale-prefixed paths such as `/ru`, `/hy`, and `/en`.
- Administration area under `/admin`, protected by route guards and server authorization.

Public features are divided into core, layout, catalog, product, content, contact, and shared UI boundaries. Administration features are lazy-loaded and do not contribute to the initial public bundle.

### 4.2 API application

The NestJS application exposes versioned REST endpoints under `/api/v1` and publishes an OpenAPI document. It is divided into config, database, auth, users, categories, brands, products, media, storage, health, and public-settings modules.

Global validation rejects unexpected fields. A global exception filter returns a consistent error envelope containing a stable code, localized-safe message, optional field errors, request path, and timestamp. Logs include request correlation IDs but never passwords, tokens, or cookie values.

### 4.3 Persistence

PostgreSQL is the source of truth and Prisma owns its schema and migrations. Seed data creates the two top-level categories, example subcategories, brands, at least twelve explicitly demonstrative products, translations, and optionally the initial admin from environment-provided credentials.

### 4.4 Media storage

The API depends on a `StorageAdapter` interface. The first implementation stores development files locally outside the application source tree. A later S3-compatible implementation can replace it without changing controllers or product services.

Uploads are restricted by allowlisted MIME types, validated file signatures, maximum size, and safe generated filenames. The service creates configured display sizes and records width, height, MIME type, size, and alt translations.

## 5. Data model

### 5.1 Core catalog records

- `Category`: identifier, stable internal code, parent category, slug, publishing state, display order, timestamps.
- `CategoryTranslation`: category, locale, name, description, SEO title, SEO description.
- `Brand`: identifier, slug, name, logo reference, publishing state, timestamps.
- `Product`: identifier, SKU, slug, category, brand, nullable decimal price, `AMD` currency, availability enum, characteristics JSON, featured flag, new flag, publishing state, display order, timestamps.
- `ProductTranslation`: product, locale, name, short description, full description, SEO title, SEO description.
- `ProductImage`: product, storage key, generated variants, dimensions, position, primary flag, translated alt text, timestamps.
- `AdminUser`: email, password hash, role, active state, refresh-token session metadata, timestamps.
- `SiteSetting`: configurable public contact and social-link keys without invented values.

Translations use a unique constraint on `(recordId, locale)`. Product SKU and public slugs are unique. Public queries are indexed by publishing state, category, brand, featured state, new state, display order, and searchable text.

### 5.2 Future commerce compatibility

The initial release does not create inactive placeholder modules. Later releases may add `ProductVariant`, `InventoryItem`, `Cart`, `CartLine`, `Order`, `OrderLine`, `Payment`, and `Shipment` as separate modules referencing the stable `Product` identity. Catalog API consumers will not need to change for that addition.

## 6. Public routes and behavior

Locale-prefixed routes:

- `/:locale` — home.
- `/:locale/catalog` — all products.
- `/:locale/catalog/:categorySlug` — category.
- `/:locale/search` — search results.
- `/:locale/product/:productSlug` — product detail.
- `/:locale/about` — about ATHLON.
- `/:locale/contacts` — contacts.
- localized not-found route.

The root route redirects to the best supported locale, preferring a stored choice, then browser language, then Russian.

Catalog state is represented in URL query parameters so filtered and sorted views are linkable. Supported controls include category, brand, availability, price range, sort order, page, and search query. Invalid filters fall back safely rather than causing an application error.

## 7. Home-page design

The supplied ATHLON images are copied into public assets with descriptive filenames. They remain undistorted and are not regenerated or edited:

- `/Users/karenengineer/Downloads/photo_2026-09-10 18.12.18.jpeg`
- `/Users/karenengineer/Downloads/photo_2026-09-10 18.12.22.jpeg`
- `/Users/karenengineer/Downloads/ChatGPT Image Sep 10, 2026, 06_10_26 PM.png`

The approved visual system uses:

- Near-black `#080809` for the announcement bar, navigation, and hero area.
- ATHLON red `#E5001B` for primary actions, selected states, and restrained diagonal accents.
- Light neutral `#F0F0F2` for the catalog showcase.
- White product cards with clear borders, light shadows, large image wells, and dark readable text.

The desktop first viewport contains:

1. A compact announcement strip.
2. Header with logo, public navigation, search, and HY/RU/EN selector.
3. Two visible category controls: Sports nutrition and Accessories.
4. A compact brand hero, rather than a full-height hero.
5. A prominent sports-nutrition product row containing protein, creatine, amino-acid/BCAA, and pre-workout examples.

The same content hierarchy is preserved on tablet and mobile. Mobile navigation becomes a keyboard-accessible drawer, category controls remain near the top, and the product row becomes a two-column or horizontal layout without hiding products behind the hero.

## 8. Product presentation

Product cards contain a fixed-aspect-ratio image area, localized name, category or subtype, optional price, availability, and a link to details. Missing images use a local deterministic placeholder. Missing prices use localized explanatory copy and never display invented values.

The detail page contains breadcrumbs, gallery, localized copy, brand, category, optional price, availability, characteristics, contact action, and related products. Contact actions are rendered only when their corresponding site setting exists.

Loading views use stable skeleton dimensions. Empty and error states provide a clear recovery action. Product images use lazy loading outside the first viewport and reserve dimensions to avoid layout shifts.

## 9. Administration

The administration area provides:

- Login and logout.
- Dashboard with catalog counts and unpublished items.
- Searchable, filtered, paginated product list.
- Product create, edit, preview, publish, unpublish, and delete flows.
- Category and brand management.
- HY/RU/EN translation fields with missing-translation indicators.
- Multi-image upload, ordering, primary-image selection, alt text, and deletion.
- Price, availability, featured, new, and display-order controls.
- Explicit confirmation for destructive actions.

The initial admin is created only when seed environment variables are present. Credentials are never committed or given defaults in production.

## 10. Authentication and security

Passwords are hashed with Argon2. Access and rotated refresh tokens are sent only in `httpOnly`, `secure`-in-production, appropriately scoped cookies with a restrictive SameSite policy. Refresh sessions can be revoked on logout. State-changing requests use an explicit CSRF defense appropriate to the final cookie and deployment topology.

The API applies Helmet, rate limits sensitive endpoints, uses a narrow configurable CORS allowlist, validates all DTOs, authorizes admin actions on the server, and prevents path traversal in media operations. Secrets are loaded only from environment variables.

## 11. Localization and SEO

The UI uses runtime translations compatible with SSR. Product and category content comes from normalized translation records. Every public page provides localized document title, description, canonical URL, and `hreflang` alternatives.

Product pages emit valid Product structured data only from stored facts. Breadcrumb pages emit `BreadcrumbList`. The API or web server provides `sitemap.xml` and `robots.txt`. Open Graph metadata uses configured content and real stored images. No medical, certification, pricing, or performance claims are invented.

## 12. API outline

Public endpoints include health, site settings, categories, brands, product list, product detail, featured products, new products, and search suggestions.

Administrative endpoints include authentication, session refresh, logout, product CRUD and publishing, category CRUD, brand CRUD, media upload and ordering, and editable public settings. List endpoints use bounded pagination and validate sort fields. Public endpoints never return unpublished records.

## 13. Error handling and observability

The Angular client maps API failures into user-facing loading, empty, validation, authorization, and retry states. An HTTP interceptor handles correlation IDs and refresh behavior without refresh loops. SSR failures degrade to a meaningful error page rather than returning an empty shell.

The API exposes liveness and readiness checks. Structured logs distinguish validation, authentication, application, database, and storage errors. Production responses do not expose stack traces or database details.

## 14. Testing strategy

- API unit tests cover domain services, authorization rules, filters, translation selection, and storage validation.
- API integration tests run against a disposable PostgreSQL database and cover authentication, public visibility rules, CRUD, pagination, and upload rejection.
- Angular unit tests cover locale routing, filters, product presentation, guards, and error states.
- Browser tests cover the home page, catalog discovery, language switching, product detail, admin login, and product editing.
- Automated accessibility checks cover representative public and admin pages.
- CI-equivalent verification runs formatting checks, lint, unit tests, integration tests, browser tests where supported, and production builds for both applications.

## 15. Delivery stages

1. Scaffold the pnpm workspace, Angular SSR application, NestJS API, local configuration, and PostgreSQL service.
2. Implement Prisma schema, migrations, seed data, and the public catalog API.
3. Implement admin authentication and administrative catalog endpoints.
4. Build the public layout, approved home page, catalog, search, and product detail.
5. Add runtime localization and localized SEO.
6. Build the administration interface and media workflows.
7. Complete security hardening, tests, documentation, and production verification.

Each stage ends with relevant lint, tests, and builds. Failures are fixed before the next stage.

## 16. Acceptance criteria

- A fresh checkout can be configured using `.env.example` and started using documented pnpm and Docker Compose commands.
- PostgreSQL starts locally, migrations apply, and demonstrative seed data loads.
- The public catalog works in Armenian, Russian, and English with locale-prefixed URLs.
- Only Sports nutrition and Accessories appear as top-level categories.
- Sports-nutrition products are clearly visible within the initial desktop home-page viewport.
- Search, filters, sorting, pagination, category pages, product pages, and related products use the real API.
- The administrator can manage the full catalog and its translations and images.
- No cart, checkout, online payment, customer account, or order flow is present.
- Responsive layouts, accessibility states, SSR metadata, error states, lint, tests, and production builds pass the documented verification workflow.
