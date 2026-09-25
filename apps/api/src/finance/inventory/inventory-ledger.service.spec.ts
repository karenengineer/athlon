import { Prisma } from "../../generated/prisma/client";
import { roundMoney } from "../domain/money";
import {
  type InventoryLedgerEntry,
  type LedgerMutation,
  type PurchaseLedgerEntry,
  type SaleLedgerEntry,
} from "./inventory-ledger.types";
import {
  InventoryLedgerService,
  replayInventoryLedger,
} from "./inventory-ledger.service";

const productId = "product-1";

const purchase = (
  occurredAt: string,
  quantity: number,
  unitCost: string,
  id = `purchase-${occurredAt}`,
): PurchaseLedgerEntry => ({
  type: "purchase",
  id,
  productId,
  quantity,
  unitCost: new Prisma.Decimal(unitCost),
  occurredAt: new Date(occurredAt),
  createdAt: new Date(`${occurredAt}T00:00:00.000Z`),
});

const sale = (
  occurredAt: string,
  id: string,
  quantity: number,
): SaleLedgerEntry => ({
  type: "sale",
  id,
  productId,
  quantity,
  occurredAt: new Date(occurredAt),
  createdAt: new Date(`${occurredAt}T00:00:00.000Z`),
});

const replay = (entries: InventoryLedgerEntry[]) =>
  replayInventoryLedger(entries);

describe("inventory ledger replay", () => {
  it("keeps 7 units after purchasing 10 and selling 3", () => {
    const result = replay([
      purchase("2026-09-01", 10, "12000"),
      sale("2026-09-02", "sale-1", 3),
    ]);

    expect(result.position.quantity).toBe(7);
    expect(result.position.inventoryValue.toString()).toBe("84000");
    expect(result.saleCosts.get("sale-1")?.toString()).toBe("12000");
  });

  it("uses the weighted average 12333.33", () => {
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

  it("orders same-date entries by creation time, type, then id", () => {
    const result = replay([
      sale("2026-09-01", "sale-b", 1),
      purchase("2026-09-01", 1, "12000", "purchase-a"),
    ]);

    expect(result.position.quantity).toBe(0);
  });
});

describe("InventoryLedgerService", () => {
  const existingEntries = [
    purchase("2026-09-01", 10, "12000", "purchase-1"),
    sale("2026-09-02", "sale-1", 3),
  ];

  const transactionFor = (entries: InventoryLedgerEntry[]) => {
    const saleUpdates: Array<{ id: string; costUnitSnapshot: string }> = [];
    const purchases = entries
      .filter((entry) => entry.type === "purchase")
      .map((entry) => ({
        ...entry,
        purchaseId: `parent-${entry.id}`,
        purchaseUnitPrice: entry.unitCost,
        purchase: { date: entry.occurredAt, createdAt: entry.createdAt },
      }));
    const sales = entries
      .filter((entry) => entry.type === "sale")
      .map((entry) => ({
        ...entry,
        saleId: `parent-${entry.id}`,
        actualUnitPrice: new Prisma.Decimal(0),
        lineDiscount: new Prisma.Decimal(0),
        costUnitSnapshot: new Prisma.Decimal(0),
        sale: { date: entry.occurredAt, createdAt: entry.createdAt },
      }));

    return {
      tx: {
        purchaseItem: { findMany: jest.fn().mockResolvedValue(purchases) },
        saleItem: {
          findMany: jest.fn().mockResolvedValue(sales),
          update: jest
            .fn()
            .mockImplementation(
              ({
                where,
                data,
              }: {
                where: { id: string };
                data: { costUnitSnapshot: Prisma.Decimal };
              }) => {
                saleUpdates.push({
                  id: where.id,
                  costUnitSnapshot: data.costUnitSnapshot.toString(),
                });
                return Promise.resolve({});
              },
            ),
          updateMany: jest
            .fn()
            .mockImplementation(
              ({
                where,
                data,
              }: {
                where: { id: string };
                data: { costUnitSnapshot: Prisma.Decimal };
              }) => {
                saleUpdates.push({
                  id: where.id,
                  costUnitSnapshot: data.costUnitSnapshot.toString(),
                });
                return Promise.resolve({ count: 1 });
              },
            ),
        },
      },
      saleUpdates,
    };
  };

  it("replays a past purchase edit before persisting anything", async () => {
    const { tx, saleUpdates } = transactionFor(existingEntries);
    const proposed: LedgerMutation = {
      upsert: [purchase("2026-09-01", 8, "12000", "purchase-1")],
    };

    const result = await new InventoryLedgerService().replayProduct(
      tx as never,
      productId,
      proposed,
    );

    expect(result.position.quantity).toBe(5);
    expect(saleUpdates).toEqual([{ id: "sale-1", costUnitSnapshot: "12000" }]);
  });

  it("restores stock when a sale is deleted", async () => {
    const { tx } = transactionFor(existingEntries);

    const result = await new InventoryLedgerService().replayProduct(
      tx as never,
      productId,
      {
        deleteIds: ["sale-1"],
      },
    );

    expect(result.position.quantity).toBe(10);
  });

  it("rejects reducing a purchase below already-sold quantity", async () => {
    const { tx } = transactionFor(existingEntries);

    await expect(
      new InventoryLedgerService().replayProduct(tx as never, productId, {
        upsert: [purchase("2026-09-01", 2, "12000", "purchase-1")],
      }),
    ).rejects.toThrow("Only 2 units are currently available.");
  });

  it("removes an upserted item from its previous product replay", async () => {
    const { tx } = transactionFor(existingEntries);

    await expect(
      new InventoryLedgerService().replayProduct(tx as never, productId, {
        upsert: [{ ...existingEntries[0]!, productId: "product-2" }],
      }),
    ).rejects.toThrow("Only 0 units are currently available.");
  });

  it("updates a moved sale with the destination product COGS snapshot", async () => {
    const destinationProductId = "product-2";
    const destinationPurchase = {
      ...purchase("2026-09-01", 10, "15000", "purchase-2"),
      productId: destinationProductId,
    };
    const movedSale = {
      ...sale("2026-09-02", "sale-1", 3),
      productId: destinationProductId,
    };
    const saleUpdates: Array<{ id: string; costUnitSnapshot: string }> = [];
    const recordSaleUpdate = ({
      where,
      data,
    }: {
      where: { id: string };
      data: { costUnitSnapshot: Prisma.Decimal };
    }) => {
      saleUpdates.push({
        id: where.id,
        costUnitSnapshot: data.costUnitSnapshot.toString(),
      });
      return Promise.resolve({ count: 1 });
    };
    const tx = {
      purchaseItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            ...destinationPurchase,
            purchaseId: "parent-purchase-2",
            purchaseUnitPrice: destinationPurchase.unitCost,
            purchase: {
              date: destinationPurchase.occurredAt,
              createdAt: destinationPurchase.createdAt,
            },
          },
        ]),
      },
      saleItem: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn().mockImplementation(recordSaleUpdate),
      },
    };

    const result = await new InventoryLedgerService().replayProduct(
      tx as never,
      destinationProductId,
      { upsert: [movedSale] },
    );

    expect(result.saleCosts.get("sale-1")?.toString()).toBe("15000");
    expect(saleUpdates).toEqual([{ id: "sale-1", costUnitSnapshot: "15000" }]);
  });
});
