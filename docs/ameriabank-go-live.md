# Ameriabank vPOS go-live runbook

Live card payments ship **off**. This runbook is the only path to turning them
on. Nothing here is done by CI or by a deploy: each step is a deliberate owner
action. Never paste bank credentials into chat, issues, commits or logs; they go
only into `/opt/athlon/.env` on the server.

## How the integration works

1. The shopper chooses card in the basket. The API creates the order
   (`PAYMENT_PENDING`) and a payment attempt with an integer vPOS `OrderID` from
   the `ameria_live_order_id_seq` database sequence (starts at 410000001).
2. The API calls `InitPayment` with the exact basket total in whole AMD,
   currency `051`, `Timeout` 1200 s, `Opaque` = order reference and
   `BackURL` = `{AMERIA_RETURN_ORIGIN}/{hy|ru|en}/payment/{reference}`.
3. The shopper pays on the bank page (`{AMERIA_CHECKOUT_BASE_URL}/Payments/Pay`).
4. The bank sends the shopper to `/{locale}/payment/{reference}`. The query
   string the bank adds is **ignored**. The page polls
   `GET /api/v1/public/orders/{reference}/payment-status`.
5. That endpoint calls `GetPaymentDetails` server-side. The order becomes
   `PAID` only when the response matches this order exactly — `ResponseCode`
   `00`, same `OrderID`, `Opaque`, currency `051`, `Amount` and full
   `DepositedAmount` — with `OrderStatus` 2 / `payment_deposited`.
   Declined (6) → `PAYMENT_FAILED`; void (3) or refunded (4) → `CANCELLED`;
   still started 30 min after creation → `EXPIRED`. Pre-auth states (1, 5) stay
   pending for manual review because ATHLON uses single-stage payments.
6. On the one transition to `PAID`, the shop email, customer email and Telegram
   are sent, marked "paid by card".
7. Every 5 minutes the API also re-checks card orders still pending (up to 72 h
   old), so a shopper closing the tab does not leave a paid order unrecorded.

## 1. Ask the bank for

- Live vPOS root URL(s) for the API and the hosted payment page.
- Live `ClientID`, API username and password (delivered privately, not by chat).
- Confirmation that single-stage payment (no pre-authorization) is enabled.
- Registration of both origins: `https://athlon.am` and `https://www.athlon.am`,
  and the return path pattern `/{hy|ru|en}/payment/{reference}`.
- The live OrderID range, if they assign one. If it does not include
  410000001+, change the sequence start in a new migration before go-live.
- Merchant back-office access for refunds, and Apple Pay / Google Pay steps
  (Apple Pay usually needs a domain-verification file served from
  `/.well-known/`; add it as a separate change when the bank sends it).

## 2. Configure (server only)

Add to `/opt/athlon/.env`, keeping `AMERIA_PAYMENTS_ENABLED=false` for now:

```
AMERIA_API_BASE_URL=<live vPOS root from the bank>
AMERIA_CHECKOUT_BASE_URL=<live vPOS root from the bank>
AMERIA_MERCHANT_ID=<ClientID>
AMERIA_USERNAME=<API username>
AMERIA_PASSWORD=<API password>
AMERIA_RETURN_ORIGIN=https://athlon.am
```

Both URLs must be `https` without credentials; the API refuses to start
otherwise once payments are enabled.

## 3. Pilot (one real small payment and refund)

Pick a quiet time. Have a cheap in-stock product (or a temporary low-priced
test product) ready.

1. Set `AMERIA_PAYMENTS_ENABLED=true`, restart the API, confirm
   `GET /api/v1/public/settings` shows `cardPaymentsEnabled: true`.
2. Place one order with your own card. Check: the bank page shows the right
   amount in AMD; after paying you land on the ATHLON payment page and it says
   "Payment complete"; the order is `PAID` in admin; email and Telegram arrive
   once with "paid by card".
3. Cancel one order on the bank page and confirm the site says "Payment not
   completed" and the basket is still there.
4. Refund the paid order in the Ameriabank merchant back-office. Within
   5 minutes the order moves to `CANCELLED` (status 4, refunded).
5. If anything is off, set `AMERIA_PAYMENTS_ENABLED=false` and restart. Card
   checkout disappears immediately; cash on delivery is unaffected.

## 4. Go live

Once the pilot passes and the owner approves, leave `AMERIA_PAYMENTS_ENABLED=true`.

## Rollback

`AMERIA_PAYMENTS_ENABLED=false` + API restart. Existing card orders keep their
status; pending ones are no longer re-checked automatically while disabled, so
check them in the bank back-office.
