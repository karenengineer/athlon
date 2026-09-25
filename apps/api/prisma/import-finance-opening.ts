import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { Pool } from "pg";
import {
  Prisma,
  PrismaClient,
  SaleSourceType,
  SalesChannel,
} from "../src/generated/prisma/client";
import { InventoryLedgerService } from "../src/finance/inventory/inventory-ledger.service";
import {
  financeOpeningData,
  type FinanceOpeningRow,
} from "./finance-opening-data";

const openingDate = new Date("2026-09-20T00:00:00.000Z");
const purchaseKey = "opening-purchase-2026-09-20";
const saleKey = (sku: string) => `opening-sale-${sku}-2026-09-20`;
const decimal = (value: string | number) => new Prisma.Decimal(value);

export interface OpeningSkuResult {
  sku: string;
  unitsPurchased: number;
  unitsSold: number;
  currentStock: number;
  inventoryValue: string;
  revenue: string;
  costOfGoodsSold: string;
  grossProfit: string;
  mismatches: string[];
}

export interface OpeningTotals {
  skuCount: number;
  unitsPurchased: number;
  unitsSold: number;
  currentStock: number;
  purchaseCost: string;
  inventoryValue: string;
  revenue: string;
  costOfGoodsSold: string;
  grossProfit: string;
}

export interface OpeningImportResult {
  dryRun: boolean;
  createdPurchases: number;
  createdSales: number;
  missingSkus: string[];
  priceDiscrepancies: Array<{
    sku: string;
    catalogPrice: string | null;
    sourcePrice: string;
  }>;
  rows: OpeningSkuResult[];
  totals: OpeningTotals;
  mismatches: string[];
}

const approvedTotals: OpeningTotals = {
  skuCount: 25,
  unitsPurchased: 143,
  unitsSold: 2,
  currentStock: 141,
  purchaseCost: "1061840",
  inventoryValue: "1035840",
  revenue: "37000",
  costOfGoodsSold: "26000",
  grossProfit: "11000",
};

type ActualLine = {
  purchased: number;
  sold: number;
  purchaseCost: Prisma.Decimal;
  inventoryValue: Prisma.Decimal;
  revenue: Prisma.Decimal;
  costOfGoodsSold: Prisma.Decimal;
};

const emptyLine = (): ActualLine => ({
  purchased: 0,
  sold: 0,
  purchaseCost: decimal(0),
  inventoryValue: decimal(0),
  revenue: decimal(0),
  costOfGoodsSold: decimal(0),
});

function summarize(
  rows: readonly FinanceOpeningRow[],
  actual?: Map<string, ActualLine>,
): Pick<OpeningImportResult, "rows" | "totals" | "mismatches"> {
  const output: OpeningSkuResult[] = [];
  const mismatches: string[] = [];
  let purchaseCost = decimal(0);
  let inventoryValue = decimal(0);
  let revenue = decimal(0);
  let costOfGoodsSold = decimal(0);
  let unitsPurchased = 0;
  let unitsSold = 0;

  for (const row of rows) {
    const expectedCost = decimal(row.purchaseUnitPrice);
    const expectedSale = decimal(row.actualSalePrice ?? 0);
    const line = actual?.get(row.sku) ?? {
      purchased: row.unitsPurchased,
      sold: row.unitsSold,
      purchaseCost: expectedCost.mul(row.unitsPurchased),
      inventoryValue: expectedCost.mul(row.unitsPurchased - row.unitsSold),
      revenue: expectedSale.mul(row.unitsSold),
      costOfGoodsSold: expectedCost.mul(row.unitsSold),
    };
    const rowMismatches: string[] = [];
    if (line.purchased !== row.unitsPurchased)
      rowMismatches.push("purchased units");
    if (line.sold !== row.unitsSold) rowMismatches.push("sold units");
    if (line.purchased - line.sold !== row.unitsPurchased - row.unitsSold)
      rowMismatches.push("stock");
    if (!line.purchaseCost.eq(expectedCost.mul(row.unitsPurchased)))
      rowMismatches.push("purchase cost");
    if (
      !line.inventoryValue.eq(
        expectedCost.mul(row.unitsPurchased - row.unitsSold),
      )
    )
      rowMismatches.push("inventory value");
    if (!line.revenue.eq(expectedSale.mul(row.unitsSold)))
      rowMismatches.push("revenue");
    if (!line.costOfGoodsSold.eq(expectedCost.mul(row.unitsSold)))
      rowMismatches.push("COGS");
    if (rowMismatches.length)
      mismatches.push(`${row.sku}: ${rowMismatches.join(", ")}`);
    output.push({
      sku: row.sku,
      unitsPurchased: line.purchased,
      unitsSold: line.sold,
      currentStock: line.purchased - line.sold,
      inventoryValue: line.inventoryValue.toString(),
      revenue: line.revenue.toString(),
      costOfGoodsSold: line.costOfGoodsSold.toString(),
      grossProfit: line.revenue.sub(line.costOfGoodsSold).toString(),
      mismatches: rowMismatches,
    });
    unitsPurchased += line.purchased;
    unitsSold += line.sold;
    purchaseCost = purchaseCost.add(line.purchaseCost);
    inventoryValue = inventoryValue.add(line.inventoryValue);
    revenue = revenue.add(line.revenue);
    costOfGoodsSold = costOfGoodsSold.add(line.costOfGoodsSold);
  }
  const totals: OpeningTotals = {
    skuCount: rows.length,
    unitsPurchased,
    unitsSold,
    currentStock: unitsPurchased - unitsSold,
    purchaseCost: purchaseCost.toString(),
    inventoryValue: inventoryValue.toString(),
    revenue: revenue.toString(),
    costOfGoodsSold: costOfGoodsSold.toString(),
    grossProfit: revenue.sub(costOfGoodsSold).toString(),
  };
  for (const [key, expected] of Object.entries(approvedTotals)) {
    if (String(totals[key as keyof OpeningTotals]) !== String(expected)) {
      mismatches.push(
        `Total ${key}: expected ${expected}, found ${totals[key as keyof OpeningTotals]}`,
      );
    }
  }
  return { rows: output, totals, mismatches };
}

