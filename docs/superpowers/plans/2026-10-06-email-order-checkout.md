# ATHLON No-Payment Email Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers submit a localized basket order request with name, phone, and delivery address, notify ATHLON by email, and confirm only after the email provider accepts it.

**Architecture:** Angular submits item IDs, quantities, expected prices (only for stale-cart comparison), locale, and customer details to a public NestJS endpoint. The API reloads product names/prices/availability, validates the request, builds safe plain-text and HTML notification content, and sends it through Resend to the fixed ATHLON email. No local order table, payment processing, inventory reservation, or finance sale is added; a provider-accepted email is the registration record for v1.

**Tech Stack:** Angular 21, NestJS 11, Prisma/PostgreSQL product reads, class-validator DTOs, Nest throttler, Resend HTTPS API via Node fetch (no new dependency), Vitest/Jest.

**Spec:** `docs/superpowers/specs/2026-10-06-email-order-checkout-design.md`

## Global Constraints

- Support Armenian (`hy`), Russian (`ru`), and English (`en`) in all checkout-facing text and email content.
- The success text in Armenian is exactly `Ձեր պատվերը գրանցված է`.
- The payment note is exactly `Վճարումը՝ պատվերը ստանալիս․ կանխիկ կամ քարտով։`, `Оплата при получении заказа — наличными или картой.`, and `Pay the courier on delivery by cash or card.`
- Email only to `athlonsportgoods@gmail.com`; never accept recipient from the browser.
- Browser-supplied product names, totals, and prices are never authoritative. Expected prices are used only to detect a stale basket; email values come from current database records.
- If any item is unpriced, show no aggregate total instead of a partial total.
- Lock basket mutations while submission is pending; preserve basket and entered details on failure.
- Trust only the configured reverse-proxy hop count so production rate limiting stays per customer IP.
- Do not expose provider credentials, log customer PII, or send test requests to the production inbox.
- Do not add card payment, order history/admin workflow, inventory/sales mutation, stock reservation, customer accounts, or online payment.

## Review Focus

- Missing or malformed customer fields must return field-level validation errors and leave the basket intact — test in the API DTO/service task.
- Unknown, unpublished, or unavailable product IDs must not create or email an order — test in the API order service task.
- Forged totals/names and stale expected prices must not affect the emailed amount; stale prices return a review error — test in the API order service task.
- Email provider timeout/rejection must not show success or clear the basket — test provider and web flow tasks.
- User-supplied HTML or line breaks must not inject markup/headers into the order notification — test mail formatting in the API task.

---

### Task 1: Add the validated public order email endpoint

**Files:**

- Create: `apps/api/src/orders/orders.module.ts`
- Create: `apps/api/src/orders/orders.controller.ts`
- Create: `apps/api/src/orders/orders.service.ts`
- Create: `apps/api/src/orders/order-email.service.ts`
- Create: `apps/api/src/orders/orders.types.ts`
- Create: `apps/api/src/orders/dto/create-order.dto.ts`
- Create: `apps/api/src/orders/order-email.service.spec.ts`
- Create: `apps/api/src/orders/orders.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/config/environment.schema.ts`
- Modify: `apps/api/src/bootstrap.ts`
- Modify: `.env.example`
- Modify: `infrastructure/production.env.example`
- Modify: `infrastructure/docker-compose.production.yml`
- Modify: `apps/api/test/setup-env.ts`
- Create: `apps/api/test/orders.e2e-spec.ts`

**Interfaces:**

- `POST /public/orders` request: `{ locale: "hy" | "ru" | "en", customer: { name: string, phone: string, address: string }, items: Array<{ productId: string, quantity: number, expectedUnitPrice: string | null }> }`.
- Successful response: HTTP 201 with `{ accepted: true, orderReference: string }`.
- `OrdersService.submit(input): Promise<{ accepted: true; orderReference: string }>` reloads product snapshots, validates them, then delegates formatted content to `OrderEmailService.send(order)`.
- `OrderEmailMessage` in `orders.types.ts` contains `orderReference`, `locale`, `customer: { name, phone, address }`, `items: Array<{ sku, name, quantity, unitPrice: string | null, lineTotal: string | null }>`, and `total: string | null`.
- `OrderEmailService.send(order: OrderEmailMessage): Promise<void>` throws a sanitized service-unavailable error unless Resend accepts the email.

