# ATHLON Finance & Inventory — Design Specification

**Date:** 2026-09-21  
**Status:** Approved design, pending implementation plan

## 1. Purpose

Add a protected Finance & Inventory module to the existing ATHLON administration panel. The module replaces the current spreadsheet workflow and must answer:

1. How many products are currently in stock?
2. How much money is tied up in inventory?
3. What are monthly revenue, COGS, gross profit, expenses, and net profit?
4. Which products generate the most revenue and profit?
5. Which products are low in stock and should be reordered?

The implementation extends the existing Angular, NestJS, PostgreSQL, Prisma monorepo. It must reuse the current admin shell, authentication, API conventions, UI patterns, validation, error handling, and tests. It must not create a parallel architecture or alter unrelated catalog behavior.

AMD is the default and only required currency for this phase.

## 2. Existing System Findings

- The backend is a NestJS modular monolith using Prisma and PostgreSQL.
- The frontend is Angular with a client-rendered protected admin area.
- Admin requests use existing access/refresh authentication, CSRF protection, `AdminAuthGuard`, and `CsrfGuard`.
- Existing admin resources provide reusable list, pagination, editor, dirty-form, delete confirmation, loading, empty, and error patterns.
- The current database has catalog products, categories, brands, translations, media, admin users, sessions, and site settings.
- There are no existing order, order-item, purchase, sale, supplier, expense, or finance models.
- There is no existing chart or spreadsheet export utility.

## 3. Architectural Approach

Use a transaction-ledger model inside a new backend `finance` domain. Purchases and sales are the source of truth. Do not maintain manually editable purchased, sold, or current-stock counters on products.

The alternatives were rejected:

- Product-level counters can drift out of sync with transaction history.
- Full event sourcing adds operational and conceptual complexity that is unnecessary at ATHLON's current scale.

The finance domain remains part of the existing API application and database. It does not become a separate service.

## 4. Inventory Costing

Use perpetual weighted-average costing.

When stock is purchased:

```text
newAverageCost =
  (existingInventoryValue + newPurchaseCost)
  / (existingQuantity + purchasedQuantity)
```

When stock is sold, the current weighted-average unit cost is copied to the sale item as its COGS unit-cost snapshot:

```text
netRevenue = quantity × actualUnitPrice - lineDiscount
COGS = quantity × costUnitSnapshot
grossProfit = netRevenue - COGS
grossMarginPercent = revenue == 0 ? 0 : grossProfit / netRevenue × 100
```

The catalog product price remains the default sale price. Actual financial reports always use transaction prices.

Historical purchases and sales are processed in deterministic chronological order using transaction date, creation timestamp, and stable identifier. Editing or deleting a historical purchase or sale recalculates all later inventory positions and sale cost snapshots for every affected product.

Negative stock is not allowed. Any create, update, delete, or historical recalculation that would make inventory negative is rejected atomically. The error includes the available quantity.

All money values use PostgreSQL `Decimal`/`Numeric` fields and Prisma decimal values. JavaScript floating-point arithmetic is not authoritative for finance calculations. AMD is displayed without fractional digits, while weighted average cost retains database precision.

## 5. Data Model

### 5.1 Product extension

Add to the existing `Product` model:

- `lowStockThreshold Int` with a safe default of `2`.
- Relations to purchase items and sale items.

Do not duplicate the existing SKU, translated name, category, brand, default sale price, or publication data.

### 5.2 Supplier

- `id`
- `name`
- `contactName` optional
- `phone` optional
- `email` optional
- `notes` optional
- `active`
- timestamps

Supplier name is unique using a normalized comparison rule appropriate for PostgreSQL.

### 5.3 Purchase and PurchaseItem

`Purchase`:

- `id`
- `purchaseNumber` unique, human-readable
- `date`
- `supplierId`
- `notes` optional
- `createdByAdminId`
- timestamps
- optional `importKey` unique for idempotent migration

`PurchaseItem`:

- `id`
- `purchaseId`
- `productId`
- `quantity` positive integer
- `purchaseUnitPrice Decimal`
- calculated total exposed as `quantity × purchaseUnitPrice`

A purchase supports multiple products from the same supplier. A product may appear once per purchase.

### 5.4 Sale and SaleItem

`Sale`:

- `id`
- `saleNumber` unique, human-readable
- `date`
- `orderId` optional
- `sourceType`: `MANUAL` or `WEBSITE_ORDER`
- `sourceId` optional, unique with source type
- `channel`: `WEBSITE`, `INSTAGRAM`, `GYM`, `TRAINER`, `DIRECT`, `MARKETPLACE`, `OTHER`
- `trainerReferralCode` optional
- `customerName` optional
- `customerPhone` optional
- `notes` optional
- `createdByAdminId`
- timestamps
- optional `importKey` unique for idempotent migration

`SaleItem`:

- `id`
- `saleId`
- `productId`
- `quantity` positive integer
- `actualUnitPrice Decimal`
- `lineDiscount Decimal`, default zero
- `costUnitSnapshot Decimal`
- derived net revenue, COGS, gross profit, and margin in services and reports

A sale supports multiple products. A product may appear once per sale. Discount is stored once as a line-level total and subtracted once from gross line revenue.

Future website orders will integrate through `sourceType` and `sourceId`. Completed or paid orders will create or synchronize a finance sale. Cancelled and failed orders will not contribute to finance reporting. No website order lifecycle exists yet, so that connector is not implemented in this phase; the data model and service boundary must permit it later without schema replacement.

### 5.5 Expenses

`ExpenseCategory`:

- `id`
- `name` unique
- `active`
- timestamps

Seed categories: Phone, Website / Hosting, Domain, Advertising, Delivery, Packaging, Rent, Accounting, Bank Fees, Marketplace Fees, Software, Salaries, Trainer Commission, Taxes, Other. Admins may add custom categories.

`Expense`:

- `id`
- `date`
- `categoryId`
- `description`
- `amount Decimal`
- `paymentMethod` optional
- `notes` optional
- `source`: `ONE_TIME` or `RECURRING_OCCURRENCE`
- `recurringOccurrenceId` optional and unique
- `createdByAdminId`
- timestamps

### 5.6 Recurring expenses

`RecurringExpense`:

- `id`
- `name`
- `categoryId`
- `amount Decimal`
- `recurrence`: `MONTHLY` for this phase
- `startDate`
- `endDate` optional
- `active`
- `paymentMethod` optional
- `notes` optional
- timestamps

`RecurringExpenseOccurrence`:

- `id`
- `recurringExpenseId`
- `periodYear`
- `periodMonth`
- `expenseId` unique
- snapshot name, category, amount, and payment method
- timestamps
- unique constraint on `(recurringExpenseId, periodYear, periodMonth)`

The reporting service idempotently materializes due occurrences before reading a period. Changes to a recurring template affect the current and future unmaterialized periods only. Materialized historical occurrences are immutable through template edits. They may be corrected through an explicit expense adjustment workflow rather than silently rewritten.

## 6. Transaction and Concurrency Rules

Purchase and sale create, update, and delete operations run at serializable isolation. The service locks or otherwise serializes affected product inventory calculations according to PostgreSQL and Prisma capabilities.

Each write follows this sequence:

1. Validate identifiers and input.
2. Load all affected products.
3. Rebuild the chronological inventory ledger for those products with the proposed mutation.
4. Reject negative inventory or invalid monetary results.
5. Save the mutation and resulting sale cost snapshots in the same transaction.
6. Return authoritative recalculated values.

Deleting a sale restores stock through ledger recalculation. Reducing or deleting a past purchase is rejected if later sales would exceed available stock.

## 7. Backend Modules and Services

Create one `FinanceModule` with focused components:

- `SuppliersService` and admin controller
- `PurchasesService` and admin controller
- `SalesService` and admin controller
- `ExpensesService` and admin controller
- `RecurringExpensesService` and admin controller
- `InventoryLedgerService` for stock and cost calculations
- `FinanceReportingService` for dashboard, summaries, profitability, and filtered datasets
- `FinanceExportService` for XLSX and CSV rendering

The ledger and reporting services are authoritative. Controllers, Angular pages, and exports do not independently implement financial formulas.

## 8. API Surface

All endpoints are under `/api/v1/admin/finance`, protected by existing admin auth and CSRF rules.

