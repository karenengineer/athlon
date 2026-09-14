CREATE TYPE "Locale" AS ENUM ('HY', 'RU', 'EN');
CREATE TYPE "AvailabilityStatus" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'PREORDER', 'ON_REQUEST');
CREATE TYPE "AdminRole" AS ENUM ('ADMIN');

CREATE TABLE "Category" (
  "id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "slug" VARCHAR(160) NOT NULL,
  "parentId" UUID,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CategoryTranslation" (
  "id" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "description" TEXT,
  "seoTitle" VARCHAR(180),
  "seoDescription" VARCHAR(320),
  CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Brand" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(160) NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "logoKey" VARCHAR(500),
  "published" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrandTranslation" (
  "id" UUID NOT NULL,
  "brandId" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "description" TEXT,
  CONSTRAINT "BrandTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Product" (
  "id" UUID NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "categoryId" UUID NOT NULL,
  "brandId" UUID,
  "price" DECIMAL(12,2),
  "currency" CHAR(3) NOT NULL DEFAULT 'AMD',
  "availability" "AvailabilityStatus" NOT NULL DEFAULT 'ON_REQUEST',
  "characteristics" JSONB NOT NULL DEFAULT '{}',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "isNew" BOOLEAN NOT NULL DEFAULT false,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductTranslation" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "name" VARCHAR(220) NOT NULL,
  "shortDescription" VARCHAR(500),
  "description" TEXT,
  "seoTitle" VARCHAR(180),
  "seoDescription" VARCHAR(320),
  CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductImage" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "originalKey" VARCHAR(500) NOT NULL,
  "thumbnailKey" VARCHAR(500) NOT NULL,
  "cardKey" VARCHAR(500) NOT NULL,
  "detailKey" VARCHAR(500) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "primary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductImageTranslation" (
  "id" UUID NOT NULL,
  "productImageId" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "altText" VARCHAR(250) NOT NULL,
  CONSTRAINT "ProductImageTranslation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminUser" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshSession" (
  "id" UUID NOT NULL,
  "adminUserId" UUID NOT NULL,
  "tokenHash" VARCHAR(255) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteSetting" (
  "key" VARCHAR(100) NOT NULL,
  "value" TEXT,
  "public" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_parentId_published_displayOrder_idx" ON "Category"("parentId", "published", "displayOrder");
CREATE INDEX "CategoryTranslation_locale_name_idx" ON "CategoryTranslation"("locale", "name");
CREATE UNIQUE INDEX "CategoryTranslation_categoryId_locale_key" ON "CategoryTranslation"("categoryId", "locale");
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");
CREATE UNIQUE INDEX "BrandTranslation_brandId_locale_key" ON "BrandTranslation"("brandId", "locale");
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_published_categoryId_displayOrder_idx" ON "Product"("published", "categoryId", "displayOrder");
CREATE INDEX "Product_published_brandId_idx" ON "Product"("published", "brandId");
CREATE INDEX "Product_published_featured_displayOrder_idx" ON "Product"("published", "featured", "displayOrder");
CREATE INDEX "Product_published_isNew_displayOrder_idx" ON "Product"("published", "isNew", "displayOrder");
CREATE INDEX "Product_availability_idx" ON "Product"("availability");
CREATE INDEX "Product_price_idx" ON "Product"("price");
CREATE INDEX "ProductTranslation_locale_name_idx" ON "ProductTranslation"("locale", "name");
CREATE UNIQUE INDEX "ProductTranslation_productId_locale_key" ON "ProductTranslation"("productId", "locale");
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");
CREATE UNIQUE INDEX "ProductImageTranslation_productImageId_locale_key" ON "ProductImageTranslation"("productImageId", "locale");
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
CREATE INDEX "RefreshSession_adminUserId_expiresAt_idx" ON "RefreshSession"("adminUserId", "expiresAt");

ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrandTranslation" ADD CONSTRAINT "BrandTranslation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductTranslation" ADD CONSTRAINT "ProductTranslation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductImageTranslation" ADD CONSTRAINT "ProductImageTranslation_productImageId_fkey" FOREIGN KEY ("productImageId") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
