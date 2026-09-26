import { Prisma } from "../../generated/prisma/client";

export type InventoryPosition = {
  quantity: number;
  averageUnitCost: Prisma.Decimal;
  inventoryValue: Prisma.Decimal;
};

export type LedgerReplayResult = {
  position: InventoryPosition;
  saleCosts: Map<string, Prisma.Decimal>;
};

type LedgerEntryBase = {
  id: string;
  productId: string;
  quantity: number;
  occurredAt: Date;
  createdAt: Date;
};

export type PurchaseLedgerEntry = LedgerEntryBase & {
  type: "purchase";
  unitCost: Prisma.Decimal;
};

export type SaleLedgerEntry = LedgerEntryBase & {
  type: "sale";
};

export type InventoryLedgerEntry = PurchaseLedgerEntry | SaleLedgerEntry;

export type LedgerMutation = {
  upsert?: InventoryLedgerEntry[];
  deleteIds?: string[];
};
