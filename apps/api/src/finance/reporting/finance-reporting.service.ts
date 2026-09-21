import { ConflictException, Injectable } from "@nestjs/common";
import {
  adminListEnvelope,
  adminListOffset,
  rethrowCatalogConflict,
} from "../../common/admin-list";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { DateRange } from "../domain/finance.types";
import { money, moneySum, roundMoney, safePercent } from "../domain/money";
import { replayInventoryLedger } from "../inventory/inventory-ledger.service";
import { RecurringExpensesService } from "../recurring/recurring-expenses.service";
import {
  AccountingDataset,
  AccountingExportQuery,
  AccountingSaleRow,
  AdminList,
  ExpenseBreakdownRow,
  FinanceDashboard,
  FinanceProductQuery,
  FinanceProductRow,
  FinanceTotals,
  MonthlySummary,
  ProductProfitabilityRow,
  ProfitabilityQuery,
  ReportFilters,
  ReportSort,
  SerializedRange,
} from "./finance-reporting.types";
import {
  assertReportRange,
  calendarRange,
  previousReportRange,
} from "./report-query.dto";

const productInclude = {
  translations: true,
  category: { include: { translations: true } },
  purchaseItems: { include: { purchase: { include: { supplier: true } } } },
  saleItems: { include: { sale: true } },
} as const;
const expenseInclude = { category: true, recurringOccurrence: true } as const;
type Product = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type Expense = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;
type Snapshot = { products: Product[]; expenses: Expense[] };
type SelectedProduct = { product: Product; row: FinanceProductRow };

const serializedRange = (range: DateRange): SerializedRange => ({
  from: range.from.toISOString(),
  to: range.to.toISOString(),
});
const inRange = (date: Date, range: DateRange) =>
  date >= range.from && date <= range.to;
const localizedName = (
  translations: { locale: string; name: string }[],
  locale = "HY",
  fallback = "",
) =>
  [locale, "HY", "RU", "EN"]
    .map(
      (language) =>
        translations.find((translation) => translation.locale === language)
          ?.name,
    )
    .find(Boolean) ?? fallback;

function saleMatches(
  item: Product["saleItems"][number],
  query: AccountingExportQuery,
): boolean {
  return (
    inRange(item.sale.date, query) &&
    (!query.channel || item.sale.channel === query.channel) &&
    (!query.trainerReferralCode ||
      item.sale.trainerReferralCode === query.trainerReferralCode)
  );
}

function saleAmounts(item: Product["saleItems"][number]) {
  const revenue = item.actualUnitPrice
    .mul(item.quantity)
    .sub(item.lineDiscount);
  const costOfGoodsSold = item.costUnitSnapshot.mul(item.quantity);
  return {
    revenue,
    costOfGoodsSold,
    grossProfit: revenue.sub(costOfGoodsSold),
  };
}

