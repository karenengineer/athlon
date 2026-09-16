# ATHLON Admin and HY Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure multilingual administration UI and Armenian public default with the supplied favicon.

**Architecture:** Extend the existing Angular app with lazy administrative routes before `:locale`. Reuse NestJS cookie sessions and CRUD; extend list contracts without altering public endpoints. Keep forms, authentication, media and translations in focused files.

**Tech Stack:** Angular 21, reactive forms, RxJS, NestJS, Prisma, PostgreSQL, existing Vitest and API E2E setup.

**Spec:** `docs/superpowers/specs/2026-09-16-admin-and-continuous-deployment-design.md`

## Global Constraints

- Domain: `athlonsport.am`, with `www.athlonsport.am` supported.
- No cart, checkout, orders, payments, or additional hosting services.
- Access/refresh tokens remain HttpOnly cookies; never copy them into localStorage or expose them to Angular.
- Do not change production passwords or seed production during this work.
- Explicit `/ru` and `/en` links remain unchanged.
- User favicon source: `/Users/karenengineer/Downloads/android-chrome-512x512 (1).png`; preserve original bytes/logo, no AI regeneration.

## File responsibilities and contracts

`core/i18n` owns public locale defaults; `features/admin/auth` owns session state and same-origin CSRF; `features/admin/shared` owns list types and translated UI labels. Separate `products`, `categories`, `brands`, `media`, and `dashboard` folders own their pages. No generic mega-editor or separate admin application.

New administrative lists return `{items,meta:{page,pageSize,total,totalPages}}`; query keys are `q,page,pageSize,published,sort`. Products additionally accept `categoryId,brandId,availability,featured,isNew`. Sort allowlist: `order`, `updated`, `name`; product price additionally `priceAsc`, `priceDesc`. Default page 1, size 24, max size 100; reject invalid integers, enum and boolean values with 400. Missing filter means all values. Existing admin category/brand array lists are changed to this envelope; public category/brand routes remain unchanged. Select controls load options through repeated admin pages, not public published-only lists.

### Task 1: HY default and supplied favicon

**Files:** Modify `apps/web/src/app/app.routes.ts`, `core/i18n/{i18n.service,locale.guard}.ts`, `features/{home/home-page,catalog/catalog-page,product/product-page}.ts`, `apps/web/src/index.html`; create `apps/web/public/brand/favicon.png` and `apps/web/src/app/core/i18n/locale-default.spec.ts`.

**Interfaces:** Consumes current locale-route convention; produces root and fallback HY, explicit supported locale preservation, `/brand/favicon.png`.

- [ ] Write route tests using Angular TestBed/RouterTestingHarness and existing test runner:

```ts
await harness.navigateByUrl("/");
expect(router.url).toBe("/hy");
await harness.navigateByUrl("/ru");
expect(router.url).toBe("/ru");
```

- [ ] Run `pnpm --filter @athlon/web test`; confirm root assertion fails with `/ru`, not a fixture error.
- [ ] Change existing root and wildcard redirects, locale service initial signal, guard fallback, and page null-locale fallbacks to `hy`. Inspect API defaults and set missing-locale default HY without changing explicit locales. Copy supplied binary as an asset (byte-preserving asset import is not source generation). Connect `<link rel="icon" type="image/png" href="/brand/favicon.png">` and apple-touch-icon to this asset; remove conflicting old icon declarations.
- [ ] Test unsupported locale behavior, `/en`, API missing/explicit locale, initial service locale; verify asset SHA matches source. Run web tests, lint and build.
- [ ] Commit `feat(web): default to Armenian and install ATHLON favicon`.

### Task 2: Administrative API list and dashboard contracts

**Files:** Modify `apps/api/src/{products,categories,brands}/admin-*.{controller,service}.ts`; create `apps/api/src/common/dto/admin-list-query.dto.ts`, product-specific query DTO, and `apps/api/test/admin-catalog.e2e-spec.ts`; add category/brand get-by-id service/controller methods.

