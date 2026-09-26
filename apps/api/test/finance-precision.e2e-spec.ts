import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { Prisma } from "../src/generated/prisma/client";
import { reportingDatabase, reportIds } from "./finance-reporting-fixtures";

describe("Finance report monetary precision", () => {
  let app: INestApplication;
  let token: string;
  const database = reportingDatabase();

  beforeAll(async () => {
    const product = database.products[0]!;
    database.products.splice(1);
    database.expenses.splice(0);
    product.purchaseItems[0]!.quantity = 10;
    product.purchaseItems[0]!.purchaseUnitPrice = new Prisma.Decimal(12000);
    product.purchaseItems.push({
      ...product.purchaseItems[0]!,
      id: "purchase-second",
      purchaseId: "purchase-second",
      quantity: 5,
      purchaseUnitPrice: new Prisma.Decimal(13000),
      purchase: {
        ...product.purchaseItems[0]!.purchase,
        id: "purchase-second",
      },
    });
    product.saleItems[0]!.quantity = 2;
    product.saleItems[0]!.actualUnitPrice = new Prisma.Decimal(16000);
    product.saleItems[0]!.lineDiscount = new Prisma.Decimal(0);
    product.saleItems[0]!.costUnitSnapshot = new Prisma.Decimal("12333.333333");
    product.saleItems.push({
      ...product.saleItems[0]!,
      id: "sale-second-line",
      saleId: "sale-second",
      quantity: 1,
      actualUnitPrice: new Prisma.Decimal(15000),
      sale: { ...product.saleItems[0]!.sale, id: "sale-second" },
    });
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

  it("rounds aggregate COGS, profit, and CSV to cents after unit-cost replay", async () => {
    const query = { dateFrom: "2026-09-01", dateTo: "2026-09-30" };
    const get = (suffix: string) =>
      request(app.getHttpServer())
        .get(`/api/v1/admin/finance/${suffix}`)
        .query(query)
        .set("Cookie", [`athlon_access=${token}`]);
    const dashboard = await get("dashboard").expect(200);
    expect(dashboard.body).toMatchObject({
      revenue: "47000",
      costOfGoodsSold: "37000",
      grossProfit: "10000",
    });
    const exportResult = await request(app.getHttpServer())
      .get("/api/v1/admin/finance/exports/monthly-summary.csv")
      .query({ year: 2026, month: 9 })
      .set("Cookie", [`athlon_access=${token}`])
      .expect(200);
    expect(exportResult.text).toContain("2026-09,47000,37000,10000");
  });
});
