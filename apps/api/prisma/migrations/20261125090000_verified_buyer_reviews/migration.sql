-- AlterTable
ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProductReview" ADD COLUMN "orderId" UUID;

-- CreateTable
CREATE TABLE "ReviewInvitation" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_deliveredAt_idx" ON "Order"("deliveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewInvitation_orderId_key" ON "ReviewInvitation"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewInvitation_tokenHash_key" ON "ReviewInvitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReview_orderId_productId_key" ON "ProductReview"("orderId", "productId");

-- AddForeignKey
ALTER TABLE "ReviewInvitation" ADD CONSTRAINT "ReviewInvitation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
