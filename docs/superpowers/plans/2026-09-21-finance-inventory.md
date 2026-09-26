# ATHLON Finance & Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a protected finance and inventory administration module with transaction-based stock, weighted-average COGS, expenses, reporting, XLSX/CSV exports, and an idempotent import of ATHLON's current spreadsheet state.

**Architecture:** Extend the existing NestJS modular monolith with one focused `FinanceModule` and extend the existing Angular admin shell with lazy finance routes. Purchases and sales are the source of truth; `InventoryLedgerService` owns all stock and cost calculations, while `FinanceReportingService` supplies the UI and exports so financial formulas cannot diverge.

**Tech Stack:** Angular 20 standalone components, NestJS 11, Prisma 7, PostgreSQL, class-validator, Jest, Angular TestBed, ExcelJS, pnpm monorepo.

**Spec:** `docs/superpowers/specs/2026-09-21-finance-inventory-design.md`

## Global Constraints

- Extend the existing admin/API architecture; do not create a parallel service or design system.
- Protect all finance endpoints with the existing `AdminAuthGuard`; protect writes with the existing `CsrfGuard`.
- Use PostgreSQL/Prisma `Decimal` for authoritative money calculations; never use JavaScript floating-point arithmetic for persisted financial results.
- Use perpetual weighted-average inventory costing and snapshot the unit COGS on every sale item.
- Negative stock is forbidden, including after historical purchase/sale edits or deletions.
- Treat purchases and sales as the inventory source of truth; do not store manually editable aggregate counters on `Product`.
- AMD is the only required currency and is displayed without fractional digits; retain decimal precision for average cost internally.
- Use actual sale price and line discount for revenue and profit; never substitute the catalog default sale price.
- Existing catalog data, product media, public routes, and admin CRUD must remain functional.
- Preserve a future website order integration boundary without implementing checkout or duplicating order revenue in this phase.
- Import the current spreadsheet state idempotently by SKU without recreating products.
- Generate authoritative XLSX/CSV files on the backend from `FinanceReportingService` datasets.
- Implement with TDD and commit each independently reviewable task.

---

## File and Module Map

Backend files are grouped by finance responsibility:

- `apps/api/src/finance/domain/finance.types.ts`: shared DTO-facing enums and calculation result types.
- `apps/api/src/finance/domain/money.ts`: Decimal-only arithmetic and percentage helpers.
- `apps/api/src/finance/inventory/inventory-ledger.service.ts`: deterministic stock replay and COGS snapshots.
- `apps/api/src/finance/suppliers/*`: supplier CRUD.
- `apps/api/src/finance/purchases/*`: purchase DTOs, CRUD, and ledger integration.
- `apps/api/src/finance/sales/*`: sale DTOs, CRUD, stock validation, and ledger integration.
- `apps/api/src/finance/expenses/*`: expense categories and one-time expenses.
- `apps/api/src/finance/recurring/*`: recurring templates and idempotent monthly occurrences.
- `apps/api/src/finance/reporting/*`: product finance rows, dashboard, summaries, profitability, and breakdowns.
- `apps/api/src/finance/export/*`: XLSX/CSV serialization only; no independent calculations.
- `apps/api/src/finance/finance.module.ts`: finance dependency boundary.
- `apps/api/prisma/import-finance-opening.ts`: idempotent opening-ledger importer.

Frontend files are grouped under `apps/web/src/app/features/admin/finance/`:

- `shared/finance-api.types.ts`: exact API contracts.
- `shared/admin-finance.service.ts`: HTTP calls and file downloads.
- `shared/finance-format.ts`: display-only AMD/date/percent formatting.
- `shared/date-range-filter.*`: reusable presets and URL query serialization.
- `shared/finance-ui.scss`: module-level styles extending existing admin variables/classes.
- `dashboard/*`, `products/*`, `purchases/*`, `sales/*`, `expenses/*`, `summary/*`, and `export/*`: focused pages/editors.

---

### Task 1: Finance Schema, Decimal Primitives, and Migration

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_finance_inventory/migration.sql`
- Create: `apps/api/src/finance/domain/finance.types.ts`
- Create: `apps/api/src/finance/domain/money.ts`
- Test: `apps/api/src/finance/domain/money.spec.ts`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces `money(value): Prisma.Decimal`, `moneySum(values): Prisma.Decimal`, `safePercent(numerator, denominator): Prisma.Decimal | null`, and `roundMoney(value, scale): Prisma.Decimal`.
- Produces Prisma models/enums exactly named `Supplier`, `Purchase`, `PurchaseItem`, `Sale`, `SaleItem`, `ExpenseCategory`, `Expense`, `RecurringExpense`, and `RecurringExpenseOccurrence`.
- Extends `Product` with `lowStockThreshold Int @default(2)` and relations; extends `AdminUser` with creation relations.

- [ ] **Step 1: Add failing Decimal helper tests**

```ts
import { Prisma } from "../../generated/prisma/client";
import { money, moneySum, roundMoney, safePercent } from "./money";

