# Ameriabank Card Payments Design

**Status:** Draft for user review. No Ameriabank merchant agreement, test credentials, or merchant integration manual has been provided. Payment initiation must remain disabled until those prerequisites are supplied and verified.

## Goal and constraints

Add an Ameriabank card-payment choice to ATHLON’s storefront while retaining pay-on-delivery by cash or card. The flow must be localized in Armenian, Russian, and English, use server-side product prices and availability, persist order/payment state, and never collect or store card numbers or CVV in ATHLON. Do not run a live transaction, deploy, or merge without explicit approval.

## Current repository state

- The selected working branch is `codex/card-payments`, currently based on `origin/main`.
- `origin/main` does not yet contain the email-checkout commit `d855903` from `codex/storefront-qa-fixes`; that approved cash-on-delivery flow is a dependency and must be brought onto this feature branch before extending checkout.
- The email-checkout implementation validates products and prices from the API, emails ATHLON, and has no persistent order or payment models. The checkout currently collects name, phone, and delivery address, but not customer email.
- The Prisma product model stores currency as AMD by default. The finance schema has sale/inventory models, but the public order flow is not currently connected to them.
- Production uses Docker Compose behind Caddy and expects secrets through the protected environment file.

## Provider evidence and integration boundary

The publicly accessible Ameriabank vPOS test documentation describes a credentialed `InitPayment` request with amount, merchant order ID, and `BackURL`; it returns a payment ID. Its credentialed `GetPaymentDetails` status API returns amount, currency, order/payment status, and related transaction fields. The public API page does not, by itself, establish the exact hosted-payment URL construction, confirmation/capture sequence, signed-webhook contract, or merchant-specific currency configuration.

The implementation must follow the technical manual issued for ATHLON’s merchant account. Until that is available, these items remain unconfirmed and must not be guessed:

1. Sandbox and production API hostnames and merchant IDs/credentials.
2. Exact bank-hosted payment-page redirect URL and language parameter rules.
3. Whether payment authorization requires a separate `ConfirmPayment` call, and when it is safe to call it.
4. Whether Ameria sends a server-to-server notification/webhook, its authentication/signature mechanism, and retry behavior.
5. Authoritative success/failure/pending status codes and timeout/expiry behavior.
6. AMD activation, transaction limits, and the bank-approved site/domain/return URLs.

References (official sources, checked 2026-10-06):

- [Ameriabank vPOS `InitPayment` test API](https://servicestest.ameriabank.am/VPOS/Help/Api/POST-api-VPOS-InitPayment)
- [Ameriabank vPOS `GetPaymentDetails` test API](https://servicestest.ameriabank.am/VPOS/Help/Api/POST-api-VPOS-GetPaymentDetails)
- [Ameriabank vPOS API index](https://servicestest.ameriabank.am/VPOS/Help)
- [Ameriabank Internet Acquiring Terms and Conditions](https://ameriabank.am/Portals/0/files/Business/pos/green/Internet_Acquiring_Terms_and_Conditions_ed9_eng.pdf)

## Recommended customer flow

1. Customer reviews their basket and chooses either “Pay by card” or “Pay on delivery (cash or card)”.
2. The API loads current published product data, validates stock/orderability and expected prices, computes the AMD total, and stores an immutable order snapshot before starting payment.
3. For card payment, the API uses private server-side Ameria credentials to initialize the transaction. Only after the official merchant manual confirms the provider’s hosted-page URL format does it return the allowlisted Ameria redirect URL to the web client. ATHLON never handles card-entry fields.
4. The browser returning to ATHLON shows a pending/processing state. It does not prove payment. The API confirms the result through Ameria’s documented authenticated server-to-server status mechanism. A webhook is used only if Ameria’s merchant documentation defines and authenticates one; otherwise use the officially supported status-query/reconciliation flow.
5. Persist the verified transition idempotently. Send localized customer and ATHLON confirmations once after the relevant order state is confirmed. A failed, cancelled, expired, or interrupted attempt leaves the basket/customer form available for retry.
6. Pay-on-delivery remains available and uses the existing ATHLON order-email path, now backed by persisted order records.

## Data and state

Add durable `Order` and `OrderItem` snapshots and provider-specific `PaymentAttempt` records. Persist only operationally necessary references/status/amount/currency/timestamps and safe card metadata if explicitly needed (never PAN/CVV; default to not persisting card details). Enforce unique idempotency keys for client order submissions, provider payment IDs, and provider notifications where available. Validate that the bank-reported amount, currency, payment ID, and merchant order reference match the stored order before marking it paid.

Use explicit order/payment states for pending, paid, failed, cancelled, and refunded/partially refunded where the chosen Ameria contract requires them. Make transitions monotonic/idempotent and retain a minimal audit trail without logging customer PII or secrets. Do not decrement stock or create finance sales as a side effect unless the existing finance integration/business rules are explicitly approved; this feature should not silently alter inventory or accounting.

Customer confirmation email requires a customer email address, which the current form does not collect. Proposed behavior is to add a required, validated email field and include it only in the persisted order and confirmation delivery. This will be confirmed with the user before implementation.

## Security and operational behavior

- Put Ameria credentials only in private environment/secrets configuration; keep the payment feature disabled by default until credentials and the provider’s supported redirect/status flow are configured.
- Never put credentials in browser code, responses, logs, example secrets, or test fixtures that resemble real credentials.
- Treat the return URL as display/navigation only. Only a server-verified bank status can mark a card payment paid.
- Allowlist provider redirect hosts; do not accept arbitrary return/redirect URLs from the browser.
- Rate-limit payment creation and prevent duplicate attempts for an existing active order.
- Do not initiate real payment requests in automated tests or before explicit user approval.

## Delivery plan

1. Bring the already-approved email-checkout commit `d855903` onto `codex/card-payments` so the current COD path exists in the branch.
2. Review the Ameria merchant manual when available; finalize only the redirect, confirmation/capture, callback, and status mappings it documents.
3. Add Prisma order/payment persistence and migration with repository/service tests.
4. Add a disabled-by-default Ameria server adapter and checkout API, using only the verified merchant flow; test with mocked provider calls and webhook/status fixtures.
5. Add localized card/COD selection, customer email field, pending/success/failure/cancelled states, and idempotent localized order/receipt notifications.
6. Update environment examples, production Compose wiring, and README onboarding/callback instructions; keep production payments disabled.
7. Run `pnpm verify`, perform an independent security review, push a separate feature branch, and open a PR. No merge, deployment, production-key activation, or real transaction without explicit approval.

## Approval gates and blockers

- The user selected Ameriabank but has no bank assignment/agreement yet. The technical adapter can be prepared with mocks and fail-closed configuration, but a real sandbox flow cannot be fully implemented or end-to-end verified until Ameria supplies a merchant account, test credentials, and the official merchant manual.
- User review is required for this design before an implementation plan is written. In particular, confirm the hosted-page flow, required customer email field, and whether paid orders should later enter the finance sales/inventory workflow.
