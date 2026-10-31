# Category and Business Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve localized category discovery and business information, and move free-delivery messaging directly below the homepage H1.

**Architecture:** Reuse Angular public routes and the existing localized Category API. One frontend owner implements reusable content and route metadata; a separate operations owner may extend only the built-production SSR fixture after the route/content contract is agreed. No backend or database work is required.

**Tech Stack:** Angular 21, TypeScript, SCSS, Angular SSR, Vitest, existing Node SSR test script.

**Spec:** `docs/superpowers/specs/2026-10-30-category-business-content-design.md`

## Global Constraints

- HY/RU/EN content, routing, and behavior stay aligned.
- Free delivery throughout Armenia has no order-value condition.
- Phone `041 44 88 55` / `tel:+37441448855`; email `athlonsportgoods@gmail.com`.
- Pay the courier on delivery by cash or card; do not enable public online payments.
- No invented return terms, delivery promises, address, legal entity, dealer status, reviews, or medical claims.
- Do not change prices, stock rules, basket persistence/settlement, checkout, taxonomy, schema, seeds, or production settings.
- No commits, pushes, PRs, merge, or deployment until requested.
- Start from clean `0db50a3e8960667198057763b25f97293e4c8ece`; use `codex/category-business-content` in the same checkout.

## Review Focus

1. Category data failure or an unknown slug must not leave stale metadata or unrelated buying advice.
2. Category/locale changes and navigation to home/product/basket must reset descriptions correctly.
3. Draft, absent, and newly added categories must not produce fabricated navigation links.
4. Long Armenian delivery text and the phone must fit 320px without clipping or hiding the hero action.
5. Returns assistance must not silently become a restrictive or invented store policy.

## Ownership and file structure

- Frontend engineer owns `apps/web` only: existing `features/catalog/catalog-page.{ts,html,scss}`, category tests, `features/home/home-page.{html,scss,spec.ts}`, `layout/header/header.{html,scss,spec.ts}`, `layout/footer/footer.{ts,spec.ts}`, `app.routes.ts`, related route integration tests, and small new content/information/metadata modules with focused tests.
- New reusable units: `features/catalog/category-content.ts` for neutral localized category copy; `features/information/information-content.ts` and `information-page.{ts,html,scss,spec.ts}` for the four information routes; a small `core/seo/page-metadata` helper if needed for lifecycle-safe title/description handling.
- Release operations owns only `scripts/test-production-ssr.mjs`, after frontend confirms route selectors and fixture expectations. It must preserve all existing host/proxy/security/health assertions.
- Root owns plan/spec documents, orchestration, independent verification, and current-run QA manifest. Reviewers do not edit.

### Task 1: Category content and route metadata

**Consumes:** Existing `Category` fields `id`, `code`, `slug`, `name`, `description`, `displayOrder`, and published `children`; no API changes.

**Produces:** Crawlable category links, selected-category introduction/guidance, related-category links, and localized document title/description. Content is derived only from API-published categories.

- [ ] Write category regression tests before implementation: a published `protein` category yields a real localized anchor; absent categories do not appear; nonblank API descriptions override fallback introduction; blank and unknown-category cases stay safe.
- [ ] Add locale/metadata navigation tests for category changes, query/search context, empty/API-error state, and leaving catalog for unrelated public pages. Assert no previous category description remains.
- [ ] Run the tests and observe the expected failures.
- [ ] Implement minimal neutral localized fallback content and category rendering. Keep filters/product queries unchanged and render plain text only.
- [ ] Implement localized title/description updates and cleanup. Use one small reusable lifecycle-safe helper if information pages need the same behavior.
- [ ] Run focused tests, then web typecheck/lint. Do not commit yet.

### Task 2: Localized business pages and footer discovery

**Consumes:** Confirmed facts in the spec, existing locale service/public shell, and Task 1 metadata helper if introduced.

**Produces:** `/:locale/about`, `/contact`, `/delivery`, `/returns` with one shared page component and normal footer links.

- [ ] Write failing route/component tests for all four routes in HY/RU/EN, correct H1/title/description, phone/email links, and localized footer URLs.
- [ ] Assert that delivery is unconditional, the method is cash/card to the courier, and returns copy contains no invented deadline/fee/eligibility requirement. Preserve Instagram/Facebook destinations.
- [ ] Observe failures, then implement the typed content module, reusable page, routes before wildcard, and footer navigation.
- [ ] Verify direct loading, language switching, and information-page-to-home/product navigation do not leak page metadata.
- [ ] Run focused and full web tests; no commits, real contact-link activation, messages, or orders.

### Task 3: Move delivery into the homepage hero

**Consumes:** Existing localized `announcement` copy and existing homepage H1.

**Produces:** No global announcement bar; hero H1 immediately followed by delivery H2, 32px desktop / 18px mobile.

- [ ] Update header tests to assert absence of announcement markup; add home tests asserting `h1.nextElementSibling.tagName === "H2"` and exact localized delivery message/phone in every locale.
- [ ] Observe failures, then move markup, remove announcement-only header styles, and adjust hero sizing/wrapping without changing the established design.
- [ ] Verify search, logo/catalog links, language controls, hero action, and product imagery remain usable.
- [ ] Run targeted tests and web build; record any pre-existing versus new stylesheet budget warnings separately.

### Task 4: Built-production SSR and independent verification

**Consumes:** Agreed final route/content selectors and the real compiled Angular request handler.

**Produces:** Deterministic SSR coverage using synthetic published categories and no external services.

- [ ] Extend the local fixture with localized category descriptions and published children. Assert category anchors/guidance/title/description in the initial HTML for all three locales.
- [ ] Assert each information route renders localized content and contact links, and home H1/H2 order is visible without the old header announcement.
- [ ] Preserve existing SSR locale, allowed-host, forwarded-header, admin/test noindex, and health checks. Never loosen assertions or use a CSR fallback as success.
- [ ] Root runs `pnpm verify` and inspects the complete current-run diff, including new files.
- [ ] Provide a focused manual-QA manifest with base commit/clean snapshot, exact changes, safe local fixtures, affected routes, desktop/mobile/locales, expected metadata transitions, permitted reversible basket changes only if needed, and owned-process cleanup.
- [ ] Run local browser QA plus read-only security/performance reviews. Confirm 320px, 390px, desktop, all four page routes, category links, metadata navigation, and hero H1/H2 order. Do not submit forms, orders, email, or payments.
- [ ] Fix material findings, repeat relevant verification, and report limitations (including unprovided return terms). Hand off the feature branch without releasing it.
