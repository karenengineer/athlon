import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import ExcelJS from "exceljs";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { Prisma } from "../src/generated/prisma/client";
import { reportingDatabase, reportIds } from "./finance-reporting-fixtures";

const binaryParser = (
  response: request.Response,
  callback: (error: Error | null, body: Buffer) => void,
): void => {
  const stream = response as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  stream.on("end", () => callback(null, Buffer.concat(chunks)));
  stream.on("error", (error: Error) => callback(error, Buffer.alloc(0)));
};

describe("Finance export HTTP contracts", () => {
  let app: INestApplication;
  let token: string;
  const database = reportingDatabase();
  const september = { dateFrom: "2026-09-01", dateTo: "2026-09-30" };

  const download = (
    file: string,
    query: Record<string, string | number> = september,
  ) =>
    request(app.getHttpServer())
      .get(`/api/v1/admin/finance/exports/${file}`)
      .query(query)
      .set("Cookie", [`athlon_access=${token}`]);

  beforeAll(async () => {
    const instagramSale = database.products[0]!.saleItems[0]!.sale;
    Object.assign(instagramSale, {
      saleNumber: "SAL-INSTAGRAM-SEPTEMBER",
      date: new Date("2026-09-15T00:00:00.000Z"),
      channel: "INSTAGRAM",
      trainerReferralCode: "SOCIAL-COACH",
    });
    database.products[0]!.saleItems.push({
      ...database.products[0]!.saleItems[0]!,
      id: "sale-gym-october-line",
      saleId: "sale-gym-october",
      quantity: 1,
      actualUnitPrice: new Prisma.Decimal(125000),
      lineDiscount: new Prisma.Decimal(0),
      sale: {
        ...instagramSale,
        id: "sale-gym-october",
        saleNumber: "SAL-GYM-OCTOBER",
        date: new Date("2026-10-01T00:00:00.000Z"),
        channel: "GYM",
        trainerReferralCode: "",
      },
    });

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
    "products.csv",
    "purchases.csv",
    "sales.csv",
    "expenses.csv",
    "monthly-summary.csv",
    "profitability.csv",
    "accounting.xlsx",
  ])("requires admin authentication for %s", async (file) => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/finance/exports/${file}`)
      .query(september)
      .expect(401);
  });

  it("returns a branded accounting workbook whose revenue equals the dashboard", async () => {
    const dashboard = await request(app.getHttpServer())
      .get("/api/v1/admin/finance/dashboard")
      .query(september)
      .set("Cookie", [`athlon_access=${token}`])
      .expect(200);
    const response = await download("accounting.xlsx")
      .buffer(true)
      .parse(binaryParser)
      .expect(200)
      .expect(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )
      .expect("Cache-Control", "no-store");
    expect(response.headers["content-disposition"]).toMatch(
      /^attachment; filename="athlon-accounting-[a-zA-Z0-9._-]+\.xlsx"$/,
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(response.body as Buffer).buffer);
    expect(workbook.worksheets.map(({ name }) => name)).toEqual([
      "Dashboard",
      "Products",
      "Purchases",
      "Sales",
      "Expenses",
      "Monthly Summary",
    ]);
    const dashboardSheet = workbook.getWorksheet("Dashboard")!;
    const revenueRow = dashboardSheet
      .getRows(1, dashboardSheet.rowCount)!
      .find((row) => row.getCell(1).value === "Revenue");
    expect(revenueRow?.getCell(2).value).toBe(Number(dashboard.body.revenue));
    expect(revenueRow?.getCell(2).numFmt).toBe('#,##0 "AMD"');
    const periodStartRow = dashboardSheet
      .getRows(1, dashboardSheet.rowCount)!
      .find((row) => row.getCell(1).value === "Period Start");
    expect(periodStartRow?.getCell(2).value).toEqual(
      new Date("2026-09-01T00:00:00.000Z"),
    );
    const currentStockRow = dashboardSheet
      .getRows(1, dashboardSheet.rowCount)!
      .find((row) => row.getCell(1).value === "Current Stock");
    expect(currentStockRow?.getCell(2).numFmt).not.toBe('#,##0 "AMD"');
    expect(dashboardSheet.views).toEqual(
      expect.arrayContaining([expect.objectContaining({ ySplit: 1 })]),
    );
    expect(dashboardSheet.getCell("A1").fill).toMatchObject({
      fgColor: { argb: "FF0A0A0A" },
    });
    expect(dashboardSheet.getCell("A1").font).toMatchObject({
      bold: true,
      color: { argb: "FFFFFFFF" },
    });
  });

  it("exports only the current view across date and finance filters", async () => {
    const instagram = await download("sales.csv", {
      ...september,
      channel: "INSTAGRAM",
      sort: "dateDesc",
    }).expect(200);
    expect(instagram.headers["content-type"]).toMatch(/^text\/csv/);
    expect(instagram.headers["content-disposition"]).toMatch(
      /^attachment; filename="athlon-sales-[a-zA-Z0-9._-]+\.csv"$/,
    );
    expect(instagram.headers["cache-control"]).toBe("no-store");
    expect(instagram.text).toContain("SAL-INSTAGRAM-SEPTEMBER");
    expect(instagram.text).not.toContain("SAL-GYM-OCTOBER");

    const singleDay = await download("sales.csv", {
      dateFrom: "2026-09-15",
      dateTo: "2026-09-15",
    }).expect(200);
    expect(singleDay.headers["content-disposition"]).toBe(
      'attachment; filename="athlon-sales-2026-09-15-to-2026-09-15.csv"',
    );

    const octoberInstagram = await download("sales.csv", {
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
      channel: "INSTAGRAM",
    }).expect(200);
    expect(octoberInstagram.text).not.toContain("SAL-GYM-OCTOBER");

    const supplier = await download("purchases.csv", {
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      supplierId: reportIds.supplier,
    }).expect(200);
    expect(supplier.text).toContain("A-01");
    expect(supplier.text).not.toContain("B-02");

    const product = await download("sales.csv", {
      ...september,
      productId: reportIds.product,
    }).expect(200);
    expect(product.text).toContain("A-01");
    expect(product.text).not.toContain("B-02");

    const category = await download("products.csv", {
      ...september,
      categoryId: reportIds.category,
    }).expect(200);
    expect(category.text).toContain("A-01");
    expect(category.text).not.toContain("B-02");

    const referral = await download("sales.csv", {
      ...september,
      trainerReferralCode: "SOCIAL-COACH",
    }).expect(200);
    expect(referral.text).toContain("SAL-INSTAGRAM-SEPTEMBER");

    const expenses = await download("expenses.csv", {
      ...september,
      categoryId: reportIds.expenseCategory,
    }).expect(200);
    expect(expenses.text).toContain("Operations");
    expect(expenses.text).toContain("One time");

    const otherExpenses = await download("expenses.csv", {
      ...september,
      categoryId: reportIds.otherCategory,
    }).expect(200);
    expect(otherExpenses.text).not.toContain("Operations");

    const monthly = await download("monthly-summary.csv", {
      year: 2026,
      month: 9,
    }).expect(200);
    expect(monthly.text).toContain("2026-09");
  });
});
