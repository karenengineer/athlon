import {
  reportingDatabase,
  reportIds,
} from "../../../test/finance-reporting-fixtures";
import { PrismaService } from "../../database/prisma.service";
import { ConflictException } from "@nestjs/common";
import { money } from "../domain/money";
import { RecurringExpensesService } from "../recurring/recurring-expenses.service";
import { FinanceReportingService } from "./finance-reporting.service";
import { normalizeReportRange, previousReportRange } from "./report-query.dto";

describe("authoritative finance reporting", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-09-21T12:00:00.000Z") });
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  const range = {
    from: new Date("2026-09-01T00:00:00.000Z"),
    to: new Date("2026-09-30T23:59:59.999Z"),
  };
  function setup() {
    const database = reportingDatabase();
    const prisma = database.prisma as unknown as PrismaService;
    return {
      ...database,
      service: new FinanceReportingService(
        prisma,
        new RecurringExpensesService(prisma),
      ),
    };
  }

  it("subtracts discounted line revenue, frozen COGS and materialized expenses exactly once", async () => {
    const { service, occurrences } = setup();
    const result = await service.getDashboard(range);
    expect(result).toMatchObject({
      revenue: "1000000",
      costOfGoodsSold: "600000",
      grossProfit: "400000",
      operatingExpenses: "60000",
      recurringExpenses: "40000",
      totalExpenses: "100000",
      netProfit: "300000",
      grossMarginPercent: "40",
      netMarginPercent: "30",
      unitsSold: 10,
      orderCount: 1,
      averageOrderValue: "1000000",
      inventoryValue: "120000",
    });
    expect(result.comparisons.revenue.comparisonPercent).toBeNull();
    expect((await service.getDashboard(range)).totalExpenses).toBe("100000");
    expect(occurrences.size).toBe(1);
  });

  it("annual reports materialize only due occurrences and leave future months open to template changes", async () => {
    const { service, prisma, template, occurrences } = setup();
    template.startDate = new Date("2026-01-25T00:00:00.000Z");
    template.endDate = new Date("2026-12-31T00:00:00.000Z");
    const recurring = new RecurringExpensesService(
      prisma as unknown as PrismaService,
    );

    const annual = await service.getMonthlySummary(2026);
    expect(annual.totals.recurringExpenses).toBe("320000");
    expect(
      annual.months.slice(8).map((month) => month.recurringExpenses),
    ).toEqual(["0", "0", "0", "0"]);
    expect(occurrences.size).toBe(8);
    expect(
      (await service.getDashboard(normalizeReportRange({ period: "thisYear" })))
        .recurringExpenses,
    ).toBe("320000");

    await recurring.update(template.id, { amount: "50000" });
    jest.setSystemTime(new Date("2026-09-25T00:00:00.000Z"));
    const dueToday = await service.getMonthlySummary(2026);
    expect(dueToday.totals.recurringExpenses).toBe("370000");
    expect(dueToday.months[8]!.recurringExpenses).toBe("50000");
    expect(occurrences.size).toBe(9);

    await recurring.update(template.id, { amount: "70000" });
    jest.setSystemTime(new Date("2026-10-25T00:00:00.000Z"));
    const october = await service.getMonthlySummary(2026);
    expect(october.months[8]!.recurringExpenses).toBe("50000");
    expect(october.months[9]!.recurringExpenses).toBe("70000");
    expect(october.totals.recurringExpenses).toBe("440000");
    expect(occurrences.size).toBe(10);

    await recurring.update(template.id, { active: false });
    jest.setSystemTime(new Date("2026-12-31T12:00:00.000Z"));
    expect(
      (await service.getMonthlySummary(2026)).totals.recurringExpenses,
    ).toBe("440000");
    expect(occurrences.size).toBe(10);
  });

  it("uses matching sale lines and preserves current inventory under period/channel filters", async () => {
    const { service } = setup();
    const result = await service.getProducts({
      ...range,
      productId: reportIds.product,
      locale: "EN",
      page: 1,
      pageSize: 24,
    });
    expect(result.items[0]).toMatchObject({
      sku: "A-01",
      name: "English A",
      category: { name: "Equipment" },
      defaultSalePrice: "150000",
      weightedAverageBuyPrice: "60000",
      totalPurchased: 8,
      totalSold: 6,
      currentStock: 2,
      profitPerUnit: "90000",
      marginPercent: "60",
      inventoryValue: "120000",
      realizedRevenue: "600000",
      realizedGrossProfit: "240000",
      stockStatus: "LOW_STOCK",
    });
    const filtered = await service.getDashboard({
      ...range,
      productId: reportIds.product,
    });
    expect(filtered.revenue).toBe("600000");
    expect(filtered.orderCount).toBe(1);
    const empty = await service.getDashboard({ ...range, channel: "DIRECT" });
    expect(empty).toMatchObject({
      revenue: "0",
      grossMarginPercent: "0",
      netMarginPercent: "0",
      averageOrderValue: "0",
      orderCount: 0,
      inventoryValue: "120000",
    });
  });

  it("shares totals across monthly summaries, profitability, breakdown and unpaginated accounting data", async () => {
    const { service } = setup();
    const summary = await service.getMonthlySummary(2026, 9);
    expect(summary.totals.netProfit).toBe("300000");
    expect(summary.months).toHaveLength(1);
    expect(
      (
        await service.getProfitability({
          ...range,
          sort: "marginDesc",
          page: 1,
          pageSize: 1,
        })
      ).items[0],
    ).toMatchObject({
      productId: reportIds.product,
      revenue: "600000",
      grossProfit: "240000",
      grossMarginPercent: "40",
    });
    expect(await service.getExpenseBreakdown(range)).toEqual([
      {
        categoryId: reportIds.expenseCategory,
        categoryName: "Operations",
        amount: "100000",
        percentage: "100",
      },
    ]);
    const dataset = await service.getExportDataset(range);
    expect(dataset.summary.netProfit).toBe(summary.totals.netProfit);
    expect(dataset.products).toHaveLength(2);
    expect(dataset.sales).toHaveLength(2);
    expect(dataset.purchases).toHaveLength(0);
    expect(dataset.expenses).toHaveLength(2);
    expect(dataset.monthlySummary.months[0]!.revenue).toBe("1000000");
  });

  it("excludes expenses and sales outside inclusive UTC dates", async () => {
    const { service } = setup();
    const lastDay = await service.getDashboard(
      normalizeReportRange({ dateFrom: "2026-09-30", dateTo: "2026-09-30" }),
    );
    expect(lastDay).toMatchObject({
      revenue: "0",
      totalExpenses: "60000",
      recurringExpenses: "0",
    });
    const year = await service.getMonthlySummary(2026);
    expect(year.months).toHaveLength(12);
    expect(year.totals.revenue).toBe("1000000");
  });

  it("uses stored six-decimal COGS and exact fractional transaction prices", async () => {
    const { service, products } = setup();
    const a = products[0]!.saleItems[0]!;
    const b = products[1]!.saleItems[0]!;
    a.actualUnitPrice = money("0.10");
    a.lineDiscount = money("0.01");
    a.costUnitSnapshot = money("0.030001");
    b.actualUnitPrice = money("0.20");
    b.costUnitSnapshot = money("0.04");
    expect(await service.getDashboard(range)).toMatchObject({
      revenue: "1.39",
      costOfGoodsSold: "0.340006",
      grossProfit: "1.049994",
    });
  });

  it("uses distinct sale IDs when two sales share an external order reference", async () => {
    const { service, products } = setup();
    const b = products[1]!.saleItems[0]!;
    b.saleId = "second-sale";
    b.sale = { ...b.sale, id: "second-sale" };
    expect(await service.getDashboard(range)).toMatchObject({
      orderCount: 2,
      averageOrderValue: "500000",
    });
  });

  it("compares the preceding calendar month with a nonzero baseline", async () => {
    const { service, products } = setup();
    const b = products[1]!.saleItems[0]!;
    b.sale = { ...b.sale, date: new Date("2026-08-31T00:00:00.000Z") };
    const result = await service.getDashboard(range);
    expect(result.comparisons.revenue).toMatchObject({
      previousValue: "400000",
      comparisonPercent: "50",
    });
    expect(result.comparisons.netProfit.comparisonPercent).toBe("-12.5");
  });

  it("replays replenishment costs without changing historical realized profit", async () => {
    const { service, products } = setup();
    const product = products[0]!;
    const purchase = product.purchaseItems[0]!;
    product.purchaseItems.push({
      ...purchase,
      id: "replenishment",
      purchaseId: "replenishment",
      quantity: 2,
      purchaseUnitPrice: money(120000),
      purchase: {
        ...purchase.purchase,
        id: "replenishment",
        date: new Date("2026-09-02T00:00:00.000Z"),
      },
    });
    const result = await service.getProducts({
      ...range,
      productId: product.id,
      page: 1,
      pageSize: 24,
    });
    expect(result.items[0]).toMatchObject({
      currentStock: 4,
      weightedAverageBuyPrice: "90000",
      inventoryValue: "360000",
      stockStatus: "IN_STOCK",
      realizedGrossProfit: "240000",
    });
  });

  it("returns undefined expense percentages safely when category totals are zero", async () => {
    const { service, expenses } = setup();
    expenses[0]!.amount = money(0);
    expect(
      await service.getExpenseBreakdown(
        normalizeReportRange({ dateFrom: "2026-09-30", dateTo: "2026-09-30" }),
      ),
    ).toEqual([
      {
        categoryId: reportIds.expenseCategory,
        categoryName: "Operations",
        amount: "0",
        percentage: null,
      },
    ]);
  });

  it.each([
    ["revenueDesc", reportIds.product],
    ["revenueAsc", reportIds.otherProduct],
    ["profitDesc", reportIds.product],
    ["profitAsc", reportIds.otherProduct],
    ["marginDesc", reportIds.otherProduct],
    ["marginAsc", reportIds.product],
    ["unitsSoldDesc", reportIds.product],
    ["unitsSoldAsc", reportIds.otherProduct],
    ["stockAsc", reportIds.otherProduct],
    ["stockDesc", reportIds.product],
  ] as const)(
    "orders profitability by %s before paging",
    async (sort, productId) => {
      const { service, products } = setup();
      products[0]!.saleItems[0]!.costUnitSnapshot = money(70000);
      const result = await service.getProfitability({
        ...range,
        sort,
        page: 1,
        pageSize: 1,
      });
      expect(result.items[0]!.productId).toBe(productId);
      expect(result.meta).toMatchObject({ total: 2, totalPages: 2 });
    },
  );

  it("preserves export sorting, purchase lines and product filters without pagination", async () => {
    const { service } = setup();
    const query = {
      ...normalizeReportRange({ dateFrom: "2026-08-01", dateTo: "2026-09-30" }),
      sort: "revenueAsc" as const,
    };
    const dataset = await service.getExportDataset(query);
    expect(dataset.products.map((row) => row.productId)).toEqual([
      reportIds.otherProduct,
      reportIds.product,
    ]);
    expect(dataset.purchases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purchaseId: "purchase",
          productId: reportIds.product,
          totalCost: "480000",
        }),
      ]),
    );
    const filtered = await service.getExportDataset({
      ...query,
      supplierId: reportIds.supplier,
    });
    expect(filtered.products).toHaveLength(1);
    expect(filtered.purchases).toHaveLength(1);
    expect(filtered.sales).toHaveLength(1);
    expect(filtered.summary.revenue).toBe("600000");
  });

  it("retries a concurrent occurrence creation and returns a complete snapshot", async () => {
    const { service, prisma } = setup();
    jest.spyOn(prisma, "$transaction").mockRejectedValueOnce({ code: "P2002" });
    expect((await service.getDashboard(range)).totalExpenses).toBe("100000");
  });

  it("reports an exhausted materialization race as a retryable conflict", async () => {
    const { service, prisma } = setup();
    jest.spyOn(prisma, "$transaction").mockRejectedValue({ code: "P2002" });
    await expect(service.getDashboard(range)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe("UTC reporting ranges", () => {
  const now = new Date("2026-03-15T23:05:00-07:00");
  it.each([
    ["today", "2026-03-16T00:00:00.000Z", "2026-03-16T23:59:59.999Z"],
    ["thisMonth", "2026-03-01T00:00:00.000Z", "2026-03-31T23:59:59.999Z"],
    ["previousMonth", "2026-02-01T00:00:00.000Z", "2026-02-28T23:59:59.999Z"],
    ["thisYear", "2026-01-01T00:00:00.000Z", "2026-12-31T23:59:59.999Z"],
  ] as const)("normalizes %s", (period, from, to) => {
    expect(normalizeReportRange({ period }, now)).toEqual({
      from: new Date(from),
      to: new Date(to),
    });
  });
  it("uses previous calendar month and leap day boundaries", () => {
    expect(
      previousReportRange(
        normalizeReportRange({ dateFrom: "2024-03-01", dateTo: "2024-03-31" }),
      ),
    ).toEqual({
      from: new Date("2024-02-01T00:00:00.000Z"),
      to: new Date("2024-02-29T23:59:59.999Z"),
    });
  });
  it.each([
    { dateFrom: "2026-09-02", dateTo: "2026-09-01" },
    { dateFrom: "2026-02-30", dateTo: "2026-03-01" },
    { dateFrom: "2026-01-01" },
    { period: "custom" as const },
  ])("rejects invalid or incomplete range %j", (query) => {
    expect(() => normalizeReportRange(query)).toThrow();
  });
});
