CREATE TABLE "ProductVideo" (
    "productId" UUID NOT NULL,
    "desktopKey" VARCHAR(500) NOT NULL,
    "mobileKey" VARCHAR(500) NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mobileSizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductVideo_pkey" PRIMARY KEY ("productId"),
    CONSTRAINT "ProductVideo_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductVideo_duration_check" CHECK ("durationSeconds" > 0 AND "durationSeconds" <= 15),
    CONSTRAINT "ProductVideo_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 20971520 AND "mobileSizeBytes" > 0 AND "mobileSizeBytes" <= 20971520)
);
