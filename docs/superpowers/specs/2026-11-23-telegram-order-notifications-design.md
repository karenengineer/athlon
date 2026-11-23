# Telegram order notifications

Status: approved by the user on 2026-11-23; implementation and deployment authorized.

## Intent

Send new ATHLON orders to a different Telegram chat from deployment alerts,
alongside the existing merchant and customer emails. The user explicitly
selected a different chat. Messages include the order reference, customer
name, phone, delivery address, products, quantities, and total.

## Approaches

- Recommended: extend the existing persisted notification mechanism with a
  separate merchant Telegram delivery record. This tracks success and failure
  independently from email and skips successfully sent records on replay.
- A direct untracked Telegram call would be smaller but loses delivery state.
- Email forwarding adds an external service and dependency; the application
  already has the order details needed to send directly.

## Proposed behavior

Keep checkout email behavior intact. For accepted pay-on-delivery orders,
attempt an additional Telegram notification with a bounded timeout. Telegram
failure must not reject an otherwise accepted checkout or prevent emails.
Persist failures for retry when the same order request is repeated, using
the existing retry pattern; no background worker is added. Successful
Telegram records are skipped on sequential replay. Telegram provides no
send-message idempotency key, so delivery after an ambiguous network timeout
cannot be guaranteed exactly once.

Use optional server-only `ORDER_TELEGRAM_BOT_TOKEN` and
`ORDER_TELEGRAM_CHAT_ID` settings, with no fallback to deployment credentials.
Support a private chat or a group through its numeric chat ID. Configure both
settings privately; no secret values belong in chat or source control.
Without configuration, checkout continues using email. Configuration applies
to new orders; historical orders are not broadcast.

Use plain text in the order's existing locale and keep the message within
Telegram's length limit while preserving quantities and financial amounts.
The browser cannot choose the Telegram recipient. Provider errors must not
expose credentials or customer details in logs.

## Scope and verification

Changes cover the orders service/module, Telegram sender, persisted
notification recipient enum/migration, environment validation and examples,
Compose environment wiring, documentation, and focused regression tests.
Tests mock Telegram and email; no real customer order is sent. Verify
independent delivery state, missing configuration, provider rejection,
timeouts, long/multilingual messages, replay, and unchanged email behavior.
Card-payment behavior is outside this change and remains unchanged.

The user explicitly authorized implementation and deployment on 2026-11-23.
The separate chat must still be configured privately before real delivery can
be verified. Do not infer its destination from the deployment-alert settings.
