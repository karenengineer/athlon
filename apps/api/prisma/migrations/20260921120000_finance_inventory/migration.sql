CREATE TYPE "SaleSourceType" AS ENUM ('MANUAL', 'WEBSITE_ORDER');
CREATE TYPE "SalesChannel" AS ENUM ('WEBSITE', 'INSTAGRAM', 'GYM', 'TRAINER', 'DIRECT', 'MARKETPLACE', 'OTHER');
CREATE TYPE "ExpenseSource" AS ENUM ('ONE_TIME', 'RECURRING_OCCURRENCE');
CREATE TYPE "Recurrence" AS ENUM ('MONTHLY');

ALTER TABLE "Product" ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 2;

CREATE TABLE "Supplier" (
  "id" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "contactName" VARCHAR(180),
  "phone" VARCHAR(50),
  "email" VARCHAR(320),
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Purchase" (
  "id" UUID NOT NULL,
  "purchaseNumber" VARCHAR(80) NOT NULL,
  "date" DATE NOT NULL,
  "supplierId" UUID NOT NULL,
  "notes" TEXT,
  "createdByAdminId" UUID NOT NULL,
  "importKey" VARCHAR(180),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseItem" (
  "id" UUID NOT NULL,
  "purchaseId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "purchaseUnitPrice" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseItem_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "PurchaseItem_purchaseUnitPrice_check" CHECK ("purchaseUnitPrice" >= 0)
);

CREATE TABLE "Sale" (
  "id" UUID NOT NULL,
  "saleNumber" VARCHAR(80) NOT NULL,
  "date" DATE NOT NULL,
  "orderId" VARCHAR(100),
  "sourceType" "SaleSourceType" NOT NULL DEFAULT 'MANUAL',
  "sourceId" VARCHAR(180),
  "channel" "SalesChannel" NOT NULL,
  "trainerReferralCode" VARCHAR(100),
  "customerName" VARCHAR(180),
  "customerPhone" VARCHAR(50),
  "notes" TEXT,
  "createdByAdminId" UUID NOT NULL,
  "importKey" VARCHAR(180),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleItem" (
  "id" UUID NOT NULL,
  "saleId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "actualUnitPrice" DECIMAL(14,2) NOT NULL,
  "lineDiscount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "costUnitSnapshot" DECIMAL(18,6) NOT NULL,
  CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaleItem_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "SaleItem_actualUnitPrice_check" CHECK ("actualUnitPrice" >= 0),
  CONSTRAINT "SaleItem_lineDiscount_check" CHECK ("lineDiscount" >= 0)
);

CREATE TABLE "ExpenseCategory" (
  "id" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Expense" (
  "id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "categoryId" UUID NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "paymentMethod" VARCHAR(100),
  "notes" TEXT,
  "source" "ExpenseSource" NOT NULL DEFAULT 'ONE_TIME',
  "createdByAdminId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringExpense" (
  "id" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "categoryId" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "recurrence" "Recurrence" NOT NULL DEFAULT 'MONTHLY',
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "paymentMethod" VARCHAR(100),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecurringExpenseOccurrence" (
  "id" UUID NOT NULL,
  "recurringExpenseId" UUID NOT NULL,
  "periodYear" INTEGER NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "expenseId" UUID NOT NULL,
  "nameSnapshot" VARCHAR(180) NOT NULL,
  "categoryNameSnapshot" VARCHAR(180) NOT NULL,
  "amountSnapshot" DECIMAL(14,2) NOT NULL,
  "paymentMethodSnapshot" VARCHAR(100),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecurringExpenseOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_name_normalized_key" ON "Supplier" (LOWER(BTRIM("name")));
CREATE UNIQUE INDEX "Purchase_purchaseNumber_key" ON "Purchase"("purchaseNumber");
CREATE UNIQUE INDEX "Purchase_importKey_key" ON "Purchase"("importKey");
CREATE INDEX "Purchase_date_idx" ON "Purchase"("date");
CREATE INDEX "Purchase_supplierId_date_idx" ON "Purchase"("supplierId", "date");
CREATE INDEX "Purchase_createdByAdminId_idx" ON "Purchase"("createdByAdminId");
CREATE UNIQUE INDEX "PurchaseItem_purchaseId_productId_key" ON "PurchaseItem"("purchaseId", "productId");
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");
CREATE UNIQUE INDEX "Sale_saleNumber_key" ON "Sale"("saleNumber");
CREATE UNIQUE INDEX "Sale_importKey_key" ON "Sale"("importKey");
CREATE UNIQUE INDEX "Sale_sourceType_sourceId_key" ON "Sale"("sourceType", "sourceId");
CREATE INDEX "Sale_date_idx" ON "Sale"("date");
CREATE INDEX "Sale_channel_date_idx" ON "Sale"("channel", "date");
CREATE INDEX "Sale_createdByAdminId_idx" ON "Sale"("createdByAdminId");
CREATE UNIQUE INDEX "SaleItem_saleId_productId_key" ON "SaleItem"("saleId", "productId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
CREATE INDEX "Expense_categoryId_date_idx" ON "Expense"("categoryId", "date");
CREATE INDEX "Expense_createdByAdminId_idx" ON "Expense"("createdByAdminId");
CREATE INDEX "RecurringExpense_categoryId_idx" ON "RecurringExpense"("categoryId");
CREATE INDEX "RecurringExpense_active_startDate_idx" ON "RecurringExpense"("active", "startDate");
CREATE UNIQUE INDEX "RecurringExpenseOccurrence_expenseId_key" ON "RecurringExpenseOccurrence"("expenseId");
CREATE UNIQUE INDEX "RecurringExpenseOccurrence_recurringExpenseId_periodYear_periodMonth_key" ON "RecurringExpenseOccurrence"("recurringExpenseId", "periodYear", "periodMonth");

ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringExpenseOccurrence" ADD CONSTRAINT "RecurringExpenseOccurrence_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringExpenseOccurrence" ADD CONSTRAINT "RecurringExpenseOccurrence_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