**Interfaces:** Produces the envelope/query contract above and GET `/api/v1/admin/categories/:id`, `/brands/:id`; current product get/create/update/delete and media endpoints stay stable. Dashboard uses total counts from three list queries with pageSize=1, avoiding a new dashboard API.

- [ ] Add E2E assertions with existing DB fixtures/login helpers:

```ts
await request(app.getHttpServer())
  .get("/api/v1/admin/products?page=bad")
  .set("Cookie", cookies)
  .expect(400);
const result = await request(app.getHttpServer())
  .get("/api/v1/admin/products?published=false&pageSize=1")
  .set("Cookie", cookies)
  .expect(200);
expect(
  result.body.items.every((p: { published: boolean }) => !p.published),
).toBe(true);
expect(result.body.meta.pageSize).toBe(1);
```

- [ ] Run `pnpm --filter @athlon/api test:e2e`; verify assertions fail for missing validation/filter, not missing authentication.
- [ ] Implement DTO parsing via explicit boolean transform (do not use Boolean('false')), bounded integer validation, Prisma where conditions across SKU/slug/translations and allowlisted orderBy; use same where for count/findMany. Return 404 for missing category/brand. For deletion, preserve FK conflicts as controlled 409 and reject category cycles; do not cascade products. Validate duplicate translation locales and required text.
- [ ] Cover every list resource, query allowlist, mixed filters, deterministic order tie-breaks, unauthenticated 401, mutation CSRF rejection, get 404 and dependent deletion conflict; run API E2E/lint/build.
- [ ] Commit `feat(api): support administrative catalog lists`.

### Task 3: Authenticated admin shell and dashboard

**Files:** Create `apps/web/src/app/features/admin/admin.routes.ts`, `auth/{admin-session.service,admin-auth.guard,admin-http.interceptor,login-page}.ts`, corresponding tests/templates/styles; create `admin-shell`, `dashboard/dashboard-page`, `shared/admin-i18n.service.ts`, `shared/admin-api.types.ts`; modify `app.routes.ts`, HTTP providers, server route render configuration.

**Interfaces:** `AdminSessionService` exposes user signal, `ensureSession(): Observable<boolean>`, `login(email,password): Observable<void>`, `refresh(): Observable<void>`, `logout(): Observable<void>`. Admin API types match Task2 envelopes and current DTO fields. Locale UI uses HY/RU/EN, initial HY. No auth state in localStorage.

- [ ] Write guard/interceptor tests with HttpTestingController:

```ts
const req = http.expectOne("/api/v1/admin/products");
expect(req.request.headers.get("x-csrf-token")).toBe("fixture-csrf");
expect(http.match("https://untrusted.example/").length).toBe(0);
```

Also assert failed `me` denies guarded navigation, `/admin/login` resolves to LoginPage rather than locale guard, and credentials do not appear in localStorage.

- [ ] Run web tests and observe failure before adding production auth code.
- [ ] Implement explicit `/admin` lazy routes before public route. Configure client-only admin rendering using Angular server routes; no private SSR calls. Login posts credentials; guard uses `me`, one shared refresh on 401, retry once, failure clears state and routes login. Interceptor adds CSRF only to same-origin `/api/v1/admin/` mutations; refresh/logout included; never recurse on auth failures. Read cookie only in browser; server-configured name is exposed as nonsecret frontend configuration default `athlon_csrf`. Restrict return URL to local `/admin` paths excluding login.
- [ ] Build responsive shell/navigation with logout/locale switch and dashboard total counts from pageSize=1 lists. Set noindex metadata and remove when leaving admin. Login remains keyboard accessible and shows generic errors; no signup or password-recovery subsystem.
- [ ] Cover concurrent refresh single request, no infinite retry, external URL no-CSRF, secure logout navigation, dirty-form guard interface, SSR public routes unaffected. Run web tests/lint/build.
- [ ] Commit `feat(admin): add secure session shell and dashboard`.

### Task 4: Category and brand CRUD

