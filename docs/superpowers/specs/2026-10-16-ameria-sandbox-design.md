# Ameriabank sandbox checkout

## Requested outcome

The operator can test one-step Ameriabank payments from the existing production route `/card-payment-test/hy`, with equivalent Russian and English routes. This extends the approved mock checkout; it does not enable ordinary customer card payments or create real orders, inventory movements, finance entries, or order notifications.

## Authoritative contract

Source: user-supplied `vPOS_Eng_3.1.pdf`, pages 3–8 and 35–40, and the bank email supplied by the user. The bank assigned OrderIDs 30543001–30544000 and requires amount AMD 10. One-step payments are authorized; two-step operations are not.

- POST `https://servicestest.ameriabank.am/VPOS/api/VPOS/InitPayment` with server credentials (`ClientID`, `Username`, `Password`), integer `OrderID`, `Amount: 10`, `Currency: "051"`, `Description`, fixed server-generated `BackURL`, `Opaque`, and bounded `Timeout` (maximum 1200 seconds).
- Initialization succeeds only with numeric `ResponseCode: 1` and a valid `PaymentID`.
- Hosted checkout is exactly `https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=<PaymentID>&lang=<am|ru|en>`. Map application `hy` to bank `am`.
- The browser return parameters are untrusted, including the guide's misspelled `resposneCode`. Return to the fixed `https://athlon.am/card-payment-test/<locale>?session=<reference>` and query the bank using the persisted payment ID.
- POST `GetPaymentDetails` under the same sandbox API directory with `PaymentID`, `Username`, and `Password`. Verify the persisted OrderID, amount 10, currency 051, opaque reference, and successful response code `00` before accepting deposited status `2` / `payment_deposited` as success.
- Status `1` is preauthorization, not paid. Status `0` and ACS status `5` are pending, `6` is declined, `3` is void, and `4` is refunded. Unknown or inconsistent data must never report success.
- Do not call ConfirmPayment, RefundPayment, CancelPayment, or binding operations.

## Design decisions

Separate `MOCK` (default) and `AMERIA_SANDBOX` test modes. Retain the existing feature flag and ordinary payment readiness guard. Use fixed allowlisted sandbox endpoints and sanitized bounded HTTP requests; never store or expose PAN, CVV, bank credentials, or raw bank response data.

Protect bank initialization and status retrieval with existing guest ownership, origin/CSRF protection, throttling, and a separate high-entropy operator access code. Submit this code only in a same-origin POST and grant a short-lived capability to the existing HttpOnly guest session. Do not put it in URLs, persistent browser storage, responses, or logs. This extra code is an implementation decision to protect the finite bank range while keeping the approved guest-accessible route.

Persist sandbox attempts separately. Allocate bank OrderIDs with an atomic durable bounded PostgreSQL sequence that never cycles. Reserve once before contacting the bank; never recycle after ambiguous errors. Scope client idempotency to owner and request contents and prevent concurrent duplicate initialization. Enforce range exhaustion. Do not let the mock outcome endpoint change sandbox state.

The UI retains the product basket, clearly distinguishes its catalog value from the fixed AMD 10 bank charge, collects no card data, redirects only to the trusted hosted page, and shows a result only after server verification. Pending/errors support bounded rechecking; no browser return code can claim success.

## Configuration and delivery

New keys: `CARD_PAYMENT_TEST_MODE`, `AMERIA_SANDBOX_CLIENT_ID`, `AMERIA_SANDBOX_USERNAME`, `AMERIA_SANDBOX_PASSWORD`, `CARD_PAYMENT_TEST_ACCESS_TOKEN`, and `AMERIA_SANDBOX_RETURN_ORIGIN`. Keep all credentials private in the production environment. No credentials or card values were supplied in chat or this file.

Code delivery includes regression tests, mock-backed local browser QA, security/performance reviews, and production-shaped verification. Actual bank testing requires securely provisioned sandbox credentials and a user-entered test card on Ameriabank. Do not claim a real sandbox payment passed before bank-backed evidence exists.
