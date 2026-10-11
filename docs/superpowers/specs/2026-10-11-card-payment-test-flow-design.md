# Isolated Card-Payment Test Flow Design

**Status:** Draft for user review. Implementation has not started.

## Goal

Provide an admin-only, separately routed way to exercise the storefront basket and card-payment UI in production without changing the existing customer checkout or contacting Ameriabank. Until Athlon has an agreement, credentials, and a verified merchant manual, the test flow uses a clearly labeled mock payment provider.

## User intent and constraints

- The ordinary purchase flow must continue to work exactly as it does on `main`.
- The test flow must have separate URLs and must not appear in public navigation.
- Test routes must be restricted to authenticated administrators, with a server-side feature flag that is disabled by default.
- The mock must exercise pending/success/failure/cancel/timeout behavior without collecting card data, contacting a bank, or sending real order emails.
- Ameria sandbox support must not be guessed from public or incomplete documentation. It may be added only after the merchant's official manual and sandbox credentials are available and verified.
- No merge, deployment, production configuration change, or live payment is part of this work.

## Current repository findings

- Worktree is clean on `codex/card-payments`.
- Public basket route is `/:locale/basket` and uses `BasketPage` for basket editing, customer details, order validation, and submission.
- The existing public API is `POST /api/v1/public/orders`; it supports cash-on-delivery and has a card path that fails closed unless the payment initializer is enabled.
- Ameria credentials are validated server-side, but `AMERIA_PAYMENT_FLOW_READY` is false; `AmeriaVposClient` intentionally rejects initialization and status lookup because the merchant integration contract is unverified.
- Admin UI uses `adminAuthGuard` and server APIs use `AdminAuthGuard` plus `CsrfGuard` on mutations. These existing boundaries can protect the test flow.
- No mock provider or dedicated test checkout routes currently exist.

## Proposed design

### Web routes and reuse

Add `/admin/card-payment-test/:locale` for `hy`, `ru`, and `en` under the existing authenticated admin route tree. Do not add navigation links. Reject unsupported locales and retain the admin guard's safe return URL behavior. The page reuses the existing basket display, customer form, current-price validation, and localized copy where feasible, while presenting only the test card-payment choice and a persistent visible `TEST / MOCK` indicator. The product basket remains the shared basket so an administrator can test the same products and quantities without duplicating catalog data.

The mock provider screen is a separate route under the same guarded namespace. It offers deterministic test outcomes (success, decline/failure, cancel, timeout) and never renders card-number/CVV fields. Return navigation updates the test page's pending/result state. Failed or abandoned attempts preserve the basket and entered details. Successful mock completion clears only the test checkout's basket state according to the existing checkout contract; the page explicitly says this is a simulation and not a real payment or order.

### API and provider isolation

Add test-only admin endpoints separate from `PublicOrdersController`, protected by the existing `AdminAuthGuard`; state-changing calls also require `CsrfGuard` and throttling. Require a new server environment flag `CARD_PAYMENT_TEST_FLOW_ENABLED` (default `false`) for all test endpoints and test routes' public capability lookup. When disabled, requests fail closed.

The test service uses an explicit mock provider implementation and test-specific references/state. It must not call `OrdersService.submit`, `AmeriaPaymentsService`, `AmeriaVposClient`, the Resend order-email service, inventory, or finance mutations. No Ameria production or sandbox credentials are read by the mock implementation. Responses, page title/banner, and stored test records (if persistence is needed) identify the mode as mock so they cannot be mistaken for a real transaction.

Test state should be isolated from production order/payment records. Prefer short-lived mock session state with bounded expiry and no customer PII persistence; persist only if required to support reliable production multi-instance behavior, and then use an explicitly mock-only record type/state with no finance, stock, notification, or fulfillment side effects. This persistence choice is to be resolved during the implementation plan after checking current deployment topology and payment schema.

### Ameria sandbox boundary

This change implements mock mode only. It does not enable or call Ameria, infer checkout URLs, map bank result codes, or treat browser redirects as verified payment. The test architecture should preserve a provider interface so an Ameria sandbox adapter can be added later against the merchant's verified technical manual and sandbox credentials, using separate sandbox-only secrets and hosts. The existing `AMERIA_PAYMENT_FLOW_READY = false` and production payment feature flag remain unchanged.

### Localization and UX

All test checkout, mode banners, simulated outcomes, pending/error states, and instructions are localized in Armenian, Russian, and English. Clearly state that the test does not charge a card and creates no customer order. The public basket UI, messages, route behavior, and API remain unchanged.

## Security and failure behavior

- Guard both browser routes and API endpoints; a guessed URL or direct API request from a non-admin is rejected.
- Keep the new feature flag false by default and fail closed if missing or malformed.
- Apply CSRF protection to state changes and rate-limit mock session creation/outcome selection.
- Do not collect PAN/CVV, call Ameria, send order emails, or mutate inventory/finance/order fulfillment in mock mode.
- Validate locale, basket item identifiers and quantities server-side; derive names and current prices from the database just as production does.
- Preserve basket and customer details after failure, cancel, timeout, or abandoned payment.
- Mock outcome requests must be idempotent and bound to an expiring test-session reference.

## Verification

- Web route tests: all three locales render through the guarded route; unauthenticated users return to admin login; no public navigation points to test URLs; flag-off hides/rejects the flow.
- API tests: unauthenticated/CSRF-invalid/feature-disabled requests are rejected; non-admin cannot create or mutate sessions; mock success/failure/cancel/timeout are deterministic and idempotent.
- Safety tests: mock never calls Ameria, Resend, production-order payment methods, inventory, or finance services; no card fields are rendered; real card feature remains disabled.
- Checkout tests: prices and availability come from server data; failure/cancel/timeout preserve form and basket; all user-visible states are localized.
- Run the repository's relevant tests, full `pnpm verify`, and production build checks. No real bank requests or email sends in tests.

## Open implementation detail

Choose the test session storage model (in-memory versus isolated persistence) after confirming production's API replica/restart characteristics. The choice must not change the security or side-effect boundaries above.

## Approval gate

User approved the in-chat design on 2026-10-11. This written specification is awaiting review. After user approval, write and review a task-level implementation plan before changing application code. Do not merge, deploy, enable production payment credentials, or run real payments as part of this work.