function selectProducts(
  snapshot: Snapshot,
  query: AccountingExportQuery,
): SelectedProduct[] {
  return snapshot.products.flatMap((product) => {
    if (
      (query.productId && product.id !== query.productId) ||
      (query.categoryId && product.categoryId !== query.categoryId) ||
      (query.supplierId &&
        !product.purchaseItems.some(
          (item) => item.purchase.supplierId === query.supplierId,
        ))
    )
      return [];
    const search = query.q?.trim().toLocaleLowerCase();
    if (
      search &&
      ![
        product.sku,
        ...product.translations.map((translation) => translation.name),
      ].some((value) => value.toLocaleLowerCase().includes(search))
    )
      return [];

    // Replay the complete ledger without modifying snapshots. Period/channel
    // filters select realized results; they must never change current stock.
    const { position } = replayInventoryLedger([
      ...product.purchaseItems.map((item) => ({
        type: "purchase" as const,
        id: item.id,
        productId: product.id,
        quantity: item.quantity,
        unitCost: item.purchaseUnitPrice,
        occurredAt: item.purchase.date,
        createdAt: item.purchase.createdAt,
      })),
      ...product.saleItems.map((item) => ({
        type: "sale" as const,
        id: item.id,
        productId: product.id,
        quantity: item.quantity,
        occurredAt: item.sale.date,
        createdAt: item.sale.createdAt,
      })),
    ]);
    const stockStatus =
      position.quantity <= 0
        ? "OUT_OF_STOCK"
        : position.quantity <= product.lowStockThreshold
          ? "LOW_STOCK"
          : "IN_STOCK";
    if (query.stockStatus && stockStatus !== query.stockStatus) return [];
    const sales = product.saleItems.filter((item) => saleMatches(item, query));
    const revenue = moneySum(sales.map((item) => saleAmounts(item).revenue));
    const costOfGoodsSold = moneySum(
      sales.map((item) => saleAmounts(item).costOfGoodsSold),
    );
    const grossProfit = revenue.sub(costOfGoodsSold);
    const profitPerUnit = product.price?.sub(position.averageUnitCost) ?? null;
    const suppliers = [
      ...new Map(
        product.purchaseItems.map((item) => [
          item.purchase.supplierId,
          { id: item.purchase.supplierId, name: item.purchase.supplier.name },
        ]),
      ).values(),
    ].sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
    );
    const row: FinanceProductRow = {
      productId: product.id,
      sku: product.sku,
      name: localizedName(product.translations, query.locale, product.sku),
      category: {
        id: product.categoryId,
        name: localizedName(product.category.translations, query.locale),
      },
      suppliers,
      defaultSalePrice: product.price?.toString() ?? null,
      weightedAverageBuyPrice: position.averageUnitCost.toString(),
      totalPurchased: product.purchaseItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      ),
      totalSold: product.saleItems.reduce(
        (sum, item) => sum + item.quantity,
        0,
      ),
      currentStock: position.quantity,
      lowStockThreshold: product.lowStockThreshold,
      stockStatus,
      profitPerUnit: profitPerUnit?.toString() ?? null,
      marginPercent:
        profitPerUnit !== null && product.price !== null
          ? (safePercent(profitPerUnit, product.price)?.toString() ?? null)
          : null,
      inventoryValue: position.inventoryValue.toString(),
      unitsSold: sales.reduce((sum, item) => sum + item.quantity, 0),
      realizedRevenue: revenue.toString(),
      realizedCostOfGoodsSold: costOfGoodsSold.toString(),
      realizedGrossProfit: grossProfit.toString(),
      realizedGrossMarginPercent: (
        safePercent(grossProfit, revenue) ?? money(0)
      ).toString(),
    };
    return [{ product, row }];
  });
}

function saleRows(
  products: SelectedProduct[],
  query: AccountingExportQuery,
): AccountingSaleRow[] {
  return products
    .flatMap(({ product, row }) =>
      product.saleItems
        .filter((item) => saleMatches(item, query))
        .map((item) => {
          const amounts = saleAmounts(item);
          return {
            saleId: item.saleId,
            saleNumber: item.sale.saleNumber,
            date: item.sale.date.toISOString().slice(0, 10),
            orderId: item.sale.orderId,
            channel: item.sale.channel,
            trainerReferralCode: item.sale.trainerReferralCode,
            productId: product.id,
            sku: product.sku,
            name: row.name,
            quantity: item.quantity,
            actualUnitPrice: item.actualUnitPrice.toString(),
            lineDiscount: item.lineDiscount.toString(),
            costUnitSnapshot: item.costUnitSnapshot.toString(),
            revenue: amounts.revenue.toString(),
            costOfGoodsSold: amounts.costOfGoodsSold.toString(),
            grossProfit: amounts.grossProfit.toString(),
          };
        }),
    )
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.saleId.localeCompare(right.saleId) ||
        left.productId.localeCompare(right.productId),
    );
}

function selectedExpenses(
  snapshot: Snapshot,
  query: AccountingExportQuery,
): Expense[] {
  return snapshot.expenses.filter(
    (expense) =>
      inRange(expense.date, query) &&
      (!query.expenseCategoryId ||
        expense.categoryId === query.expenseCategoryId),
  );
}

