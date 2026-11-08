ALTER TABLE "CardPaymentSandboxSession"
  ADD COLUMN "cancellationAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "cancellationAcknowledgedAt" TIMESTAMP(3);
