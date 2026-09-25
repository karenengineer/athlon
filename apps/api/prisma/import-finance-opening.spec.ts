import { Prisma } from "../src/generated/prisma/client";
import { importFinanceOpening } from "./import-finance-opening";
import { financeOpeningData } from "./finance-opening-data";

function statefulDatabase() {
  const products = financeOpeningData.map((row, index) => ({
    id: `product-${index}`,
    sku: row.sku,
    price: new Prisma.Decimal(row.defaultSalePrice),
  }));
  const purchases = new Map<
    string,
    {
      date: Date;
      createdAt: Date;
      items: Array<{
        id: string;
        productId: string;
        quantity: number;
        purchaseUnitPrice: Prisma.Decimal;
      }>;
    }
  >();
  const sales = new Map<
    string,
    {
      date: Date;
      createdAt: Date;
      items: Array<{
        id: string;
        productId: string;
        quantity: number;
        costUnitSnapshot: Prisma.Decimal;
      }>;
    }
  >();
  const tx = {
    adminUser: { findFirst: jest.fn().mockResolvedValue({ id: "admin-1" }) },
    supplier: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "supplier-1" }),
    },
    purchase: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(purchases.get(where.importKey) ?? null),
      ),
      create: jest.fn(({ data }: any) => {
        const purchase = { ...data, items: data.items.create };
        purchases.set(data.importKey, purchase);
        return Promise.resolve(purchase);
      }),
    },
    sale: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(sales.get(where.importKey) ?? null),
      ),
      create: jest.fn(({ data }: any) => {
        const sale = { ...data, items: data.items.create };
        sales.set(data.importKey, sale);
        return Promise.resolve(sale);
      }),
    },
    purchaseItem: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          [...purchases.values()].flatMap((purchase) =>
            purchase.items
              .filter((item: any) => item.productId === where.productId)
              .map((item: any) => ({
                ...item,
                purchase: {
                  date: purchase.date,
                  createdAt: purchase.createdAt,
                },
              })),
          ),
        ),
      ),
    },
    saleItem: {
      findMany: jest.fn(({ where }: any) =>
        Promise.resolve(
          [...sales.values()].flatMap((sale) =>
            sale.items
              .filter((item: any) => item.productId === where.productId)
              .map((item: any) => ({
                ...item,
                sale: { date: sale.date, createdAt: sale.createdAt },
              })),
          ),
        ),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    product: { findMany: jest.fn().mockResolvedValue(products) },
    $transaction: jest.fn(
      (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
  return { prisma, products, purchases, sales };
}

describe("opening finance import", () => {
  it("matches the approved source totals before writing", async () => {
    const rows = financeOpeningData.map((row, index) => ({
      id: `product-${index}`,
      sku: row.sku,
      price: new Prisma.Decimal(row.defaultSalePrice),
    }));
    const prisma = {
      product: { findMany: jest.fn().mockResolvedValue(rows) },
      purchase: { findUnique: jest.fn().mockResolvedValue(null) },
      sale: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    };

    const result = await importFinanceOpening(prisma as never, {
      dryRun: true,
    });

    expect(result.totals).toMatchObject({
      skuCount: 25,
      unitsPurchased: 143,
      unitsSold: 2,
      currentStock: 141,
      purchaseCost: "1061840",
      inventoryValue: "1035840",
      revenue: "37000",
      costOfGoodsSold: "26000",
      grossProfit: "11000",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates one opening purchase and two sales only once and reconciles stored entries", async () => {
    const db = statefulDatabase();
    const first = await importFinanceOpening(db.prisma as never);
    const second = await importFinanceOpening(db.prisma as never);

    expect(first.createdPurchases).toBe(1);
    expect(first.createdSales).toBe(2);
    expect(second.createdPurchases).toBe(0);
    expect(second.createdSales).toBe(0);
    expect(db.purchases.size).toBe(1);
    expect(db.sales.size).toBe(2);
    expect(second.totals).toMatchObject({
      unitsPurchased: 143,
      unitsSold: 2,
      currentStock: 141,
      inventoryValue: "1035840",
      revenue: "37000",
      costOfGoodsSold: "26000",
      grossProfit: "11000",
    });
    expect(second.mismatches).toEqual([]);
    expect(db.products[0]?.price.toString()).toBe("24000");
  });

  it("reports missing SKUs in dry run without starting a transaction", async () => {
    const db = statefulDatabase();
    db.prisma.product.findMany.mockResolvedValue(db.products.slice(1));
    const result = await importFinanceOpening(db.prisma as never, {
      dryRun: true,
    });
    expect(result.missingSkus).toEqual(["TRPRCH"]);
    expect(result.mismatches).toContain("Missing SKU: TRPRCH");
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("preserves a catalog price that differs from the opening source", async () => {
    const db = statefulDatabase();
    db.products[0]!.price = new Prisma.Decimal("25000");

    const result = await importFinanceOpening(db.prisma as never);

    expect(result.priceDiscrepancies).toEqual([
      { sku: "TRPRCH", catalogPrice: "25000", sourcePrice: "24000" },
    ]);
    expect(db.products[0]!.price.toString()).toBe("25000");
    expect(result.mismatches).toEqual([]);
  });

  it("reports stored sale discrepancies on a repeat run", async () => {
    const db = statefulDatabase();
    await importFinanceOpening(db.prisma as never);
    const sale = db.sales.get("opening-sale-TRPRCH-2026-09-20");
    sale!.items[0]!.quantity = 2;

    const result = await importFinanceOpening(db.prisma as never);

    expect(result.createdPurchases).toBe(0);
    expect(result.createdSales).toBe(0);
    expect(result.mismatches).toContain(
      "TRPRCH: sold units, stock, inventory value, revenue, COGS",
    );
  });
});
