# Payment Success Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After verified successful card-test payment, remove purchased quantities once and show the approved localized success page with a home link.

**Architecture:** Reuse the existing owner-scoped session API and feature guard. A lazy-loaded success page revalidates the session before showing confirmation and reconciling the basket. Ordinary checkout and the payment backend stay unchanged.

**Tech Stack:** Angular 21, signals, RxJS, Vitest, existing SCSS and HY/RU/EN localization.

**Spec:** Approved preview: `/Users/karenengineer/.codex/visualizations/2026/09/14/01a09f37-674f-74f1-bb33-61045582eaed/athlon-payment-success.html`; user approved on 2026-10-21. Adapt the purchase preview to the currently supported MOCK and AMERIA_SANDBOX flows; do not pretend a test creates a real order.

## Global Constraints

- Work in `/Users/karenengineer/Desktop/Projects/athlon-sport`, starting from clean HEAD `224067b460d924069e055f519810a26ddb75794a`, on a new `codex/payment-success` branch in the same checkout (the user declined worktrees).
- Leave the older Documents checkout and its pre-existing untracked plan untouched.
- No production operations, deployment, secret access, real bank requests, email, or payment submissions.
- Do not enable live card payments or change COD order acceptance/confirmation.
- Only an owner-scoped server session with matching reference/mode, `SUCCEEDED`, AMD currency, and valid totals can authorize success. Sandbox total must equal 10 AMD.
- MOCK copy says simulated; AMERIA_SANDBOX copy says bank-confirmed test. Both say no real order was created.
- Reuse existing fonts, brand styles and localization; no new dependencies, copied preview controls, example order IDs, or invented email-delivery claims.

## Review Focus

- Reload/back/direct entry must reverify status and cannot subtract a purchased quantity twice.
- Unrelated products and extra same-product quantity added during payment must survive reconciliation.
- Storage denied/corrupt or unavailable server session must fail safely without deleting basket items or encouraging another charge.
- A forged success URL, mismatched response, pending payment, or network error must never display verified success.
- Long HY/RU copy must fit 320px mobile; success page and its home action must be keyboard accessible.

---

### Task 1: Persisted, once-only basket reconciliation

**Files:** `apps/web/src/app/core/basket/basket.service.ts` and `.spec.ts`.

**Interfaces:** Add `settlePayment(reference: string, items: Array<{ productId: string; quantity: number }>): boolean`. Return true for already-settled references; false for invalid inputs/storage failure without changing the basket. Atomically retain basket items and settlement references in one versioned local-storage record, while reading the existing array format for backwards compatibility. Do not prune settlement references silently. Retain current add/update/remove/clear APIs.

- [x] Write failing tests: basket A=3/B=1, settlement A=2 yields A=1/B=1; repeating settlement after service recreation leaves quantities unchanged; a new reference settles independently; malformed quantities/duplicates, corrupt storage, denied writes and SSR do not remove items.
- [x] Run the focused basket-service tests and record expected feature-missing failures.
- [x] Implement minimal validation, storage migration and persistence. Refresh current stored state before reconciliation; update signals only after the settlement record is retained successfully. Do not claim cross-tab transactions are atomic: localStorage does not offer transactional compare-and-swap.
- [x] Rerun the focused tests and existing basket-service suite.

### Task 2: Verified success route and approved responsive page

**Files:** `apps/web/src/app/app.routes.ts`; `core/i18n/i18n.service.ts`; `features/basket/basket-page.ts`, `basket-page.spec.ts`, existing sandbox spec; `features/admin/card-payment-test/card-payment-test.routes.spec.ts`; new `payment-success-page.ts`, `.html`, `.scss`, `.spec.ts` in the card-payment feature.

**Interfaces:** Register `/card-payment-test/:locale/success/:reference` beneath the existing feature guard. Consume `CardPaymentTestApiService.getSession(reference)` and the configured payment mode; consume Task 1's `settlePayment`. Home link points to `/:locale`. Existing `card-payment-test/**` client-render/noindex policy remains applicable.

