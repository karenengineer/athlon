-- Sequence values survive rollback, crashes and ambiguous bank responses. Never cycle.
CREATE SEQUENCE "card_payment_sandbox_order_id_seq" AS INTEGER MINVALUE 30543001 MAXVALUE 30544000 START WITH 30543001 NO CYCLE;
CREATE TABLE "CardPaymentSandboxSession" (
  "reference" UUID NOT NULL,
  "ownerHash" CHAR(64) NOT NULL,
  "idempotencyKey" UUID NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,
  "ameriaOrderId" INTEGER NOT NULL DEFAULT nextval('card_payment_sandbox_order_id_seq'::regclass),
  "locale" "Locale" NOT NULL,
  "basketTotal" DECIMAL(14,2) NOT NULL,
  "items" JSONB NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "initialization" VARCHAR(20) NOT NULL DEFAULT 'INITIALIZING',
  "providerPaymentId" VARCHAR(100),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CardPaymentSandboxSession_pkey" PRIMARY KEY ("reference"),
  CONSTRAINT "CardPaymentSandboxSession_order_range" CHECK ("ameriaOrderId" BETWEEN 30543001 AND 30544000),
  CONSTRAINT "CardPaymentSandboxSession_status" CHECK ("status" IN ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED')),
  CONSTRAINT "CardPaymentSandboxSession_initialization" CHECK ("initialization" IN ('INITIALIZING', 'READY', 'UNKNOWN'))
);
CREATE UNIQUE INDEX "CardPaymentSandboxSession_ameriaOrderId_key" ON "CardPaymentSandboxSession"("ameriaOrderId");
CREATE UNIQUE INDEX "CardPaymentSandboxSession_providerPaymentId_key" ON "CardPaymentSandboxSession"("providerPaymentId");
CREATE UNIQUE INDEX "CardPaymentSandboxSession_ownerHash_idempotencyKey_key" ON "CardPaymentSandboxSession"("ownerHash", "idempotencyKey");