function totals(
  sales: AccountingSaleRow[],
  expenses: Expense[],
): FinanceTotals {
  const revenue = moneySum(sales.map((row) => money(row.revenue)));
  const costOfGoodsSold = moneySum(
    sales.map((row) => money(row.costOfGoodsSold)),
  );
  const grossProfit = revenue.sub(costOfGoodsSold);
  const operatingExpenses = moneySum(
    expenses
      .filter((expense) => expense.source === "ONE_TIME")
      .map((expense) => expense.amount),
  );
  const recurringExpenses = moneySum(
    expenses
      .filter((expense) => expense.source === "RECURRING_OCCURRENCE")
      .map((expense) => expense.amount),
  );
  const totalExpenses = operatingExpenses.add(recurringExpenses);
  const netProfit = grossProfit.sub(totalExpenses);
  const orderCount = new Set(sales.map((row) => row.saleId)).size;
  return {
    revenue: revenue.toString(),
    costOfGoodsSold: costOfGoodsSold.toString(),
    grossProfit: grossProfit.toString(),
    operatingExpenses: operatingExpenses.toString(),
    recurringExpenses: recurringExpenses.toString(),
    totalExpenses: totalExpenses.toString(),
    netProfit: netProfit.toString(),
    grossMarginPercent: (
      safePercent(grossProfit, revenue) ?? money(0)
    ).toString(),
    netMarginPercent: (safePercent(netProfit, revenue) ?? money(0)).toString(),
    unitsSold: sales.reduce((sum, row) => sum + row.quantity, 0),
    orderCount,
    averageOrderValue: orderCount
      ? roundMoney(revenue.div(orderCount)).toString()
      : "0",
  };
}

function periodTotals(
  snapshot: Snapshot,
  products: SelectedProduct[],
  query: AccountingExportQuery,
): FinanceTotals {
  return totals(saleRows(products, query), selectedExpenses(snapshot, query));
}

function dashboard(
  snapshot: Snapshot,
  products: SelectedProduct[],
  query: AccountingExportQuery,
): FinanceDashboard {
  const current = periodTotals(snapshot, products, query);
  const previousRange = previousReportRange(query);
  const previous = periodTotals(snapshot, products, {
    ...query,
    ...previousRange,
  });
  const comparisons = Object.fromEntries(
    (Object.keys(current) as Array<keyof FinanceTotals>).map((key) => {
      const change = safePercent(
        money(current[key]).sub(previous[key]),
        money(previous[key]).abs(),
      );
      return [
        key,
        {
          previousValue: String(previous[key]),
          comparisonPercent: change?.toString() ?? null,
          label:
            change === null
              ? "No previous-period baseline"
              : "Compared with previous period",
        },
      ];
    }),
  ) as FinanceDashboard["comparisons"];
  return {
    ...current,
    range: serializedRange(query),
    previousRange: serializedRange(previousRange),
    comparisons,
    inventoryValue: moneySum(
      products.map(({ row }) => money(row.inventoryValue)),
    ).toString(),
    currentStock: products.reduce((sum, { row }) => sum + row.currentStock, 0),
    lowStockCount: products.filter(({ row }) => row.stockStatus === "LOW_STOCK")
      .length,
    outOfStockCount: products.filter(
      ({ row }) => row.stockStatus === "OUT_OF_STOCK",
    ).length,
  };
}

function breakdown(expenses: Expense[]): ExpenseBreakdownRow[] {
  const groups = new Map<
    string,
    { categoryId: string; categoryName: string; amount: Prisma.Decimal }
  >();
  for (const expense of expenses) {
    const categoryName =
      expense.recurringOccurrence?.categoryNameSnapshot ??
      expense.category.name;
    // Retain historical recurring category labels even after a category rename.
    const key = JSON.stringify([expense.categoryId, categoryName]);
    const group = groups.get(key) ?? {
      categoryId: expense.categoryId,
      categoryName,
      amount: money(0),
    };
    group.amount = group.amount.add(expense.amount);
    groups.set(key, group);
  }
  const total = moneySum(expenses.map((expense) => expense.amount));
  return [...groups.values()]
    .sort(
      (left, right) =>
        right.amount.comparedTo(left.amount) ||
        left.categoryName.localeCompare(right.categoryName) ||
        left.categoryId.localeCompare(right.categoryId),
    )
    .map((group) => ({
      ...group,
      amount: group.amount.toString(),
      percentage: safePercent(group.amount, total)?.toString() ?? null,
    }));
}

