# Telegram Order Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional order messages to a separate Telegram chat alongside email, then deploy the verified change.

**Architecture:** Reuse durable order notification records with an additional merchant Telegram recipient. A bounded plain-text Telegram sender reads independent server settings. Telegram transport and tracking failures cannot change accepted checkout/email behavior.

**Tech Stack:** NestJS, TypeScript, Prisma/PostgreSQL, Jest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-23-telegram-order-notifications-design.md`

## Global Constraints

- User authorized implementation and deployment; never overwrite newer production changes.
- Preserve pre-existing dirty web files and the unrelated card-payment plan.
- Settings are `ORDER_TELEGRAM_BOT_TOKEN` and `ORDER_TELEGRAM_CHAT_ID`; never fall back to deployment settings.
- Both empty disables Telegram; partial configuration is invalid. Do not expose secrets or customer data in logs.
- Only newly accepted pay-on-delivery orders receive Telegram intents when configured. No historical broadcast; card payment behavior stays unchanged.
- Email behavior remains intact. Telegram failure cannot reject otherwise accepted checkout or block email delivery.
- Skip confirmed Telegram sends on replay; document ambiguous timeout duplicate risk and the existing request-driven retry limitation.
- No real provider calls in tests. Production credentials remain private.

## Review Focus

- Telegram tracking errors as well as network errors must not break checkout.
- Long Unicode orders must remain within Telegram's message limit with quantities and totals intact.
- Existing orders and unconfigured deployments must keep working without backfill.
- Independent optional settings must reach the production API without modifying email or deployment-alert settings.
- Release provenance must preserve the current production tree and database.

## Task 1: Backend notification and regression coverage

**Owner:** backend_engineer.
**Files:** `apps/api/src/orders/order-telegram.service{,.spec}.ts`, `orders.module.ts`, `orders.service{,.spec}.ts`, `order-persistence.service{,.spec}.ts`, `apps/api/src/config/environment.schema{,.spec}.ts`, `apps/api/prisma/schema.prisma`, one new additive migration, affected order end-to-end fixtures if needed.
**Interfaces:** `OrderTelegramService.isEnabled: boolean`; `send(order: OrderEmailMessage): Promise<void>`. Add `MERCHANT_TELEGRAM` notification recipient. New optional constructor dependencies may preserve existing direct-construction fixtures. Use server-derived settings to decide creation of the third intent, not browser input.

- [ ] Write focused tests for configured delivery, disabled/partial configuration, provider HTTP/API failure, timeout and bounded Unicode text; run and observe expected missing-behavior failures before implementation.
- [ ] Implement the sender with strict HTTPS, bounded timeout, no redirect to another host, plain text and sanitized exceptions. Validate both settings together.
- [ ] Write failing integration/persistence tests for new-order intent creation, no historical intent, sequential replay skipping SENT and failed tracking/send isolation from emails/checkout.
- [ ] Implement the additive Prisma enum migration and independent Telegram dispatch. Persist failed intents for request-driven retry; preserve existing email failure semantics.
- [ ] Run targeted Jest tests, API tests/e2e, Prisma validation/generation, API typecheck/build and lint. Report exact results and migration consequences.

## Task 2: Runtime wiring, setup and release

**Owner:** release_operations for config/docs; root for release after review.
**Files:** `.env.example`, `infrastructure/production.env.example`, `infrastructure/docker-compose.production.yml`, relevant local Compose wiring if needed, README and focused configuration fixture tests.
**Interfaces:** Pass the two exact optional variables to the API only, with empty defaults. No deploy-alert fallback. Backend validates partial configuration.

- [ ] Add a focused failing wiring assertion where existing operations fixtures support it, then add optional settings and private setup instructions.
- [ ] Inspect existing deployment mechanism, current production revision and configuration-presence metadata only. Report a safe release path and whether the separate chat is ready; do not deploy before root approval following review.
- [ ] Run operations fixtures and Compose/static validation using dummy settings.
- [ ] Root creates a current-run diff and QA manifest. Independent security/correctness, performance and focused manual QA reviewers examine the change; resolve material findings.
- [ ] Root verifies the final release tree against latest main/production, runs appropriate checks, commits only current-run changes, releases using the authorized existing deployment path, and verifies smoke/revision/migration evidence.
- [ ] If runtime settings are absent, report deployed-but-disabled honestly and provide private setup steps. Never claim a real Telegram receipt without evidence.
