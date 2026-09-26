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
      customerName: "Alice Athlete",
      customerPhone: "+374 00 000000",
    });
    database.products[0]!.saleItems.push({
      ...database.products[0]!.saleItems[0]!,
      id: "sale-gym-october-line",
      saleId: "sale-gym-october",
      quantity: 1,
      actualUnitPrice: new Prisma.Decimal(500000),
      lineDiscount: new Prisma.Decimal(0),
      sale: {
        ...instagramSale,
        id: "sale-gym-october",
        saleNumber: "SAL-GYM-OCTOBER",
        date: new Date("2026-10-01T00:00:00.000Z"),
        channel: "GYM",
        trainerReferralCode: "",
        customerName: null,
        customerPhone: null,
      },
    });

    const originalPurchase = database.products[0]!.purchaseItems[0]!.purchase;
    const groupPurchase = {
      ...originalPurchase,
      id: "purchase-group",
      purchaseNumber: "PUR-GROUP",
      date: new Date("2026-10-01T00:00:00.000Z"),
      createdAt: new Date("2026-10-01T09:00:00.000Z"),
    };
    database.products[0]!.purchaseItems.push({
      ...database.products[0]!.purchaseItems[0]!,
      id: "purchase-group-a",
      purchaseId: groupPurchase.id,
      quantity: 4,
      purchaseUnitPrice: new Prisma.Decimal(100000),
      purchase: groupPurchase,
    });
    database.products[1]!.purchaseItems.push({
      ...database.products[1]!.purchaseItems[0]!,
      id: "purchase-group-b",
      purchaseId: groupPurchase.id,
      quantity: 2,
      purchaseUnitPrice: new Prisma.Decimal(100000),
      purchase: groupPurchase,
    });
    const middlePurchase = {
      ...originalPurchase,
      id: "purchase-middle",
      purchaseNumber: "PUR-MIDDLE",
      date: new Date("2026-10-02T00:00:00.000Z"),
      createdAt: new Date("2026-10-02T09:00:00.000Z"),
    };
    database.products[0]!.purchaseItems.push({
      ...database.products[0]!.purchaseItems[0]!,
      id: "purchase-middle-a",
      purchaseId: middlePurchase.id,
      quantity: 5,
      purchaseUnitPrice: new Prisma.Decimal(100000),
      purchase: middlePurchase,
    });

    const expenseCategory = database.expenses[0]!.category;
    database.expenses.push(
      {
        ...database.expenses[0]!,
        id: "expense-z-later",
        date: new Date("2026-09-20T00:00:00.000Z"),
        createdAt: new Date("2026-09-20T11:00:00.000Z"),
        category: expenseCategory,
        description: "Later created expense",
        amount: new Prisma.Decimal(70000),
      },
      {
        ...database.expenses[0]!,
        id: "expense-a-earlier",
        date: new Date("2026-09-20T00:00:00.000Z"),
        createdAt: new Date("2026-09-20T10:00:00.000Z"),
        category: expenseCategory,
        description: "Earlier created expense",
        amount: new Prisma.Decimal(70000),
      },
      {
        ...database.expenses[0]!,
        id: "expense-october",
        date: new Date("2026-10-03T00:00:00.000Z"),
        createdAt: new Date("2026-10-03T10:00:00.000Z"),
        category: expenseCategory,
        description: "October expense",
        amount: new Prisma.Decimal(80000),
      },
    );

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

  it.each(["purchases.csv", "sales.csv", "expenses.csv"])(
    "rejects reversed current-view dates for %s",
    async (file) => {
      await download(file, {
        dateFrom: "2026-10-01",
        dateTo: "2026-09-30",
      }).expect(400);
    },
  );

  it("returns a branded accounting workbook whose revenue equals the dashboard", async () => {
    const dashboard = await request(app.getHttpServer())
      .get("/api/v1/admin/finance/dashboard")
      .query(september)
      .set("Cookie", [`athlon_access=${token}`])
      .expect(200);
    const precisionPurchase = database.products[0]!.purchaseItems[0]!;
    const previousInventoryValue = precisionPurchase.purchaseUnitPrice;
    const previousPurchaseDate = precisionPurchase.purchase.date;
    precisionPurchase.purchaseUnitPrice = new Prisma.Decimal(
      "9008999999990991",
    );
    precisionPurchase.purchase.date = new Date("2026-09-02T00:00:00.000Z");
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
    expect(workbook.worksheets.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "Dashboard",
        "Products",
        "Purchases",
        "Sales",
        "Expenses",
        "Monthly Summary",
        "Expenses by Category",
      ]),
    );
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
    const expenseCategorySheet = workbook.getWorksheet("Expenses by Category")!;
    const operationsRow = expenseCategorySheet
      .getRows(1, expenseCategorySheet.rowCount)!
      .find((row) => row.getCell(1).value === "Operations");
    expect(operationsRow?.getCell(2).value).toBe(
      Number(dashboard.body.totalExpenses),
    );
    const purchasesSheet = workbook.getWorksheet("Purchases")!;
    const highValueRow = purchasesSheet
      .getRows(1, purchasesSheet.rowCount)!
      .find((row) => row.getCell(7).value === "9008999999990991");
    expect(highValueRow?.getCell(7).value).toBe("9008999999990991");
    precisionPurchase.purchaseUnitPrice = previousInventoryValue;
    precisionPurchase.purchase.date = previousPurchaseDate;
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
    expect(product.text).toContain("B-02");

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

  it("preserves open date bounds, transaction-level sorting and list search semantics", async () => {
    const allSales = await download("sales.csv", {
      sort: "revenueAsc",
    }).expect(200);
    const saleNumbers = allSales.text
      .split("\r\n")
      .slice(1)
      .map((row) => row.split(",")[1]);
    expect(saleNumbers).toEqual([
      "SAL-GYM-OCTOBER",
      "SAL-INSTAGRAM-SEPTEMBER",
      "SAL-INSTAGRAM-SEPTEMBER",
    ]);

    const fromOnly = await download("sales.csv", {
      dateFrom: "2026-10-01",
    }).expect(200);
    expect(fromOnly.text).toContain("SAL-GYM-OCTOBER");
    expect(fromOnly.text).not.toContain("SAL-INSTAGRAM-SEPTEMBER");

    const customerSearch = await download("sales.csv", {
      dateTo: "2026-09-30",
      q: "Alice Athlete",
    }).expect(200);
    expect(customerSearch.text).toContain("SAL-INSTAGRAM-SEPTEMBER");
    expect(customerSearch.text).not.toContain("SAL-GYM-OCTOBER");

    const customerPhoneSearch = await download("sales.csv", {
      q: "+374 00 000000",
    }).expect(200);
    expect(customerPhoneSearch.text).toContain("SAL-INSTAGRAM-SEPTEMBER");
    expect(customerPhoneSearch.text).not.toContain("SAL-GYM-OCTOBER");

    const purchases = await download("purchases.csv", {
      dateFrom: "2026-10-01",
      sort: "totalAsc",
    }).expect(200);
    const purchaseNumbers = purchases.text
      .split("\r\n")
      .slice(1)
      .map((row) => row.split(",")[1]);
    expect(purchaseNumbers).toEqual(["PUR-MIDDLE", "PUR-GROUP", "PUR-GROUP"]);

    const allPurchases = await download("purchases.csv", {
      sort: "dateDesc",
    }).expect(200);
    expect(allPurchases.text).toContain("PUR-1");
    expect(allPurchases.text).toContain("PUR-GROUP");

    const oldPurchases = await download("purchases.csv", {
      dateTo: "2026-08-31",
    }).expect(200);
    expect(oldPurchases.text).toContain("PUR-1");
    expect(oldPurchases.text).not.toContain("PUR-GROUP");

    const octoberExpenses = await download("expenses.csv", {
      dateFrom: "2026-10-01",
    }).expect(200);
    expect(octoberExpenses.text).toContain("October expense");
    expect(octoberExpenses.text).not.toContain("One time");

    const allExpenses = await download("expenses.csv", {}).expect(200);
    expect(allExpenses.text).toContain("One time");
    expect(allExpenses.text).toContain("October expense");

    const throughSeptember = await download("expenses.csv", {
      dateTo: "2026-09-30",
    }).expect(200);
    expect(throughSeptember.text).toContain("One time");
    expect(throughSeptember.text).not.toContain("October expense");

    const septemberTie = await download("expenses.csv", {
      dateTo: "2026-09-20",
      dateFrom: "2026-09-20",
      sort: "dateDesc",
    }).expect(200);
    expect(septemberTie.text.indexOf("Later created expense")).toBeLessThan(
      septemberTie.text.indexOf("Earlier created expense"),
    );
  });
});
