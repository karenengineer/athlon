# Technical SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair crawler discovery, localized search presentation and crawlable product navigation while preserving the current storefront.

**Architecture:** A slim Nest/Prisma public inventory feeds real Express crawler endpoints. Angular owns document-local metadata and JSON-LD lifecycle across public routes. Three nonoverlapping owners can implement against the agreed inventory contract; final integration verifies actual SSR and the browser.

**Tech Stack:** Existing NestJS, Prisma, Angular21 SSR, Express, TypeScript, Jest/Vitest and Node SSR tests; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-31-technical-seo-design.md`

## Global Constraints

- Canonical origin `https://athlon.am`; HY/RU/EN. Preserve checkout, stock/prices, business facts, hero design and private-route security.
- No fabricated address/hours/reviews/ratings/medical claims/return terms or lastmod. No real credentials/DB writes/migrations/orders.
- Same checkout, branch `codex/technical-seo`, base `9ce1879663f47dfd0535d015aa8257a217790a06`; initial clean tree.
- No new dependencies, production/account/DNS changes, merge or deploy. Changes remain reviewable on this branch.

## Review Focus

1. Malicious product/slug text, script termination, XML injection, canonical origin poisoning and pre-Angular security bypass.
2. Product-to-product/locale/error navigation and hydration must not leak metadata/schema or falsely label an outage404.
3. Sitemap must never silently omit published inventory on partial failure or expose drafts/private data.
4. Page2 must remain crawlable/self-canonical, filters stay functional, and noindex variants must remain crawlable.
5. Existing private routes/host-proxy tests and mobile layout must not regress.

### Task 1: Public sitemap inventory — backend engineer

**Own:** new `apps/api/src/seo/**`, `apps/api/src/app.module.ts`, new scoped API unit/e2e tests.

**Produces:** `GET /api/v1/public/seo/sitemap` -> `{productSlugs:string[],categorySlugs:string[]}`.

- [ ] Write failing service/controller tests for published-only selection, published category parent/children visibility, stable sorted/deduplicated slugs, no sensitive fields, and failure propagation; observe RED.
- [ ] Implement a small read-only module mirroring current public publication predicates, selecting slugs only; no schema/seed changes.
- [ ] Verify focused tests, API typecheck/lint and report exact contract/test commands. Do not edit other owners' files or commit.

### Task 2: Public page metadata and crawlable pagination — frontend engineer

**Own:** `apps/web/src/app/core/seo/**`; home/product/catalog/information/not-found TS/specs; catalog HTML/SCSS; basket metadata only if needed; scoped integration tests and minimal localized metadata-copy module. No server.ts, server middleware or scripts.

**Consumes:** current public API models. **Produces:** one lifecycle-safe metadata API with canonicals/alternates/robots/OG/JSONLD and real response statuses; real pagination hrefs.

- [ ] Write RED tests covering all locales' home/category/product titles/descriptions, one self-canonical, reciprocal alternates, schema facts/safe serialization, no stale metadata after route/error transitions and hydration ownership.
- [ ] Write RED tests for true404 vs503, published empty200, invalid/out-of-range page state, filter/search/basket noindex, page2 canonical and real next/previous query-preserving anchors.
- [ ] Extend helper without breaking old setters, migrate public pages coherently; fixed origin only; truthful product/organization/breadcrumb schema, no fabricated Offer for invalid/missing price or unknown availability.
- [ ] Implement real status handling using optional request-specific Angular RESPONSE_INIT. Preserve host/private guards and current product/filter/basket behavior.
- [ ] Run scoped tests, web typecheck/lint/build; document helpers, selectors and localized literals for final SSR owner. No commits.

### Task 3: Real crawler endpoints and built SSR coverage — release operations

**Own:** `apps/web/src/server.ts`, new `apps/web/src/*seo*middleware*`/crawler helpers and tests; `scripts/test-production-ssr.mjs`; SEO setup docs/README section; this plan's ignored GET-only QA fixture.

**Consumes:** inventory contract Task1 and frontend route semantics Task2. Server work may proceed against fixtures while frontend is written; final SSR assertions wait for frontend handoff.

- [ ] RED direct HTTP text/XML200 (no redirect), sorted/deduped/escaped inventory URLs, static localized pages, empty published catalog, malformed/oversized response, timeout/cache/single-flight/failure behavior.
- [ ] Implement fixed-origin endpoints with explicit equivalent allowed-host/protocol/prefix protections before Angular; finite trusted internal fetch; valid XML and no fabricated lastmod/partial-success sitemap.
- [ ] Extend real production SSR tests for metadata/alternates/schema/status/pagination all locales, keeping every existing admin/payment client/noindex/zero API, host/proxy and health assertion. Coordinate expectations with frontend only after its report.
- [ ] Document Search Console ownership verification, sitemap submission/URL Inspection and measurement as external operator tasks; no secrets or claims of account access.
- [ ] Produce this plan's standalone synthetic GET-only localhost3000 QA fixture including inventory/real pagination/product404/outage controls; do not run production APIs or mutation endpoints.
- [ ] Run focused crawler tests and final built SSR after integration; narrow lint/format/typecheck. No commits.

### Task 4: Independent verification and handoff — root/reviewers

- [ ] Root inspects all diffs including new files and interfaces; full `pnpm verify`, plus appropriate ops tests for changed scripts.
- [ ] Prepare current-run QA manifest with exact base/dirty snapshot/patch, safe fixture and owned-process cleanup. Manual QA checks metadata transitions, all locales, real links, correct errors and320/390/desktop layout; no orders/contact/payment submissions.
- [ ] Read-only security and performance reviewers run in parallel with manual QA; fix material findings through the relevant implementation owner and verify fixes.
- [ ] Report commands/results, unresolved Search Console/account work, known stylesheet warnings and ranking limitations. Keep branch reviewable; no merge/deploy until requested.