```text
GET    /dashboard
GET    /products

GET    /suppliers
POST   /suppliers
GET    /suppliers/:id
PATCH  /suppliers/:id
DELETE /suppliers/:id

GET    /purchases
POST   /purchases
GET    /purchases/:id
PATCH  /purchases/:id
DELETE /purchases/:id

GET    /sales
POST   /sales
GET    /sales/:id
PATCH  /sales/:id
DELETE /sales/:id

GET    /expenses
POST   /expenses
GET    /expenses/:id
PATCH  /expenses/:id
DELETE /expenses/:id

GET    /expense-categories
POST   /expense-categories
PATCH  /expense-categories/:id

GET    /recurring-expenses
POST   /recurring-expenses
GET    /recurring-expenses/:id
PATCH  /recurring-expenses/:id
DELETE /recurring-expenses/:id

GET    /monthly-summary
GET    /profitability
GET    /expense-breakdown

GET    /exports/products.csv
GET    /exports/purchases.csv
GET    /exports/sales.csv
GET    /exports/expenses.csv
GET    /exports/monthly-summary.csv
GET    /exports/profitability.csv
GET    /exports/accounting.xlsx
```

List and export endpoints accept consistent filters: date range, product, category, supplier, channel, referral, expense category, stock state, sort, and pagination where applicable. Export-current-view sends the same filter query without pagination. Full exports use an explicitly selected reporting date range.

Download responses include correct content type, content disposition, sanitized filename, and no-store cache headers.

## 9. Reporting Definitions

For a selected period:

```text
Revenue = sum(SaleItem net revenue)
COGS = sum(SaleItem quantity × costUnitSnapshot)
Gross Profit = Revenue - COGS
Operating Expenses = sum(one-time Expense amount)
Recurring Expenses = sum(materialized recurring Expense amount)
Total Expenses = Operating Expenses + Recurring Expenses
Net Profit = Gross Profit - Total Expenses
Gross Margin % = Revenue == 0 ? 0 : Gross Profit / Revenue × 100
Net Margin % = Revenue == 0 ? 0 : Net Profit / Revenue × 100
Units Sold = sum(SaleItem quantity)
Number of Orders = count(Sale)
Average Order Value = Number of Orders == 0 ? 0 : Revenue / Number of Orders
Inventory Value = sum(current quantity × current weighted-average cost)
```

Current stock status:

- Out of Stock: quantity `<= 0`
- Low Stock: quantity `> 0` and `<= lowStockThreshold`
- In Stock: quantity `> lowStockThreshold`

Dashboard comparisons use the immediately preceding period of equal calendar meaning, primarily current month versus previous month. When the comparison period is zero, return a safe `null` percentage and a display label rather than infinity.

Product profitability provides units sold, revenue, COGS, gross profit, gross margin, current stock, and inventory value. Supported sorting includes revenue, profit, margin, units sold, and lowest stock.

## 10. Excel and CSV Exports

Add ExcelJS because no equivalent dependency exists. Generate files on the backend so browser memory is not used for large datasets.

The accounting workbook contains:

1. Dashboard / Summary
2. Products
3. Purchases
4. Sales
5. Expenses
6. Monthly Summary

Monthly and yearly exports also include Sales by Product, Profit by Product, and Expenses by Category sections or sheets. Use readable headers, frozen header rows, column widths, totals, consistent dates, AMD number formats, and restrained ATHLON black/red/white header styling.

Suggested filenames:

- `athlon-finance-2026-09.xlsx`
- `athlon-finance-2026.xlsx`
- `athlon-accounting-2026.xlsx`

CSV is UTF-8 with a BOM for spreadsheet compatibility and formula-injection protection for untrusted text cells.

## 11. Admin UI

Extend the existing admin shell with:

```text
Finance & Inventory
├── Dashboard
├── Products
├── Purchases
├── Sales
├── Expenses
├── Monthly Summary
└── Export
```

Suppliers and recurring expense templates are managed from contextual actions in Purchases and Expenses, with direct routes retained for deep linking. This keeps the main navigation focused.

Reuse existing admin list, editor, filter, pagination, dirty-form, delete-confirmation, loading, empty, error, and success patterns. Add small reusable finance components only where existing components are not sufficient:

- date range preset filter
- AMD value display
- KPI card
- simple chart
- multi-line purchase/sale item editor
- export menu/button

The interface is desktop-first and responsive. Wide tables scroll horizontally on small screens. Forms remain usable on mobile. Profit uses restrained positive/negative visual treatment consistent with the existing admin palette.

Charts use lightweight CSS/SVG rendered from backend report data. A chart dependency is not introduced unless implementation reveals an existing reusable library.

