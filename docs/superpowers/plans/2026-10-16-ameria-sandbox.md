# Ameriabank Sandbox Implementation Plan

> **For agentic workers:** Implement the assigned non-overlapping task with test-driven development and report actual RED/GREEN evidence. The root agent integrates and independently verifies all changes.

**Goal:** Make the existing test checkout support the bank-provided one-step sandbox contract without enabling ordinary customer payments.

**Architecture:** Dedicated sandbox adapter, persistent sandbox attempts, and bounded durable OrderID allocation. Existing guest/CSRF context gains an operator-only sandbox capability. The browser delegates card entry to Ameriabank and retrieves server-verified results.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Angular, Docker Compose, Jest/Vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-ameria-sandbox-design.md`.

## Global constraints

- Amount 10 AMD, bank Currency `051`, OrderIDs 30543001–30544000, no recycling.
- Sandbox endpoints only; no live payments, capture, refunds, bank cancellations, or bindings.
- Preserve MOCK mode and disabled ordinary card payment readiness.
- No credentials/card data in source, logs, API responses, or browser storage.
- No real-order, accounting, inventory, or email side effects.

## Review focus

- Initialization timeout or duplicate request must never spend another ID or create another bank payment automatically.
- Forged callbacks and inconsistent bank status/amount/currency/order/opaque must never report success.
- Owner/session expiry and restart must not permit another browser to claim a sandbox attempt.
- A guest without operator access must not consume the finite ID range or inspect bank results.
- Failures must preserve the basket and keep the ordinary checkout and mocks unchanged.

### Task 1: Backend contract and durable attempts

Owner: backend agent. Files: `apps/api/src/orders/`, `apps/api/src/config/`, `apps/api/prisma/`, and relevant API tests.

- [x] Write and run failing tests for config/access, allocation/idempotency/exhaustion, bank initialization/status, and mock/ordinary checkout isolation.
- [x] Implement sandbox configuration, exact bank client, separate persistence/migration, access capability, and controller dispatch.
- [x] Verify strict matching and deposited-only success; block browser completion of sandbox attempts and sanitize provider errors.
- [x] Run API unit/E2E/schema checks; include actual PostgreSQL concurrency/sequence coverage where supported.

Produces config `{enabled, mode: "MOCK" | "AMERIA_SANDBOX", csrfToken, accessRequired}` and access POST `{accessToken}` → `{unlocked: true}`. Creation accepts existing locale/items plus client UUID `idempotencyKey`. Session retains existing summary fields plus sandbox mode, fixed `total: "10"`, optional `basketTotal` and `checkoutUrl`. States remain PENDING/SUCCEEDED/FAILED/CANCELLED/EXPIRED.

### Task 2: Frontend sandbox flow

Owner: frontend agent. Files: `apps/web/` only. Consumes Task 1 interfaces.

- [x] Write and run failing tests for mode guard, access submission, bank redirect validation, fixed charge display, verified return, and unchanged mocks.
- [x] Implement localized access-code input, sandbox banner, client idempotency, exact hosted redirect, and server-verified result/recheck flow.
- [x] Preserve basket/customer drafts and reject forged callback claims or unknown modes.
- [x] Run web tests, typecheck, and lint.

### Task 3: Deployment configuration and operator documentation

Owner: operations agent. Files: Compose, production environment example, README, and focused operations fixtures only.

- [x] Wire the agreed keys with fail-closed defaults and document sandbox setup and finite ID accounting.
- [x] Explain secure credential entry and operator code; do not enable or deploy.
- [x] Run relevant operations/config checks and confirm no ordinary payment flag changed.

### Task 4: Integration and review

Owner: root agent; reviewers are read-only.

- [x] Inspect all diffs and run full verification and operations checks.
- [x] Run focused local browser QA with safe synthetic provider fixtures, never real bank transactions.
- [x] Request security and performance reviews; resolve every material finding with regression evidence.
- [x] Report tested behavior and any remaining credential/deployment step accurately.

## Verification record

`CI=true pnpm run verify` passed: 183 API unit tests, 283 web tests, 321 E2E tests (12 isolated integration tests skipped in the default run), production API/web builds and SSR checks. `CI=true pnpm run test:ops` passed with all nine workflow tests, including real Compose configuration rendering. The opt-in actual PostgreSQL run separately passed all 11 tests across catalog, authentication, and sandbox persistence. An existing untouched basket SCSS budget warning remains (4.20 kB versus 4 kB).

Focused local browser QA passed HY/RU/EN, desktop/mobile, access prompt, AMD 10 versus catalog amount, server-only results, forged return parameters, pending/error recheck, route isolation, and ordinary checkout. No payment submission or bank navigation occurred. The minor banner-spacing finding was corrected with an explicit line break.

Security findings resolved: zero deposited amount for nondeposited states, persistent nonsecret request identity across refresh/customer edits, strict UUID validation, and stale verification fencing. Performance review's mixed-case UUID locking issue was reproduced against PostgreSQL with a controlled concurrent INSERT barrier (two sequence IDs consumed); normalization fixed it and the same test passed with one ID.

Remaining external step: privately provision sandbox credentials and the separate access code, merge/deploy through the release workflow, then let the operator enter the bank's test card on the bank-hosted page. Actual bank-backed payment success has not been tested or claimed.