**Files:** Create `features/admin/categories/{category-list,category-editor}` and `brands/{brand-list,brand-editor}` TS/templates/styles/tests; create `shared/{admin-catalog.service,translation-tabs,delete-confirmation,dirty-form.guard}`; extend admin routes and HY/RU/EN labels.

**Interfaces:** Service wraps Task2 endpoints using typed list/get/create/update/delete; editor DTOs follow current `create-category.dto.ts`, `create-brand.dto.ts` and translation DTOs. Confirm dialog returns boolean; dirty guard reads `hasUnsavedChanges(): boolean` from editor.

- [ ] Add component integration tests which exercise user inputs and actual HttpTestingController request bodies:

```ts
expect(save.disabled).toBe(true); // missing required slug/text
// Populate form through DOM events, submit, then inspect real request.
expect(
  req.request.body.translations.map((t: { locale: string }) => t.locale),
).toEqual(["hy", "ru", "en"]);
```

- [ ] Run web tests; confirm missing editor behavior produces the expected failure.
- [ ] Implement lists with server queries and URL parameters, clear filters/reset page, pagination and named deletion dialog. Editors use reactive validators consistent with DTO max lengths/slug rules; translations have independent tabs/errors, do not overwrite unseen locales. Category parent selection excludes self/descendants; brand name/logoKey supported as existing metadata (no unsafe arbitrary URL injection). Add draft preview and dirty-navigation warning. Display 409 dependent-deletion explanation and inline 400 validation.
- [ ] Test create/update roundtrip, cancellation sends no DELETE, successful deletion refreshes list, page/filter restoration, errors/loading/empty, all UI locales and keyboard dialog focus. Run web tests/lint/build.
- [ ] Commit `feat(admin): manage categories and brands`.

### Task 5: Product editor, lists and secure media

**Files:** Create `features/admin/products/{product-list,product-editor,product-preview}` and `media/product-images` TS/templates/styles/tests; extend shared service/types/labels; modify `apps/api/src/media` only for demonstrated security gaps, with `apps/api/test/media.e2e-spec.ts`.

**Interfaces:** DTO matches `CreateProductDto`; characteristics remain an object edited as validated JSON/key-value data, price number/null in AMD. Images use existing POST multipart `file`, PATCH `images/order`, PATCH `images/:imageId`, DELETE `images/:imageId`. Save new product before uploads; unsaved preview stays local and never publishes a draft.

- [ ] Add tests for invalid price/JSON, SKU/slug and translation validation, unpublished-category options, named deletion, multipart fields and reorder request; backend tests must include content/type mismatch and unauthorized upload:

```ts
await request(server)
  .post(`/api/v1/admin/products/${id}/images`)
  .attach("file", Buffer.from("<svg/>"), "fake.png")
  .expect(401);
// With authenticated cookies + CSRF, the same invalid image must be rejected, not written.
```

- [ ] Run targeted frontend/backend tests and record expected missing behavior failures.
- [ ] Implement all product fields from DTO, server list filters/query state, large local preview, published public link, availability enum labels, images and localized alt text. Client file limit 5,242,880 bytes matches API; server decodes real raster content, restricts dimensions/type, randomizes storage name and prevents traversal/foreign-product image edits. Preserve image ordering and confirm delete. Do not add arbitrary HTML rendering of descriptions/specifications.
- [ ] Test translation preservation, flags/order, upload failure retry, foreign image IDs, oversized/decompression-heavy images, public draft exclusion and accessible mobile forms. Run `pnpm verify`; verify SSR public routes and admin noindex/client rendering; manually inspect 375px and desktop if browser tooling is available, otherwise report the limitation.
- [ ] Update README with admin URL, session behavior, translations/media and verification evidence; commit `feat(admin): complete product and image management`.

## Execution handoff

Complete independent review after each task, then whole-plan review. Keep this plan's ledger distinct from the earlier production-deployment ledger. No push/merge/secret provisioning is implied by local commits. Continue with `2026-09-16-actions-and-telegram.md` only after this deliverable passes verification.
