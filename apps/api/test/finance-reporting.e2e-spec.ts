import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { reportingDatabase, reportIds } from "./finance-reporting-fixtures";

describe("Finance reporting HTTP contracts", () => {
  let app: INestApplication;
  let token: string;
  const database = reportingDatabase();
  const range = { dateFrom: "2026-09-01", dateTo: "2026-09-30" };
  const get = (path: string, query: Record<string, string | number> = range) =>
    request(app.getHttpServer())
      .get(`/api/v1/admin/finance/${path}`)
      .query(query)
      .set("Cookie", [`athlon_access=${token}`]);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(database.prisma)
      .compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
    token = new JwtService().sign(
      {
        sub: reportIds.admin,
        email: "admin@athlon.test",
        role: "ADMIN",
        type: "access",
      },
      { secret: "test-access-secret-with-at-least-32-characters" },
    );
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each([
    "dashboard",
    "products",
    "monthly-summary",
    "profitability",
    "expense-breakdown",
  ])("requires admin authentication for %s", async (path) => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/finance/${path}`)
      .expect(401);
  });

  it("serves consistent monetary strings and distinct order totals", async () => {
    const dashboard = await get("dashboard").expect(200);
    expect(dashboard.body).toMatchObject({
      revenue: "1000000",
      grossProfit: "400000",
      totalExpenses: "100000",
      netProfit: "300000",
      orderCount: 1,
    });
    const summary = await get("monthly-summary", {
      year: 2026,
      month: 9,
    }).expect(200);
    expect(summary.body.totals.netProfit).toBe(dashboard.body.netProfit);
    const breakdown = await get("expense-breakdown").expect(200);
    expect(breakdown.body[0]).toMatchObject({
      amount: "100000",
      percentage: "100",
    });
  });

  it.each([
    { productId: reportIds.product },
    { categoryId: reportIds.category },
    { supplierId: reportIds.supplier },
    {
      productId: reportIds.product,
      categoryId: reportIds.category,
      supplierId: reportIds.supplier,
      channel: "TRAINER",
      trainerReferralCode: "COACH",
    },
  ])(
    "filters sale lines without counting other items in the same order: %j",
    async (filter) => {
      const result = await get("dashboard", { ...range, ...filter }).expect(
        200,
      );
      expect(result.body).toMatchObject({
        revenue: "600000",
        costOfGoodsSold: "360000",
        unitsSold: 6,
        orderCount: 1,
      });
      const profitability = await get("profitability", {
        ...range,
        ...filter,
      }).expect(200);
      expect(profitability.body.meta.total).toBe(1);
    },
  );

  it.each([
    { channel: "DIRECT" },
    { trainerReferralCode: "UNKNOWN" },
    { dateFrom: "2026-10-01", dateTo: "2026-10-31" },
  ])("excludes nonmatching sales: %j", async (filter) => {
    const result = await get("dashboard", { ...range, ...filter }).expect(200);
    expect(result.body.revenue).toBe("0");
  });

  it("filters stock, searches names and sorts before paginating", async () => {
    const result = await get("products", {
      ...range,
      stockStatus: "OUT_OF_STOCK",
      q: "B-02",
      locale: "EN",
    }).expect(200);
    expect(result.body.items[0]).toMatchObject({
      sku: "B-02",
      currentStock: 0,
      name: "English B",
    });
    const sorted = await get("profitability", {
      ...range,
      sort: "revenueDesc",
      pageSize: 1,
      page: 2,
    }).expect(200);
    expect(sorted.body).toMatchObject({
      items: [{ productId: reportIds.otherProduct }],
      meta: { total: 2, totalPages: 2 },
    });
  });

  it("includes the last day and applies expense-category filters", async () => {
    const lastDay = await get("dashboard", {
      dateFrom: "2026-09-30",
      dateTo: "2026-09-30",
    }).expect(200);
    expect(lastDay.body).toMatchObject({
      revenue: "0",
      totalExpenses: "60000",
    });
    const result = await get("expense-breakdown", {
      ...range,
      expenseCategoryId: reportIds.otherCategory,
    }).expect(200);
    expect(result.body).toEqual([]);
  });

  it.each([
    ["dashboard", { dateFrom: "2026-02-30", dateTo: "2026-03-01" }],
    ["dashboard", { dateFrom: "2026-09-30", dateTo: "2026-09-01" }],
    ["dashboard", { dateFrom: "2026-09-01" }],
    ["dashboard", { period: "unknown" }],
    ["dashboard", { channel: "unknown" }],
    ["products", { pageSize: "101" }],
    ["profitability", { sort: "unknown" }],
    ["monthly-summary", { year: "2026", month: "13" }],
    ["monthly-summary", { year: "2026.5" }],
    [
      "monthly-summary",
      { year: "2026", dateFrom: "2025-01-01", dateTo: "2025-12-31" },
    ],
  ])("rejects malformed %s query %j", async (path, query) => {
    await get(path, query).expect(400);
  });
});
