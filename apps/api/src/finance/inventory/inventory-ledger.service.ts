import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { money } from "../domain/money";
import {
  type InventoryLedgerEntry,
  type InventoryPosition,
  type LedgerMutation,
  type LedgerReplayResult,
} from "./inventory-ledger.types";

const zero = () => money(0);

const compareLedgerEntries = (
  left: InventoryLedgerEntry,
  right: InventoryLedgerEntry,
): number =>
  left.occurredAt.getTime() - right.occurredAt.getTime() ||
  left.createdAt.getTime() - right.createdAt.getTime() ||
  left.type.localeCompare(right.type) ||
  left.id.localeCompare(right.id);

export const replayInventoryLedger = (
  entries: InventoryLedgerEntry[],
): LedgerReplayResult => {
  let quantity = 0;
  let averageUnitCost = zero();
  let inventoryValue = zero();
  const saleCosts = new Map<string, Prisma.Decimal>();

  for (const entry of [...entries].sort(compareLedgerEntries)) {
    if (entry.type === "purchase") {
      quantity += entry.quantity;
      inventoryValue = inventoryValue.add(entry.unitCost.mul(entry.quantity));
      averageUnitCost = inventoryValue.div(quantity);
      continue;
    }

    if (entry.quantity > quantity) {
      throw new Error(`Only ${quantity} units are currently available.`);
    }

    saleCosts.set(entry.id, averageUnitCost);
    quantity -= entry.quantity;
    inventoryValue = inventoryValue.sub(averageUnitCost.mul(entry.quantity));

    if (quantity === 0) {
      averageUnitCost = zero();
      inventoryValue = zero();
    }
  }

  const position: InventoryPosition = {
    quantity,
    averageUnitCost,
    inventoryValue,
  };

  return { position, saleCosts };
};

const mergeProposedMutation = (
  entries: InventoryLedgerEntry[],
  productId: string,
  proposed?: LedgerMutation,
): InventoryLedgerEntry[] => {
  const deletedIds = new Set(proposed?.deleteIds ?? []);
  const upsertedIds = new Set((proposed?.upsert ?? []).map((entry) => entry.id));
  const merged = new Map(
    entries
      .filter(
        (entry) => !deletedIds.has(entry.id) && !upsertedIds.has(entry.id),
      )
      .map((entry) => [entry.id, entry]),
  );

  for (const entry of proposed?.upsert ?? []) {
    if (entry.productId === productId) merged.set(entry.id, entry);
  }

  return [...merged.values()];
};

@Injectable()
export class InventoryLedgerService {
  async replayProduct(
    tx: Prisma.TransactionClient,
    productId: string,
    proposed?: LedgerMutation,
  ): Promise<LedgerReplayResult> {
    const [purchaseItems, saleItems] = await Promise.all([
      tx.purchaseItem.findMany({
        where: { productId },
        include: { purchase: { select: { date: true, createdAt: true } } },
      }),
      tx.saleItem.findMany({
        where: { productId },
        include: { sale: { select: { date: true, createdAt: true } } },
      }),
    ]);

    const existingEntries: InventoryLedgerEntry[] = [
      ...purchaseItems.map((item) => ({
        type: "purchase" as const,
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.purchaseUnitPrice,
        occurredAt: item.purchase.date,
        createdAt: item.purchase.createdAt,
      })),
      ...saleItems.map((item) => ({
        type: "sale" as const,
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        occurredAt: item.sale.date,
        createdAt: item.sale.createdAt,
      })),
    ];
    const result = replayInventoryLedger(
      mergeProposedMutation(existingEntries, productId, proposed),
    );

    await Promise.all(
      [...result.saleCosts].map(([saleItemId, costUnitSnapshot]) =>
        tx.saleItem.updateMany({
          where: { id: saleItemId },
          data: { costUnitSnapshot },
        }),
      ),
    );

    return result;
  }

  async recalculateProducts(
    tx: Prisma.TransactionClient,
    productIds: string[],
    proposed?: LedgerMutation,
  ): Promise<Map<string, LedgerReplayResult>> {
    const results = new Map<string, LedgerReplayResult>();

    for (const productId of new Set(productIds)) {
      results.set(productId, await this.replayProduct(tx, productId, proposed));
    }

    return results;
  }
}
