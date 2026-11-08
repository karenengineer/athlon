ALTER TABLE "CardPaymentSandboxSession"
  ADD COLUMN "refundAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "refundAcknowledgedAt" TIMESTAMP(3),
  ADD COLUMN "refundedAt" TIMESTAMP(3);