- [x] **Step 1: Write failing DTO/service/controller/E2E tests** for required trimmed name, phone, and address; locale allowlist; 1–30 products; integer quantity 1–20; UUID item IDs; expected price format; unknown/unpublished/out-of-stock item rejection; server-derived names/prices; stale expected-price rejection; fixed recipient; email failure; one valid HTTP 201 request; 400 validation response; and 429 after repeated requests. E2E requests override `OrderEmailService` and `PrismaService` with local fakes only.
- [x] **Step 2: Run API tests and verify expected failures** with `pnpm --filter @athlon/api exec jest --runInBand src/orders/order-email.service.spec.ts src/orders/orders.service.spec.ts`, then `pnpm --filter @athlon/api exec jest --config test/jest-e2e.json --runInBand test/orders.e2e-spec.ts`.
- [x] **Step 3: Add minimal DTO/controller/service/module implementation.** Register `POST /public/orders` (external route `/api/v1/public/orders`); apply both `@UseGuards(ThrottlerGuard)` and `@Throttle({ default: { limit: 5, ttl: 60_000 } })`; query only published products and locale translations; compare expected prices only for stale-cart detection; build totals exclusively from database prices; reject any `OUT_OF_STOCK` product.
- [x] **Step 4: Add the Resend adapter using Node's built-in `fetch`.** Send to the hard-coded recipient `athlonsportgoods@gmail.com`, use `ORDER_FROM_EMAIL` as the verified sender, include server-generated reference, customer details, product lines/counts/current prices/total/payment note, emit both plain-text and escaped HTML, bound request timeout, and map provider failures to a sanitized 503 without response-body/key leakage. Configure `RESEND_API_KEY` and `ORDER_FROM_EMAIL` in environment schema/example; never make the recipient request-configurable.
- [x] **Step 5: Run the focused tests and verify they pass**; add provider tests with mocked fetch for success, non-2xx, timeout, and hostile customer text. Confirm none contacts the live email service.
- [x] **Step 6: Run API build, lint, and full unit suite** using `pnpm --filter @athlon/api build`, `pnpm --filter @athlon/api lint`, and `pnpm --filter @athlon/api test`.

### Task 2: Add localized checkout form and submit behavior

**Files:**

- Modify: `apps/web/src/app/core/api/catalog-api.service.ts`
- Modify: `apps/web/src/app/core/i18n/i18n.service.ts`
- Modify: `apps/web/src/app/features/basket/basket-page.ts`
- Modify: `apps/web/src/app/features/basket/basket-page.html`
- Modify: `apps/web/src/app/features/basket/basket-page.scss`
- Modify: `apps/web/src/app/features/basket/basket-page.spec.ts`

**Interfaces:**

- Add `CatalogApiService.submitOrder(input): Observable<{ accepted: true; orderReference: string }>` targeting `POST /public/orders`.
- Basket page owns customer form values, `submitting`, success toast, and error state; it creates request items from basket IDs/quantities and passes saved basket unit prices only as `expectedUnitPrice`.

- [x] **Step 1: Add failing component/service tests** for form labels and required fields, all three payment notes and confirmation strings, sending IDs/quantities/expected prices/locale/customer fields, success showing localized toast and clearing basket, and error preserving basket/form while showing retryable error.
- [x] **Step 2: Run the web test suite** with `pnpm --filter @athlon/web test` and observe the new feature-related failures.
- [x] **Step 3: Add the API client method and localize checkout copy.** Add strings for name, phone, address, payment-on-delivery, submit, sending, success, validation, and retryable failure in Armenian/Russian/English; replace Instagram copy/open CTA in basket with place-order flow.
- [x] **Step 4: Implement submit state and user feedback.** Prevent duplicate submissions; do not clear the basket until the API returns accepted; on network/validation/provider failure preserve values and basket; on success clear and show exactly `Ձեր պատվերը գրանցված է` for Armenian with translated RU/EN equivalents.
- [x] **Step 5: Style responsive checkout and toast.** Keep basket review and total visible, stack form fields comfortably on mobile, show payment note before final submit, and ensure success/error feedback is accessible (`role="status"` / `role="alert"`).
- [x] **Step 6: Run focused tests, web lint, and web production build** using `pnpm --filter @athlon/web test`, `pnpm --filter @athlon/web lint`, and `pnpm --filter @athlon/web build`.

### Task 3: Verify the public order boundary and document email setup

**Files:**

- Modify: `README.md`
- `infrastructure/production.env.example` is updated in Task 1 with secret-variable names only.

**Interfaces:**

- Production runtime expects `RESEND_API_KEY` and `ORDER_FROM_EMAIL`; recipient is fixed in API code to `athlonsportgoods@gmail.com`.

- [x] **Step 1: Document operator setup in README**: create/configure a Resend account, verify a sender address/domain, privately set `RESEND_API_KEY` and `ORDER_FROM_EMAIL` on the production server, keep the recipient fixed to `athlonsportgoods@gmail.com`, and restart/deploy the API. Never add secret values to examples or chat.
- [x] **Step 2: Review delivery semantics and privacy**: success means Resend accepted the notification, not guaranteed inbox placement; confirm no customer PII appears in API logs and the API errors contain neither provider response bodies nor secrets.
- [x] **Step 3: Run full `pnpm verify`** and report any external provider/DNS setup that remains before real production orders can be accepted.
- [ ] **Step 4: After code is reviewed and production credentials are installed privately, request explicit confirmation before sending a real inbox smoke-test order.**

## Self-review coverage check

- Spec customer flow, payment terms, success/failure behavior, API trust boundary, localization, rate limiting, and provider setup are covered by Tasks 1–3.
- No local order storage or finance sale is added, matching the approved v1 spec.
- Expected prices are only a stale-basket comparison; current database snapshots remain authoritative in email content.
- External provider credentials and sender-domain verification remain private operator setup, not code or chat work.