Export actions show progress, prevent duplicate clicks, and surface errors through the existing admin feedback pattern.

## 12. Routes

Proposed Angular routes:

```text
/admin/finance
/admin/finance/products
/admin/finance/purchases
/admin/finance/purchases/new
/admin/finance/purchases/:id/edit
/admin/finance/sales
/admin/finance/sales/new
/admin/finance/sales/:id/edit
/admin/finance/expenses
/admin/finance/expenses/new
/admin/finance/expenses/:id/edit
/admin/finance/recurring-expenses
/admin/finance/monthly-summary
/admin/finance/export
/admin/finance/suppliers
```

Existing admin auth and dirty-form guards apply. Admin routes remain client-rendered and noindexed.

## 13. Initial Spreadsheet Migration

Create an idempotent import script separate from the normal seed.

The approved import uses the current spreadsheet data as an opening ledger:

- Match all current products by SKU.
- Create a supplier such as `Opening Inventory` unless the user supplies real suppliers before import.
- Create opening purchase transactions using spreadsheet purchase quantity and purchase unit price.
- Create historical manual sale transactions for already sold units using the spreadsheet's known actual sale prices.
- Preserve the existing catalog default sale price.
- Set import keys so rerunning the script cannot create duplicates.

After import, verify SKU-by-SKU:

- total purchased quantity
- total sold quantity
- current stock
- current inventory value
- realized gross profit

The migration does not delete or recreate products and does not modify unrelated records.

## 14. Security and Validation

- Every finance endpoint requires the existing admin authorization.
- Every state-changing endpoint requires existing CSRF protection.
- DTO validation rejects non-positive quantities, negative prices, excessive discounts, invalid dates, invalid ranges, and unknown enum values.
- Customer phone/name, notes, referral codes, supplier text, and exported cells are treated as untrusted data.
- Export filenames are server-controlled.
- Spreadsheet formula injection is neutralized in CSV and textual XLSX cells.
- Errors do not expose database or secret details.
- Audit ownership uses `createdByAdminId`; timestamps identify later edits. A full immutable audit log is outside this phase.

## 15. Testing Strategy

Backend unit and integration coverage includes:

- purchased 10, sold 3, stock 7
- buy 12,000 AMD, sell 15,000 AMD, profit 3,000 AMD
- weighted average of 10 × 12,000 and 5 × 13,000 equals 12,333.33
- monthly revenue 1,000,000, COGS 600,000, expenses 100,000, net profit 300,000
- actual sale price rather than default catalog price
- line discount counted exactly once
- multi-product sale and average order value
- editing a purchase recalculates later stock and COGS
- deleting a sale restores stock
- insufficient stock rejection
- concurrent sale protection
- recurring expense occurrence deduplication
- historical recurring expense immutability
- zero-safe percentages
- filter-aware CSV/XLSX contents
- cancelled/failed future website order statuses excluded by connector contract
- auth and CSRF enforcement

Frontend coverage includes routes, navigation, filters, table states, forms, validation messages, destructive confirmations, export progress/error behavior, and download handling.

Verification before deployment:

```text
pnpm format:check
pnpm prisma:validate
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm test:ssr
```

## 16. Deployment

Implementation occurs on a dedicated feature branch, not directly on `main`.

Deployment order:

1. Back up the production database.
2. Deploy compatible API and web images with the new migration.
3. Run Prisma migrations.
4. Run the idempotent opening-ledger import.
5. Verify ledger totals against the source spreadsheet.
6. Smoke-test protected finance routes and one export.
7. Monitor application and deployment logs.

Rollback uses the pre-deployment database backup and the previous application image. Product media and catalog data are not changed by this module.

## 17. Explicit Scope Boundaries

Included:

- manual and future-order-compatible sales
- purchases, inventory, weighted-average COGS
- expenses and monthly recurring expenses
- dashboard, monthly summary, profitability, expense breakdown
- XLSX and CSV downloads
- import of the current spreadsheet opening state

Not included in this phase:

- customer checkout, payment processing, or public cart
- complex affiliate payouts
- tax accounting automation
- multi-currency accounting
- multi-warehouse stock
- FIFO/LIFO selection
- immutable general ledger or double-entry bookkeeping
- automated supplier purchase orders
- scheduled email delivery of reports