function profitability(row: FinanceProductRow): ProductProfitabilityRow {
  return {
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unitsSold: row.unitsSold,
    revenue: row.realizedRevenue,
    costOfGoodsSold: row.realizedCostOfGoodsSold,
    grossProfit: row.realizedGrossProfit,
    grossMarginPercent: row.realizedGrossMarginPercent,
    currentStock: row.currentStock,
    inventoryValue: row.inventoryValue,
  };
}

function sortProducts(
  rows: FinanceProductRow[],
  sort: ReportSort,
): FinanceProductRow[] {
  const direction = sort.endsWith("Asc") ? 1 : -1;
  const field = sort.startsWith("revenue")
    ? "realizedRevenue"
    : sort.startsWith("profit")
      ? "realizedGrossProfit"
      : sort.startsWith("margin")
        ? "realizedGrossMarginPercent"
        : sort.startsWith("unitsSold")
          ? "unitsSold"
          : "currentStock";
  return [...rows].sort(
    (left, right) =>
      (sort.startsWith("name")
        ? left.name.localeCompare(right.name)
        : money(left[field]).comparedTo(right[field])) * direction ||
      left.productId.localeCompare(right.productId),
  );
}

function monthlyRows(
  snapshot: Snapshot,
  products: SelectedProduct[],
  query: AccountingExportQuery,
) {
  const months: MonthlySummary["months"] = [];
  const cursor = new Date(
    Date.UTC(query.from.getUTCFullYear(), query.from.getUTCMonth(), 1),
  );
  while (cursor <= query.to) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const monthRange = calendarRange(year, month);
    const range = {
      from: new Date(Math.max(+query.from, +monthRange.from)),
      to: new Date(Math.min(+query.to, +monthRange.to)),
    };
    months.push({
      year,
      month,
      ...periodTotals(snapshot, products, { ...query, ...range }),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return {
    range: serializedRange(query),
    months,
    totals: periodTotals(snapshot, products, query),
  };
}

@Injectable()
export class FinanceReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recurring: RecurringExpensesService,
  ) {}

  async getDashboard(query: AccountingExportQuery): Promise<FinanceDashboard> {
    const snapshot = await this.read(query, true);
    return dashboard(snapshot, selectProducts(snapshot, query), query);
  }

  async getProducts(
    query: FinanceProductQuery,
  ): Promise<AdminList<FinanceProductRow>> {
    const pagination = { ...query, sort: query.sort ?? "nameAsc" };
    const offset = adminListOffset(pagination);
    const snapshot = await this.read(query);
    const rows = sortProducts(
      selectProducts(snapshot, query).map(({ row }) => row),
      query.sort ?? "nameAsc",
    );
    return adminListEnvelope(
      rows.slice(offset, offset + query.pageSize),
      rows.length,
      pagination,
    );
  }

  async getMonthlySummary(
    year: number,
    month?: number,
    filters: ReportFilters = {},
  ): Promise<MonthlySummary> {
    const query = { ...filters, ...calendarRange(year, month) };
    const snapshot = await this.read(query);
    return {
      year,
      ...(month === undefined ? {} : { month }),
      ...monthlyRows(snapshot, selectProducts(snapshot, query), query),
    };
  }

  async getProfitability(
    query: ProfitabilityQuery,
  ): Promise<AdminList<ProductProfitabilityRow>> {
    const products = await this.getProducts({
      ...query,
      sort: query.sort ?? "profitDesc",
    });
    return { ...products, items: products.items.map(profitability) };
  }

  async getExpenseBreakdown(
    query: AccountingExportQuery,
  ): Promise<ExpenseBreakdownRow[]> {
    const snapshot = await this.read(query, false, false);
    return breakdown(selectedExpenses(snapshot, query));
  }

  async getExportDataset(
    query: AccountingExportQuery,
  ): Promise<AccountingDataset> {
    const snapshot = await this.read(query, true);
    const selected = selectProducts(snapshot, query);
    const products = sortProducts(
      selected.map(({ row }) => row),
      query.sort ?? "nameAsc",
    );
    const expenses = selectedExpenses(snapshot, query);
    return {
      range: serializedRange(query),
      summary: dashboard(snapshot, selected, query),
      products,
      purchases: selected
        .flatMap(({ product, row }) =>
          product.purchaseItems
            .filter(
              (item) =>
                inRange(item.purchase.date, query) &&
                (!query.supplierId ||
                  item.purchase.supplierId === query.supplierId),
            )
            .map((item) => ({
              purchaseId: item.purchaseId,
              purchaseNumber: item.purchase.purchaseNumber,
              date: item.purchase.date.toISOString().slice(0, 10),
              supplierId: item.purchase.supplierId,
              supplierName: item.purchase.supplier.name,
              productId: product.id,
              sku: product.sku,
              name: row.name,
              quantity: item.quantity,
              purchaseUnitPrice: item.purchaseUnitPrice.toString(),
              totalCost: item.purchaseUnitPrice.mul(item.quantity).toString(),
            })),
        )
        .sort(
          (left, right) =>
            left.date.localeCompare(right.date) ||
            left.purchaseId.localeCompare(right.purchaseId) ||
            left.productId.localeCompare(right.productId),
        ),
      sales: saleRows(selected, query),
      expenses: expenses.map((expense) => ({
        id: expense.id,
        date: expense.date.toISOString().slice(0, 10),
        categoryId: expense.categoryId,
        categoryName:
          expense.recurringOccurrence?.categoryNameSnapshot ??
          expense.category.name,
        description: expense.description,
        amount: expense.amount.toString(),
        source: expense.source,
        paymentMethod: expense.paymentMethod,
        notes: expense.notes,
      })),
      monthlySummary: monthlyRows(snapshot, selected, query),
      profitability: products.map(profitability),
      expenseBreakdown: breakdown(expenses),
    };
  }

  private async read(
    query: AccountingExportQuery,
    withComparison = false,
    withProducts = true,
  ): Promise<Snapshot> {
    assertReportRange(query);
    const from = withComparison ? previousReportRange(query).from : query.from;
    // Capture one reporting instant for all attempts. A requested future range
    // must not freeze recurring templates before their occurrence dates arrive.
    const materializeThrough = new Date(Math.min(+query.to, Date.now()));
    // Materialization and reads share a consistent transaction. A losing
    // concurrent materializer rolls back and retries the entire snapshot.
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const cursor = new Date(
              Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
            );
            while (cursor <= materializeThrough) {
              await this.recurring.materializePeriod(
                tx,
                cursor.getUTCFullYear(),
                cursor.getUTCMonth() + 1,
                materializeThrough,
              );
              cursor.setUTCMonth(cursor.getUTCMonth() + 1);
            }
            const [products, expenses] = await Promise.all([
              withProducts
                ? tx.product.findMany({
                    include: productInclude,
                    orderBy: { id: "asc" },
                  })
                : Promise.resolve([]),
              tx.expense.findMany({
                where: {
                  date: { gte: from, lte: query.to },
                  ...(query.expenseCategoryId
                    ? { categoryId: query.expenseCategoryId }
                    : {}),
                },
                include: expenseInclude,
                orderBy: [{ date: "asc" }, { id: "asc" }],
              }),
            ]);
            return { products, expenses };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
        );
      } catch (error) {
        const retryable =
          error &&
          typeof error === "object" &&
          "code" in error &&
          ["P2002", "P2034"].includes(String(error.code));
        const adapterConflict =
          error instanceof Error &&
          error.name === "DriverAdapterError" &&
          error.cause !== null &&
          typeof error.cause === "object" &&
          "originalCode" in error.cause &&
          ["40001", "40P01"].includes(String(error.cause.originalCode));
        if (attempt < 2 && (retryable || adapterConflict)) continue;
        if (retryable || adapterConflict)
          throw new ConflictException(
            "A concurrent finance change prevented reporting; please retry",
          );
        rethrowCatalogConflict(error);
      }
    }
  }
}