export async function importFinanceOpening(
  prisma: PrismaClient,
  input: { dryRun?: boolean } = {},
): Promise<OpeningImportResult> {
  const skus = financeOpeningData.map((row) => row.sku);
  if (new Set(skus).size !== skus.length)
    throw new Error("Opening source contains duplicate SKUs");
  const products = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { id: true, sku: true, price: true },
  });
  const bySku = new Map(products.map((product) => [product.sku, product]));
  const missingSkus = skus.filter((sku) => !bySku.has(sku));
  const priceDiscrepancies = financeOpeningData.flatMap((row) => {
    const price = bySku.get(row.sku)?.price;
    return price?.eq(decimal(row.defaultSalePrice))
      ? []
      : bySku.has(row.sku)
        ? [
            {
              sku: row.sku,
              catalogPrice: price?.toString() ?? null,
              sourcePrice: row.defaultSalePrice,
            },
          ]
        : [];
  });
  const base = { missingSkus, priceDiscrepancies };
  if (input.dryRun || missingSkus.length) {
    return {
      dryRun: !!input.dryRun,
      createdPurchases: 0,
      createdSales: 0,
      ...base,
      ...summarize(financeOpeningData),
      mismatches: [
        ...summarize(financeOpeningData).mismatches,
        ...missingSkus.map((sku) => `Missing SKU: ${sku}`),
      ],
    };
  }

  return prisma.$transaction(
    async (tx) => {
      const admin = await tx.adminUser.findFirst({
        where: { active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!admin)
        throw new Error(
          "An active administrator is required for opening entries",
        );
      const ledger = new InventoryLedgerService();
      let createdPurchases = 0;
      let createdSales = 0;
      const recordMismatches: string[] = [];
      let purchase = await tx.purchase.findUnique({
        where: { importKey: purchaseKey },
        include: { items: true },
      });
      if (!purchase) {
        const supplier =
          (await tx.supplier.findFirst({
            where: { name: "Opening Inventory" },
            select: { id: true },
          })) ??
          (await tx.supplier.create({
            data: { name: "Opening Inventory" },
            select: { id: true },
          }));
        const createdAt = openingDate;
        const items = financeOpeningData.map((row) => ({
          id: randomUUID(),
          productId: bySku.get(row.sku)!.id,
          quantity: row.unitsPurchased,
          purchaseUnitPrice: decimal(row.purchaseUnitPrice),
        }));
        await ledger.recalculateProducts(
          tx,
          items.map((item) => item.productId),
          {
            upsert: items.map((item) => ({
              type: "purchase" as const,
              id: item.id,
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.purchaseUnitPrice,
              occurredAt: openingDate,
              createdAt,
            })),
          },
        );
        purchase = await tx.purchase.create({
          data: {
            purchaseNumber: "PUR-20260920-OPENING",
            importKey: purchaseKey,
            date: openingDate,
            supplierId: supplier.id,
            createdByAdminId: admin.id,
            createdAt,
            notes: "Approved opening inventory ledger",
            items: { create: items },
          },
          include: { items: true },
        });
        createdPurchases = 1;
      }
      if (purchase.date.toISOString().slice(0, 10) !== "2026-09-20") {
        recordMismatches.push(
          `Opening purchase date: expected 2026-09-20, found ${purchase.date.toISOString().slice(0, 10)}`,
        );
      }
      if (
        purchase.importKey !== purchaseKey ||
        purchase.purchaseNumber !== "PUR-20260920-OPENING"
      ) {
        recordMismatches.push(
          "Opening purchase identifier differs from the approved import",
        );
      }

      const sales = [];
      for (const row of financeOpeningData.filter(
        (item) => item.unitsSold > 0,
      )) {
        let sale = await tx.sale.findUnique({
          where: { importKey: saleKey(row.sku) },
          include: { items: true },
        });
        if (!sale) {
          const itemId = randomUUID();
          const productId = bySku.get(row.sku)!.id;
          const createdAt = new Date(openingDate.getTime() + 1000);
          const replay = await ledger.recalculateProducts(tx, [productId], {
            upsert: [
              {
                type: "sale",
                id: itemId,
                productId,
                quantity: row.unitsSold,
                occurredAt: openingDate,
                createdAt,
              },
            ],
          });
          const costUnitSnapshot = replay.get(productId)?.saleCosts.get(itemId);
          if (!costUnitSnapshot)
            throw new Error(`No cost snapshot for ${row.sku}`);
          sale = await tx.sale.create({
            data: {
              saleNumber: `SAL-20260920-OPENING-${row.sku}`,
              importKey: saleKey(row.sku),
              date: openingDate,
              createdAt,
              createdByAdminId: admin.id,
              sourceType: SaleSourceType.MANUAL,
              channel: SalesChannel.OTHER,
              notes: "Approved historical opening sale",
              items: {
                create: [
                  {
                    id: itemId,
                    productId,
                    quantity: row.unitsSold,
                    actualUnitPrice: decimal(row.actualSalePrice!),
                    lineDiscount: decimal(0),
                    costUnitSnapshot,
                  },
                ],
              },
            },
            include: { items: true },
          });
          createdSales++;
        }
        if (sale.date.toISOString().slice(0, 10) !== "2026-09-20") {
          recordMismatches.push(
            `Opening sale ${row.sku} date: expected 2026-09-20, found ${sale.date.toISOString().slice(0, 10)}`,
          );
        }
        if (
          sale.importKey !== saleKey(row.sku) ||
          sale.saleNumber !== `SAL-20260920-OPENING-${row.sku}` ||
          sale.sourceType !== SaleSourceType.MANUAL
        ) {
          recordMismatches.push(
            `Opening sale ${row.sku} identifier or source differs from the approved import`,
          );
        }
        sales.push({ row, sale });
      }

      const actual = new Map(
        financeOpeningData.map((row) => [row.sku, emptyLine()]),
      );
      const byId = new Map(
        products.map((product) => [product.id, product.sku]),
      );
      for (const item of purchase.items) {
        const sku = byId.get(item.productId);
        const line = sku ? actual.get(sku) : undefined;
        if (!line) {
          recordMismatches.push(
            `Opening purchase contains unexpected product ${item.productId}`,
          );
          continue;
        }
        line.purchased += item.quantity;
        line.purchaseCost = line.purchaseCost.add(
          item.purchaseUnitPrice.mul(item.quantity),
        );
        line.inventoryValue = line.inventoryValue.add(
          item.purchaseUnitPrice.mul(item.quantity),
        );
      }
      for (const { row, sale } of sales) {
        for (const item of sale.items) {
          const sku = byId.get(item.productId);
          const line = sku ? actual.get(sku) : undefined;
          if (!line || sku !== row.sku) {
            recordMismatches.push(
              `Opening sale ${row.sku} contains unexpected product ${item.productId}`,
            );
            continue;
          }
          line.sold += item.quantity;
          const cost = item.costUnitSnapshot.mul(item.quantity);
          line.inventoryValue = line.inventoryValue.sub(cost);
          line.revenue = line.revenue.add(
            item.actualUnitPrice.mul(item.quantity).sub(item.lineDiscount),
          );
          line.costOfGoodsSold = line.costOfGoodsSold.add(cost);
        }
      }
      const summary = summarize(financeOpeningData, actual);
      return {
        dryRun: false,
        createdPurchases,
        createdSales,
        ...base,
        ...summary,
        mismatches: [...summary.mismatches, ...recordMismatches],
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30000,
    },
  );
}

function printResult(result: OpeningImportResult): void {
  console.log(
    result.dryRun
      ? "Opening inventory dry run (no writes)"
      : "Opening inventory reconciliation",
  );
  if (result.missingSkus.length)
    console.log(`Missing SKUs: ${result.missingSkus.join(", ")}`);
  for (const price of result.priceDiscrepancies) {
    console.log(
      `Catalog price discrepancy ${price.sku}: catalog ${price.catalogPrice ?? "null"}, source ${price.sourcePrice}`,
    );
  }
  console.table(
    result.rows.map(
      ({
        sku,
        unitsPurchased,
        unitsSold,
        currentStock,
        inventoryValue,
        revenue,
        costOfGoodsSold,
        grossProfit,
      }) => ({
        sku,
        unitsPurchased,
        unitsSold,
        currentStock,
        inventoryValue,
        revenue,
        costOfGoodsSold,
        grossProfit,
      }),
    ),
  );
  console.log("Totals", result.totals);
  console.log(
    `Created purchases: ${result.createdPurchases}; created sales: ${result.createdSales}`,
  );
  for (const mismatch of result.mismatches)
    console.error(`Mismatch: ${mismatch}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--dry-run"))
    throw new Error(`Unknown arguments: ${args.join(" ")}`);
  config({ path: resolve(__dirname, "../../../.env"), quiet: true });
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const result = await importFinanceOpening(prisma, {
      dryRun: args.includes("--dry-run"),
    });
    printResult(result);
    if (result.mismatches.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
