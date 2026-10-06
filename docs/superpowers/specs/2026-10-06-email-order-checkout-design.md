# ATHLON no-payment email checkout design

## Goal and scope

Let a customer submit the contents of the existing basket as an order request
without creating an account or paying online. The customer provides a name,
phone number, and delivery address. ATHLON receives a readable order email at
`athlonsportgoods@gmail.com`. Show the localized success toast
`Ձեր պատվերը գրանցված է` only after the server confirms that the order was
accepted for delivery. No card processor, customer account, delivery fee
calculation, or automatic inventory/sales mutation is included.

## Customer flow

1. The basket summary offers a localized “Place order” action instead of the
   Instagram-copy action.
2. A compact checkout form collects required name, phone, and delivery address.
   The basket remains visible so the customer can review products, quantities,
   and total before submitting.
3. A localized note says payment is due to the courier on delivery, by cash or
   card.
4. Submission disables the action while in flight. On success, show the exact
   Armenian confirmation requested and localized Russian/English equivalents;
   clear the basket only after success. On failure, preserve the form and basket
   and show a localized retryable error.

## Data flow and boundaries

The Angular basket page posts customer contact/delivery details, locale, and
product IDs/quantities to a public NestJS order endpoint. The API validates
limits and fields, reloads published products and current prices from the
database (never trusting browser-provided names/prices/totals), formats a
localized email with a generated order reference, and submits it through a
transactional email provider to the fixed ATHLON recipient. Return success only
when the provider accepts the notification. Do not send email from the browser
or expose provider credentials.

This first version treats provider acceptance as order registration; it does
not add a local order-history/admin workflow or mark a finance sale. Product
availability is rechecked at submit time, but no stock is reserved. If a
product is unavailable or a price has changed since it entered the basket,
reject submission with a clear message so the customer can review the basket.

Protect the endpoint with DTO validation, a small per-IP rate limit, bounded
basket size/quantities, and safe email formatting. Do not include payment card
data. Keep the recipient fixed server-side rather than accepting it from the
request.

## Email setup

Use a server-side transactional email provider adapter (recommended initial
provider: Resend). Read its API key and verified sender address only from
environment variables. Production requires a provider account, a sender
address on a verified domain, and the API key installed in the server's private
environment; these are operator setup steps and must not be committed or sent
in chat. If email is not configured or the provider rejects the request, return
an error and do not show the success toast or clear the basket.

## Localization

Add Armenian, Russian, and English strings for checkout labels, validation,
loading, retryable failure, success, and payment-on-delivery. Payment text:

- HY: `Վճարումը՝ պատվերը ստանալիս․ կանխիկ կամ քարտով։`
- RU: `Оплата при получении заказа — наличными или картой.`
- EN: `Pay the courier on delivery by cash or card.`

Keep the success wording explicitly localized, with the requested Armenian
string unchanged: `Ձեր պատվերը գրանցված է`.

## Verification

Test basket submission and state preservation on failure/success, localized
checkout and confirmation text in all three locales, API validation and price
recalculation, fixed recipient, provider acceptance/failure behavior, rate
limiting, and relevant API/web builds and test suites. Use a fake provider in
automated tests; never send test orders to the live ATHLON inbox.

## Deferred

Admin order management, automated conversion to a finance sale, stock
reservation, order status tracking, SMS/WhatsApp notifications, and online
payment remain out of scope.