- [x] Write failing tests for redirect from verified return and already-succeeded create-session replay; no success redirect for any other status or mismatched reference/mode/currency/amount.
- [x] Write success-page tests for independent server verification on direct entry/reload, safe failure states, MOCK versus sandbox copy/amount, once-only basket settlement, storage failure, each locale, semantic heading/status, title and home URL. Assert that query parameters alone never authorize success.
- [x] Run targeted tests and capture expected missing-feature failures.
- [x] Add lazy component and translations using the approved centered white confirmation card, green check, receipt amount/payment/status rows and large black home action. No card fields, customer details, or fabricated receipt data. Read current data before success rendering; render pending/error recovery without claiming payment failed when its status is unknown.
- [x] Navigate both verified success branches to the new route with `replaceUrl`; leave unsuccessful return behavior and COD untouched. The new page rechecks the session rather than trusting router state.
- [x] Run targeted tests followed by the complete web test suite, web typecheck, lint and build. Update route-shape assertions intentionally.

### Task 3: Independent review, local visual QA and handoff

**Files:** Update this plan with results and add concise route/behavior documentation in the existing card-test documentation if appropriate. Root owns documentation; implementation agents own only `apps/web`.

- [x] Inspect the full current-run diff and document exact changed files against the clean baseline.
- [x] Dispatch read-only security/performance review plus focused manual QA using current-run manifest, safe named local HTTP fixtures and HY/RU/EN desktop/mobile states. Never submit even a simulated payment: fixture successful session reads instead. Manual QA is blocked if local origin safety or fixtures cannot be established.
- [x] Evaluate all findings and test fixes using red/green regression coverage.
- [x] Run format check, full web suite, typecheck, lint, production builds, SSR checks and relevant repository verification; report any environment blockers explicitly.
- [x] Hand off the implemented branch and evidence. Do not push, open/merge a PR, deploy, or perform a transaction as part of this approval alone.

## Limitations

The current feature is a test flow, not live merchant checkout. Sandbox confirmations do not create orders or send fulfillment email. Clearing purchased quantities cannot distinguish a product removed and then re-added during an external bank visit; this follows quantity subtraction semantics. Concurrent cross-tab writes are not transactionally serializable in localStorage and require separate scope if strict cross-tab settlement is needed. No claim of a live payment/order should be added until a separately authorized production integration exists.

## Implementation and verification result — 2026-10-21

- Application checkpoints: `bbe03bd`, `b6d99f7`, `fdee259`, `0a1ca46`, `584c02e`, on `codex/payment-success`; no remote operations or deployment.
- Completed sandbox requests now bind their originating retained request key to the returned session reference. Success retires only that matching attempt after basket settlement. A later identical basket gets a fresh key; an older return cannot erase a newer attempt. Unbound legacy requests remain protected; owner-authoritative same-key create replay safely recovers terminal failed/cancelled/expired attempts. No backend contract change.
- Independent reviews found and verified fixes for ordinary-storage-read history loss, completed-key reuse, and legacy unsuccessful-attempt recovery. Final whole-feature security/correctness and performance reviews report no actionable new defects.
- Root ran all remaining `verify` gates together after final application changes: Prisma schema validation/generation, typecheck, lint, API unit tests **186 passed**, web tests **379 passed**, e2e **321 passed / 12 existing skips**, API/web production builds, and production-shaped SSR assertions: **exit 0**. `pnpm test:ops` also passed all fixture assertions and **9 workflow tests**.
- Full `pnpm verify` is **not green**: its formatting gate reports **61 pre-existing tracked files under `apps/api/.agents`**. That directory is identical to base `224067b`; unrelated skill-document content was not reformatted. Changed feature files pass their scoped formatting check. The unchanged basket stylesheet still emits its existing **4.20kB / 4.00kB budget warning**. Web tests emit the existing jsdom navigation notice; SSR negative-host security tests intentionally log rejected-host errors while passing.
- The profile browser tester was blocked because port4200 belonged to another project. Root independently tested this checkout on isolated port4201 against a GET-only local API fixture: purchased quantity subtraction, extra/unrelated item retention, reload idempotency, exact-basket clearing, pending/failed non-success UI, real home navigation, 3px keyboard focus, and HY/RU/EN layouts at320/390/660/1280px as relevant. No horizontal overflow was observed in measured mobile/desktop frame layouts. This is fixture-based evidence, **not a real bank transaction** or a physical Safari/device certification.
- Local success routes use `/card-payment-test/{hy,ru,en}/success/:reference`. Enter through checkout with an owned session; a fabricated URL cannot prove payment. Existing feature configuration/access restrictions still apply. No new environment variables or credentials are required.