describe("finance money", () => {
  it("calculates weighted values without binary floating point", () => {
    const total = moneySum([money(10).mul(12_000), money(5).mul(13_000)]);
    expect(roundMoney(total.div(15), 2).toString()).toBe("12333.33");
  });

  it("returns null rather than infinity for a zero denominator", () => {
    expect(
      safePercent(new Prisma.Decimal(100), new Prisma.Decimal(0)),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run: `pnpm --filter @athlon/api test -- money.spec.ts`

Expected: FAIL because `./money` does not exist.

- [ ] **Step 3: Add the Prisma finance models and constraints**

Add enums for `SaleSourceType`, `SalesChannel`, `ExpenseSource`, and `Recurrence`. Use `Decimal @db.Decimal(14, 2)` for transaction unit prices/discounts and `Decimal @db.Decimal(18, 6)` for `costUnitSnapshot`. Add these critical constraints/indexes in the migration:

```sql
CHECK ("quantity" > 0)
CHECK ("purchaseUnitPrice" >= 0)
CHECK ("actualUnitPrice" >= 0)
CHECK ("lineDiscount" >= 0)
UNIQUE ("purchaseId", "productId")
UNIQUE ("saleId", "productId")
UNIQUE ("sourceType", "sourceId")
UNIQUE ("recurringExpenseId", "periodYear", "periodMonth")
```

Use `onDelete: Restrict` for products and admin users referenced by financial history. Use `onDelete: Cascade` only for child items owned by a purchase or sale.

- [ ] **Step 4: Implement Decimal helpers**

```ts
import { Prisma } from "../../generated/prisma/client";

export const money = (value: Prisma.Decimal.Value): Prisma.Decimal =>
  new Prisma.Decimal(value);

export const moneySum = (values: Prisma.Decimal[]): Prisma.Decimal =>
  values.reduce((sum, value) => sum.add(value), new Prisma.Decimal(0));

export const roundMoney = (value: Prisma.Decimal, scale = 2): Prisma.Decimal =>
  value.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);

export const safePercent = (
  numerator: Prisma.Decimal,
  denominator: Prisma.Decimal,
): Prisma.Decimal | null =>
  denominator.isZero()
    ? null
    : numerator.div(denominator).mul(100).toDecimalPlaces(2);
```

- [ ] **Step 5: Generate and validate Prisma artifacts**

Run:

```bash
pnpm --filter @athlon/api prisma:generate
pnpm --filter @athlon/api prisma:validate
pnpm --filter @athlon/api test -- money.spec.ts
```

Expected: schema valid and focused tests PASS.

- [ ] **Step 6: Add ExcelJS now so later export tasks do not modify dependency foundations**

Run: `pnpm --filter @athlon/api add exceljs`

Expected: `exceljs` appears in `apps/api/package.json` and the lockfile updates.

- [ ] **Step 7: Commit the schema foundation**

```bash
git add apps/api/prisma apps/api/src/finance/domain apps/api/package.json pnpm-lock.yaml
git commit -m "feat(finance): add transaction ledger schema"
```

---

### Task 2: Inventory Ledger Replay and Stock Validation

**Files:**

- Create: `apps/api/src/finance/inventory/inventory-ledger.types.ts`
- Create: `apps/api/src/finance/inventory/inventory-ledger.service.ts`
- Test: `apps/api/src/finance/inventory/inventory-ledger.service.spec.ts`

**Interfaces:**

- Consumes Decimal helpers from Task 1 and Prisma transaction clients.
- Produces:

```ts
type InventoryPosition = {
  quantity: number;
  averageUnitCost: Prisma.Decimal;
  inventoryValue: Prisma.Decimal;
};

type LedgerReplayResult = {
  position: InventoryPosition;
  saleCosts: Map<string, Prisma.Decimal>;
};

InventoryLedgerService.replayProduct(
  tx: Prisma.TransactionClient,
  productId: string,
  proposed?: LedgerMutation,
): Promise<LedgerReplayResult>;

InventoryLedgerService.recalculateProducts(
  tx: Prisma.TransactionClient,
  productIds: string[],
  proposed?: LedgerMutation,
): Promise<Map<string, LedgerReplayResult>>;
```

- [ ] **Step 1: Write failing ledger examples**

Cover in the focused spec:

```ts
it("keeps 7 units after purchasing 10 and selling 3", async () => {
  const result = replay([
    purchase("2026-09-01", 10, "12000"),
    sale("2026-09-02", "sale-1", 3),
  ]);
  expect(result.position.quantity).toBe(7);
});

it("uses the weighted average 12333.33", async () => {
  const result = replay([
    purchase("2026-09-01", 10, "12000"),
    purchase("2026-09-20", 5, "13000"),
  ]);
  expect(roundMoney(result.position.averageUnitCost, 2).toString()).toBe(
    "12333.33",
  );
});

it("rejects a sale larger than available stock", () => {
  expect(() =>
    replay([purchase("2026-09-01", 3, "12000"), sale("2026-09-02", "s", 5)]),
  ).toThrow("Only 3 units are currently available.");
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm --filter @athlon/api test -- inventory-ledger.service.spec.ts`

Expected: FAIL because the service/types do not exist.

- [ ] **Step 3: Implement a pure deterministic replay core**

Sort ledger entries by `occurredAt`, `createdAt`, type tie-breaker, and `id`. Purchases increase inventory value and recompute average cost. Sales require enough stock, record the current average into `saleCosts`, reduce quantity and inventory value, and reset average cost to zero only when quantity reaches zero.

- [ ] **Step 4: Add the Prisma-backed replay wrapper**

Load purchase and sale items for one product, merge a proposed create/update/delete mutation without writing it, replay, then update affected `SaleItem.costUnitSnapshot` values inside the caller's transaction.

- [ ] **Step 5: Add historical edit/delete regression tests**

Test that reducing a past purchase from 10 to 8 changes later stock from 7 to 5, and that deleting a sale restores its quantity. Test that reducing a purchase below already-sold quantity rejects the entire mutation.

- [ ] **Step 6: Run focused tests**

Run: `pnpm --filter @athlon/api test -- inventory-ledger.service.spec.ts`

Expected: PASS with all inventory, weighted average, edit, delete, and insufficient-stock cases.

- [ ] **Step 7: Commit the ledger**

```bash
git add apps/api/src/finance/inventory
git commit -m "feat(finance): implement weighted inventory ledger"
```

---

### Task 3: Suppliers and Purchases Backend

**Files:**

- Create: `apps/api/src/finance/common/finance-list-query.dto.ts`
- Create: `apps/api/src/finance/suppliers/dto/*.ts`
- Create: `apps/api/src/finance/suppliers/suppliers.service.ts`
- Create: `apps/api/src/finance/suppliers/suppliers.controller.ts`
- Create: `apps/api/src/finance/purchases/dto/*.ts`
- Create: `apps/api/src/finance/purchases/purchases.service.ts`
- Create: `apps/api/src/finance/purchases/purchases.controller.ts`
- Create: `apps/api/src/finance/finance.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/test/finance-purchases.e2e-spec.ts`

**Interfaces:**

- Supplier endpoints use `/api/v1/admin/finance/suppliers`.
- Purchase endpoints use `/api/v1/admin/finance/purchases`.
- `CreatePurchaseDto` shape:

```ts
{
  date: string;
  supplierId: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    purchaseUnitPrice: string;
  }>;
}
```

- List response follows existing `{ items, meta }` convention and returns calculated `totalPurchaseCost` as a decimal string.

- [ ] **Step 1: Write failing protected CRUD e2e tests**

Add tests proving unauthenticated reads return 401, missing CSRF on writes returns 403, duplicate product lines return 400, and a valid purchase returns its item total:

```ts
expect(created.body.items[0]).toMatchObject({
  quantity: 10,
  purchaseUnitPrice: "12000",
  totalPurchaseCost: "120000",
});
```

- [ ] **Step 2: Run the e2e file and verify failure**

Run: `pnpm --filter @athlon/api test:e2e -- finance-purchases.e2e-spec.ts`

Expected: FAIL with missing routes/module.

- [ ] **Step 3: Implement supplier DTOs, service, and controller**

Follow the existing admin category/brand patterns for pagination, search, validation, conflict mapping, admin guards, and response shapes. Prevent deletion of suppliers referenced by purchases; allow `active=false` instead.

- [ ] **Step 4: Implement purchase create/read/list**

Create the purchase and its items inside a serializable transaction. Generate `purchaseNumber` as `PUR-YYYYMMDD-<short-id>` server-side. Invoke `InventoryLedgerService.recalculateProducts` before commit.

- [ ] **Step 5: Implement purchase update/delete through proposed ledger mutations**

For updates, collect the union of previous and next product IDs, replay the proposed replacement, and persist only if every product remains non-negative. For delete, replay without the purchase before deleting it.

- [ ] **Step 6: Add filter/sort/pagination tests**

Verify date range, product, category, supplier, search by number/SKU/product name, sort by date/total, and pagination. Verify `createdBy` is the authenticated admin, never a client-supplied ID.

- [ ] **Step 7: Run focused backend tests**

Run:

```bash
pnpm --filter @athlon/api test -- inventory-ledger.service.spec.ts
pnpm --filter @athlon/api test:e2e -- finance-purchases.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit purchases**

```bash
git add apps/api/src/finance apps/api/src/app.module.ts apps/api/test/finance-purchases.e2e-spec.ts
git commit -m "feat(finance): add suppliers and stock purchases"
```

---

### Task 4: Multi-Product Sales Backend

**Files:**

- Create: `apps/api/src/finance/sales/dto/*.ts`
- Create: `apps/api/src/finance/sales/sales.service.ts`
- Create: `apps/api/src/finance/sales/sales.controller.ts`
- Modify: `apps/api/src/finance/finance.module.ts`
- Test: `apps/api/test/finance-sales.e2e-spec.ts`

**Interfaces:**

```ts
type CreateSaleInput = {
  date: string;
  orderId?: string;
  channel: SalesChannel;
  trainerReferralCode?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
    actualUnitPrice: string;
    lineDiscount?: string;
  }>;
};
```

Every returned item includes decimal strings `netRevenue`, `costOfGoodsSold`, `grossProfit`, and `grossMarginPercent`.

- [ ] **Step 1: Write failing sale calculation tests**

Create stock at 12,000 AMD and record a sale at 15,000 AMD. Assert:

```ts
expect(item).toMatchObject({
  netRevenue: "15000",
  costOfGoodsSold: "12000",
  grossProfit: "3000",
  grossMarginPercent: "20",
});
```

Add a two-item sale and assert one sale/order with summed revenue, not two orders.

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @athlon/api test:e2e -- finance-sales.e2e-spec.ts`

Expected: FAIL with missing routes.

- [ ] **Step 3: Implement sale DTO validation**

Reject duplicate products, quantity below one, negative prices, negative discounts, and `lineDiscount > quantity × actualUnitPrice`. Normalize empty optional text to null. Accept only the defined channel enum.

- [ ] **Step 4: Implement create/read/list**

Generate `saleNumber` as `SAL-YYYYMMDD-<short-id>`. Replay affected products with the proposed sale in a serializable transaction, then persist the ledger-provided COGS snapshot. Use actual prices and subtract each line discount exactly once.

- [ ] **Step 5: Implement update/delete with stock restoration and recalculation**

Updating a sale replays the union of old/new products. Deleting a sale removes it from replay so later stock and COGS snapshots are recomputed.

- [ ] **Step 6: Add concurrency and validation tests**

From stock quantity one, issue two concurrent sales of one. Assert one succeeds, one returns conflict/validation, and final sold quantity is one. Assert a request for five units when three are available returns `Only 3 units are currently available.`

- [ ] **Step 7: Add filters and source metadata tests**

Verify date range, product, category, channel, referral code, customer/order search, sorting, and pagination. Verify manual sales set `sourceType=MANUAL`; clients cannot forge `WEBSITE_ORDER` source IDs.

- [ ] **Step 8: Run focused tests and commit**

```bash
pnpm --filter @athlon/api test -- inventory-ledger.service.spec.ts
pnpm --filter @athlon/api test:e2e -- finance-sales.e2e-spec.ts
git add apps/api/src/finance apps/api/test/finance-sales.e2e-spec.ts
git commit -m "feat(finance): add multi-product sales ledger"
```

---

### Task 5: Expenses and Recurring Monthly Occurrences

**Files:**

- Create: `apps/api/src/finance/expenses/dto/*.ts`
- Create: `apps/api/src/finance/expenses/expenses.service.ts`
- Create: `apps/api/src/finance/expenses/expenses.controller.ts`
- Create: `apps/api/src/finance/recurring/dto/*.ts`
- Create: `apps/api/src/finance/recurring/recurring-expenses.service.ts`
- Create: `apps/api/src/finance/recurring/recurring-expenses.controller.ts`
- Modify: `apps/api/src/finance/finance.module.ts`
- Modify: `apps/api/prisma/seed.ts`
- Test: `apps/api/test/finance-expenses.e2e-spec.ts`

**Interfaces:**

- `RecurringExpensesService.materializePeriod(tx, year, month): Promise<number>` returns the number of new occurrences and is idempotent.
- One-time and recurring occurrence expenses share reporting through the `Expense` table and explicit `source`.

- [ ] **Step 1: Write failing expense/recurrence tests**

Test category CRUD, one-time expense CRUD, and the following recurrence behavior:

```ts
await service.materializePeriod(tx, 2026, 9);
await service.materializePeriod(tx, 2026, 9);
expect(await prisma.recurringExpenseOccurrence.count()).toBe(1);
expect(
  await prisma.expense.count({
    where: { source: "RECURRING_OCCURRENCE" },
  }),
).toBe(1);
```

- [ ] **Step 2: Run the e2e file and verify failure**

Run: `pnpm --filter @athlon/api test:e2e -- finance-expenses.e2e-spec.ts`

Expected: FAIL with missing expense routes.

- [ ] **Step 3: Seed standard expense categories idempotently**

Seed the exact categories from the design. Use stable names and upserts. Do not delete custom categories.

- [ ] **Step 4: Implement one-time expense/category CRUD**

Validate non-negative Decimal amounts, date, category, description, payment method, and notes. Prevent normal expense CRUD from changing or deleting a generated recurring occurrence without an explicit correction endpoint.

- [ ] **Step 5: Implement recurring template CRUD and materialization**

Use a serializable transaction and the unique `(template, year, month)` constraint. Copy name, category, amount, payment method, and notes into the occurrence/expense snapshot. Honor start date, optional end date, and active state.

- [ ] **Step 6: Protect historical occurrences**

Test that changing a template after September materialization leaves September unchanged and produces the changed amount for October.

- [ ] **Step 7: Add date/category/source filters and run tests**

Run: `pnpm --filter @athlon/api test:e2e -- finance-expenses.e2e-spec.ts`

Expected: PASS including deduplication and historical immutability.

- [ ] **Step 8: Commit expenses**

```bash
git add apps/api/src/finance apps/api/prisma/seed.ts apps/api/test/finance-expenses.e2e-spec.ts
git commit -m "feat(finance): add operating and recurring expenses"
```

---

### Task 6: Authoritative Reporting and Dashboard Queries

**Files:**

- Create: `apps/api/src/finance/reporting/report-query.dto.ts`
- Create: `apps/api/src/finance/reporting/finance-reporting.types.ts`
- Create: `apps/api/src/finance/reporting/finance-reporting.service.ts`
- Create: `apps/api/src/finance/reporting/finance-reporting.controller.ts`
- Modify: `apps/api/src/finance/finance.module.ts`
- Test: `apps/api/src/finance/reporting/finance-reporting.service.spec.ts`
- Test: `apps/api/test/finance-reporting.e2e-spec.ts`

**Interfaces:**

```ts
getDashboard(range: DateRange): Promise<FinanceDashboard>;
getProducts(query: FinanceProductQuery): Promise<AdminList<FinanceProductRow>>;
getMonthlySummary(year: number, month?: number): Promise<MonthlySummary>;
getProfitability(query: ProfitabilityQuery): Promise<AdminList<ProductProfitabilityRow>>;
getExpenseBreakdown(query: DateRange): Promise<ExpenseBreakdownRow[]>;
getExportDataset(query: AccountingExportQuery): Promise<AccountingDataset>;
```

All monetary output is serialized as decimal strings.

- [ ] **Step 1: Write failing formula tests**

Use fixtures with revenue 1,000,000, COGS 600,000, one-time expenses 60,000, and recurring expenses 40,000. Assert gross profit 400,000, total expenses 100,000, net profit 300,000, gross margin 40%, and net margin 30%.

- [ ] **Step 2: Verify the tests fail**

Run: `pnpm --filter @athlon/api test -- finance-reporting.service.spec.ts`

Expected: FAIL because reporting files do not exist.

- [ ] **Step 3: Implement reusable reporting query fragments**

Build one normalized UTC date-range parser for Today, This Month, Previous Month, This Year, and custom inclusive dates. Have all reporting methods call recurring occurrence materialization before querying their period.

- [ ] **Step 4: Implement product finance rows**

Return SKU, localized/default product name, category, supplier set, default sale price, weighted average buy price, total purchased, total sold, current stock, default-price profit per unit, default-price margin, inventory value, realized revenue, and realized gross profit. Derive stock status from `lowStockThreshold`.

- [ ] **Step 5: Implement dashboard/monthly summary and comparisons**

Count distinct sales for orders and sum item quantity for units. Compute average order value from distinct sale count. For previous-period zero, return `comparisonPercent: null` rather than infinity.

- [ ] **Step 6: Implement profitability and expense breakdown**

Support required sorts and filter combinations. Expense percentages divide by total expenses with zero-safe null percentages.

- [ ] **Step 7: Add e2e response/filter tests**

Verify all report routes require auth, return expected examples, respect date/category/product/channel/supplier/referral filters, and never count records outside the range.

- [ ] **Step 8: Run focused tests and commit**

```bash
pnpm --filter @athlon/api test -- finance-reporting.service.spec.ts
pnpm --filter @athlon/api test:e2e -- finance-reporting.e2e-spec.ts
git add apps/api/src/finance apps/api/test/finance-reporting.e2e-spec.ts
git commit -m "feat(finance): add financial reporting and profitability"
```

---

### Task 7: Filter-Aware XLSX and CSV Exports

**Files:**

- Create: `apps/api/src/finance/export/csv-export.ts`
- Create: `apps/api/src/finance/export/excel-export.service.ts`
- Create: `apps/api/src/finance/export/finance-export.controller.ts`
- Modify: `apps/api/src/finance/finance.module.ts`
- Test: `apps/api/src/finance/export/csv-export.spec.ts`
- Test: `apps/api/test/finance-export.e2e-spec.ts`

**Interfaces:**

- `ExcelExportService.accountingWorkbook(dataset, period): Promise<Buffer>`.
- `toCsv(headers, rows): Buffer` returns UTF-8 BOM CSV and neutralizes cells beginning with `=`, `+`, `-`, or `@` by prefixing `'`.
- Controllers consume `FinanceReportingService`; they do not query Prisma or recalculate totals.

- [ ] **Step 1: Write failing CSV safety and XLSX consistency tests**

Assert CSV begins with BOM, quotes commas/newlines, and exports `'=SUM(A1:A2)` rather than an executable formula. Seed a monthly report and assert the workbook Summary revenue equals the dashboard revenue exactly.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
pnpm --filter @athlon/api test -- csv-export.spec.ts
pnpm --filter @athlon/api test:e2e -- finance-export.e2e-spec.ts
```

Expected: FAIL because export files/routes do not exist.

- [ ] **Step 3: Implement safe CSV serialization**

Use `\r\n`, BOM, RFC-compatible double-quote escaping, and text-cell formula neutralization. Format monetary values as plain numeric AMD values so spreadsheets can sum them.

- [ ] **Step 4: Implement the branded workbook**

Create sheets `Dashboard`, `Products`, `Purchases`, `Sales`, `Expenses`, and `Monthly Summary`. Use black header fill `FF0A0A0A`, red accent `FFE30613`, white bold text, frozen header rows, auto-filter, explicit column widths, AMD format `#,##0 "AMD"`, and `yyyy-mm-dd` dates. Add totals using authoritative dataset values, not independent formulas.

- [ ] **Step 5: Implement export endpoints and headers**

Return correct XLSX/CSV content types, `Content-Disposition: attachment`, `Cache-Control: no-store`, and server-generated filenames. Implement current-view endpoints using the same query DTO as lists and a full accounting endpoint using date range.

- [ ] **Step 6: Test filter-aware exports**

Seed Instagram and Gym sales in September/October. Export September Instagram and assert only the matching record appears. Repeat for supplier, product, category, referral, and expense category filters.

- [ ] **Step 7: Run tests and commit**

```bash
pnpm --filter @athlon/api test -- csv-export.spec.ts
pnpm --filter @athlon/api test:e2e -- finance-export.e2e-spec.ts
git add apps/api/src/finance apps/api/test/finance-export.e2e-spec.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(finance): export accounting reports"
```

---

### Task 8: Idempotent Opening-Ledger Import

**Files:**

- Create: `apps/api/prisma/finance-opening-data.ts`
- Create: `apps/api/prisma/import-finance-opening.ts`
- Modify: `apps/api/package.json`
- Modify: `README.md`
- Test: `apps/api/prisma/import-finance-opening.spec.ts`

**Interfaces:**

- Adds script: `db:import-finance-opening`: `tsx prisma/import-finance-opening.ts`.
- Exports `importFinanceOpening(prisma, input): Promise<OpeningImportResult>` for tests.
- Uses stable import keys `opening-purchase-2026-09-20` and `opening-sale-<SKU>-2026-09-20`.

- [ ] **Step 1: Encode the approved spreadsheet rows as typed data**

For every SKU, record `purchaseUnitPrice`, `defaultSalePrice`, `unitsPurchased`, `unitsSold`, and known actual sale price. Include the 25 current SKUs and the two historical sold units shown in the source table. Make the file data-only and reviewable.

- [ ] **Step 2: Write a failing idempotency/import reconciliation test**

Run the importer twice against a test database. Assert one opening purchase per import group, no duplicate sales, and exact reconciliation:

```ts
expect(result.secondRun.createdPurchases).toBe(0);
expect(result.secondRun.createdSales).toBe(0);
expect(summary.currentStock).toEqual(source.unitsPurchased - source.unitsSold);
```

- [ ] **Step 3: Verify failure**

Run: `pnpm --filter @athlon/api test -- import-finance-opening.spec.ts`

Expected: FAIL because importer does not exist.

- [ ] **Step 4: Implement importer through finance services**

Match products by SKU and fail before writing if any SKU is missing. Upsert `Opening Inventory` supplier. Create opening purchases and manual sales with stable import keys; do not manipulate stock directly. Preserve catalog default sale prices unless they differ from the approved opening table, in which case update only `Product.price` and report the change.

- [ ] **Step 5: Add reconciliation output and dry-run mode**

`--dry-run` prints missing SKUs and expected totals without writes. Normal mode prints SKU-level purchased, sold, stock, inventory value, revenue, and gross profit plus totals. Exit nonzero on any mismatch.

- [ ] **Step 6: Run importer tests and document commands**

Run: `pnpm --filter @athlon/api test -- import-finance-opening.spec.ts`

Expected: PASS, including second-run idempotency.

- [ ] **Step 7: Commit importer**

```bash
git add apps/api/prisma apps/api/package.json README.md
git commit -m "feat(finance): import opening inventory ledger"
```

---

### Task 9: Angular Finance Foundation, Navigation, and Shared UI

**Files:**

- Modify: `apps/web/src/app/features/admin/admin-shell.ts`
- Modify: `apps/web/src/app/features/admin/admin-shell.html`
- Modify: `apps/web/src/app/features/admin/admin-shell.scss`
- Modify: `apps/web/src/app/features/admin/admin.routes.ts`
- Modify: `apps/web/src/app/features/admin/shared/admin-i18n.service.ts`
- Create: `apps/web/src/app/features/admin/finance/finance.routes.ts`
- Create: `apps/web/src/app/features/admin/finance/shared/finance-api.types.ts`
- Create: `apps/web/src/app/features/admin/finance/shared/admin-finance.service.ts`
- Create: `apps/web/src/app/features/admin/finance/shared/finance-format.ts`
- Create: `apps/web/src/app/features/admin/finance/shared/date-range-filter.ts`
- Create: `apps/web/src/app/features/admin/finance/shared/date-range-filter.html`
- Create: `apps/web/src/app/features/admin/finance/shared/finance-ui.scss`
- Test: `apps/web/src/app/features/admin/finance/shared/finance-foundation.spec.ts`
- Modify test: `apps/web/src/app/features/admin/admin.routes.spec.ts`

**Interfaces:**

- `AdminFinanceService` methods mirror every backend endpoint and return types from `finance-api.types.ts`.
- `download(endpoint, query): Observable<{ blob: Blob; filename: string }>` extracts a safe filename from `Content-Disposition`.
- `DateRangeFilter` emits `{ preset, from?, to? }` and serializes to URL query parameters.

- [ ] **Step 1: Write failing route/navigation/auth tests**

Assert `/admin/finance` is lazy, protected by the parent auth guard, admin noindex remains active, and sidebar exposes Dashboard, Products, Purchases, Sales, Expenses, Monthly Summary, and Export.

- [ ] **Step 2: Run the focused frontend test and verify failure**

Run: `pnpm --filter @athlon/web test -- --include='**/finance-foundation.spec.ts'`

Expected: FAIL because finance routes/components do not exist.

- [ ] **Step 3: Define exact API types and HTTP service**

Represent Decimal values as strings and dates as ISO strings. Use `HttpParams` consistently and avoid `any`. Add typed list/query/input/output contracts for suppliers, purchases, sales, expenses, recurring templates, product finance rows, dashboard, summary, profitability, and exports.

- [ ] **Step 4: Add lazy routes and grouped sidebar navigation**

Load `finance.routes.ts` under `/admin/finance`. Reuse `adminDirtyFormGuard` for all editors. Implement an accessible expandable Finance & Inventory group; preserve direct keyboard navigation and current active-link styling.

- [ ] **Step 5: Implement display-only format/date helpers**

Use `Intl.NumberFormat("hy-AM", { maximumFractionDigits: 0 })` for AMD display and a separate percent formatter. Never use these helpers for backend calculations.

- [ ] **Step 6: Implement reusable date presets and query persistence**

Provide Today, This Month, Previous Month, This Year, and Custom. Validate `from <= to`, emit normalized `YYYY-MM-DD`, and preserve filters in URL query parameters.

- [ ] **Step 7: Run tests and commit**

```bash
pnpm --filter @athlon/web test -- --include='**/finance-foundation.spec.ts'
pnpm --filter @athlon/web test -- --include='**/admin.routes.spec.ts'
git add apps/web/src/app/features/admin
git commit -m "feat(admin): add finance navigation and client foundation"
```

---

### Task 10: Purchase, Sale, Supplier, and Inventory Admin Pages

**Files:**

- Create: `apps/web/src/app/features/admin/finance/products/finance-product-list.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/purchases/purchase-list.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/purchases/purchase-editor.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/sales/sale-list.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/sales/sale-editor.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/suppliers/supplier-list.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/suppliers/supplier-editor.{ts,html}`
- Modify: `apps/web/src/app/features/admin/finance/finance.routes.ts`
- Test: `apps/web/src/app/features/admin/finance/transactions/finance-transactions.spec.ts`

**Interfaces:**

- Editors implement existing `AdminDirtyForm`.
- Purchase/sale item `FormArray` rows are strongly typed, reject duplicate products locally, and still display backend validation.
- Lists use URL-backed search, filters, sorting, and pagination.

- [ ] **Step 1: Write failing page behavior tests**

Test product finance columns, purchase line total, sale actual-price/discount/net revenue preview, add/remove item rows, dirty navigation confirmation, insufficient-stock server error, delete confirmation, loading, empty, and retry states.

- [ ] **Step 2: Verify the focused tests fail**

Run: `pnpm --filter @athlon/web test -- --include='**/finance-transactions.spec.ts'`

Expected: FAIL with missing pages.

- [ ] **Step 3: Implement finance product table**

Show SKU, product, category, supplier, default sale price, average buy price, purchased, sold, current stock, profit/unit, margin, inventory value, and realized gross profit. Add search, category, supplier, stock status, sort, pagination, and low-stock visual state.

- [ ] **Step 4: Implement supplier and purchase CRUD pages**

Reuse current list/editor/confirmation/dirty-form patterns. The purchase editor supports date, supplier, notes, and multiple product rows with quantity, purchase unit price, and computed display-only line total.

- [ ] **Step 5: Implement sales CRUD pages**

Support order ID, channel, referral, optional customer information, notes, and multiple product rows. Display available stock from selected product finance data. Show line and sale totals as previews while treating the server response as authoritative.

- [ ] **Step 6: Add responsive behavior and accessibility**

Use labelled controls, table captions or accessible headings, status text beyond color, focusable error summary, and horizontal table scrolling below desktop width.

- [ ] **Step 7: Run focused tests and commit**

```bash
pnpm --filter @athlon/web test -- --include='**/finance-transactions.spec.ts'
git add apps/web/src/app/features/admin/finance
git commit -m "feat(admin): manage purchases sales and inventory"
```

---

### Task 11: Expenses, Recurring Templates, and Financial Reports UI

**Files:**

- Create: `apps/web/src/app/features/admin/finance/expenses/expense-list.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/expenses/expense-editor.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/expenses/recurring-expense-list.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/expenses/recurring-expense-editor.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/dashboard/finance-dashboard.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/dashboard/kpi-card.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/dashboard/simple-chart.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/summary/monthly-summary.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/summary/profitability-list.{ts,html}`
- Create: `apps/web/src/app/features/admin/finance/export/export-page.{ts,html}`
- Modify: `apps/web/src/app/features/admin/finance/finance.routes.ts`
- Test: `apps/web/src/app/features/admin/finance/reports/finance-reports.spec.ts`

**Interfaces:**

- KPI cards accept `{ label, value, comparisonPercent, tone }`.
- `SimpleChart` receives already-aggregated `{ label, value }[]`; it does not calculate business metrics.
- Export page calls `AdminFinanceService.download` and creates/revokes one object URL per completed download.

- [ ] **Step 1: Write failing expenses/dashboard/export tests**

Test one-time and recurring forms, recurring active toggle, monthly selector, zero-safe margin labels, KPI comparisons, expense breakdown, profitability sorting, export progress, duplicate-click prevention, filename handling, and error recovery.

- [ ] **Step 2: Verify focused tests fail**

Run: `pnpm --filter @athlon/web test -- --include='**/finance-reports.spec.ts'`

Expected: FAIL because report pages do not exist.

- [ ] **Step 3: Implement expense and recurring template CRUD**

Provide date/category/source/payment filters, custom category management, delete confirmation, and clear distinction between one-time expenses and generated monthly occurrences. Explain that template changes do not rewrite historical months.

- [ ] **Step 4: Implement dashboard and simple charts**

Render Revenue, Gross Profit, Net Profit, Expenses, Units Sold, Orders, Average Order Value, and Inventory Value. Add charts for revenue, net profit, expenses, sales by product, and profit by product using semantic SVG/CSS and accessible text summaries.

- [ ] **Step 5: Implement monthly summary and profitability**

Persist selected month/year in URL. Show all required formulas, sales/profit tables, expense category breakdown, and sorting options. Display `—` for undefined comparisons/margins rather than `Infinity` or `NaN`.

- [ ] **Step 6: Implement export UX**

Provide Excel/CSV menus on relevant pages, `Export Current View`, and a full accounting export date-range form. Disable controls during downloads and surface backend errors through the existing status/error pattern.

- [ ] **Step 7: Run tests and commit**

```bash
pnpm --filter @athlon/web test -- --include='**/finance-reports.spec.ts'
git add apps/web/src/app/features/admin/finance
git commit -m "feat(admin): add finance reports expenses and exports"
```

---

### Task 12: Cross-Layer Integration, Documentation, and Production Readiness

**Files:**

- Modify: `apps/api/test/admin-auth.e2e-spec.ts`
- Create: `apps/api/test/finance-workflow.e2e-spec.ts`
- Modify: `apps/web/src/app/features/admin/admin.routes.spec.ts`
- Modify: `README.md`
- Modify: `.env.example` only if an export limit/config variable is introduced
- Create: `docs/finance-operations.md`

**Interfaces:**

- End-to-end workflow proves purchase → sale → expense → monthly report → export using real PostgreSQL.
- Operations guide defines migration, dry-run import, verified import, backup, smoke test, and rollback commands.

- [ ] **Step 1: Write the complete business-example e2e test**

Create two purchases (10 × 12,000 and 5 × 13,000), then sales (2 × 16,000 and 1 × 15,000), and expenses 5,000 + 10,000 + 40,000. Assert purchased 15, sold 3, stock 12, weighted average 12,333.33, revenue 47,000, COGS 37,000, gross profit 10,000, expenses 55,000, and corresponding net result.

- [ ] **Step 2: Add order-source contract and security regression tests**

Assert cancelled/failed future order adapter statuses map to no finance sale using a pure `shouldCountWebsiteOrder(status)` contract test. Assert every finance route rejects unauthenticated requests and every finance write rejects missing CSRF.

- [ ] **Step 3: Run the workflow tests**

Run:

```bash
pnpm --filter @athlon/api test:e2e -- finance-workflow.e2e-spec.ts
pnpm --filter @athlon/web test -- --include='**/admin.routes.spec.ts'
```

Expected: PASS.

- [ ] **Step 4: Document local and production operations**

Document these exact phases without embedding secrets:

```bash
pnpm --filter @athlon/api db:deploy
pnpm --filter @athlon/api db:import-finance-opening -- --dry-run
pnpm --filter @athlon/api db:import-finance-opening
pnpm verify
```

Include database backup prerequisite, expected reconciliation output, finance route smoke checks, export smoke check, and restore/rollback procedure using the existing production scripts.

- [ ] **Step 5: Run the complete verification gate**

Run: `pnpm verify`

Expected: format check, Prisma validate/generate, typecheck, API/web lint, unit tests, e2e tests, production builds, and SSR checks all exit zero.

- [ ] **Step 6: Review the full branch diff for scope and secrets**

Run:

```bash
git diff --check origin/styles...HEAD
git diff --stat origin/styles...HEAD
git grep -nE '(DATABASE_URL=|ACCESS_TOKEN_SECRET=|REFRESH_TOKEN_SECRET=|TELEGRAM_BOT_TOKEN=)' -- ':!pnpm-lock.yaml'
```

Expected: no whitespace errors, only finance-related files plus approved dependencies/docs, and no committed secret values.

- [ ] **Step 7: Commit readiness documentation and final tests**

```bash
git add README.md .env.example docs/finance-operations.md apps/api/test apps/web/src/app/features/admin/admin.routes.spec.ts
git commit -m "test(finance): verify accounting workflow"
```

- [ ] **Step 8: Request final code review before integration**

Use `superpowers:requesting-code-review`, address findings, rerun `pnpm verify`, then use `superpowers:finishing-a-development-branch` to offer merge/PR choices. Do not deploy or merge without the user's explicit instruction at that stage.
