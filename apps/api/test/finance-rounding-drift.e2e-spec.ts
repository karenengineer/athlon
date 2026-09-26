import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { Prisma } from "../src/generated/prisma/client";
import { reportingDatabase, reportIds } from "./finance-reporting-fixtures";

describe("Finance aggregate rounding", () => {
  let app: INestApplication;
  let token: string;
  const database = reportingDatabase();

  beforeAll(async () => {
    const product = database.products[0]!;
    database.products.splice(1);
    database.expenses.splice(0);
    const first = product.saleItems[0]!;
    first.quantity = 1;
    first.actualUnitPrice = new Prisma.Decimal(1);
    first.lineDiscount = new Prisma.Decimal(0);
    first.costUnitSnapshot = new Prisma.Decimal("0.333333");
    product.saleItems.push(
      ...[2, 3].map((index) => ({
        ...first,
        id: `sale-line-${index}`,
        saleId: `sale-${index}`,
        sale: { ...first.sale, id: `sale-${index}` },
      })),
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(database.prisma)
      .compile();
    app = configureApplication(module.createNestApplication());
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
  afterAll(async () => app?.close());

  it("sums three six-decimal costs before rounding dashboard, product and monthly export totals", async () => {
    const get = (suffix: string, query: Record<string, string | number>) =>
      request(app.getHttpServer())
        .get(`/api/v1/admin/finance/${suffix}`)
        .query(query)
        .set("Cookie", [`athlon_access=${token}`]);
    const range = { dateFrom: "2026-09-01", dateTo: "2026-09-30" };
    const expected = {
      revenue: "3",
      costOfGoodsSold: "1",
      grossProfit: "2",
    };
    const dashboard = await get("dashboard", range).expect(200);
    expect(dashboard.body).toMatchObject(expected);
    const products = await get("products", range).expect(200);
    expect(products.body.items[0]).toMatchObject({
      realizedRevenue: "3",
      realizedCostOfGoodsSold: "1",
      realizedGrossProfit: "2",
    });
    const monthly = await get("monthly-summary", {
      year: 2026,
      month: 9,
    }).expect(200);
    expect(monthly.body.totals).toMatchObject(expected);
    const csv = await get("exports/monthly-summary.csv", {
      year: 2026,
      month: 9,
    }).expect(200);
    expect(csv.text).toContain("2026-09,3,1,2");
  });
});
