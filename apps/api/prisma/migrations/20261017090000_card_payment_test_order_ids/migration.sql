-- CreateTable
CREATE TABLE "CardPaymentTestOrderId" (
    "orderId" INTEGER NOT NULL,
    "reference" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardPaymentTestOrderId_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardPaymentTestOrderId_reference_key" ON "CardPaymentTestOrderId"("reference");
