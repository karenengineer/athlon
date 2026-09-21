import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  adminListEnvelope,
  adminListOffset,
  rethrowCatalogConflict,
} from "../../common/admin-list";
import { PrismaService } from "../../database/prisma.service";
import { Prisma } from "../../generated/prisma/client";
import { money, moneySum } from "../domain/money";
import { InventoryLedgerService } from "../inventory/inventory-ledger.service";
import { PurchaseLedgerEntry } from "../inventory/inventory-ledger.types";
import {
  CreatePurchaseDto,
  CreatePurchaseItemDto,
} from "./dto/create-purchase.dto";
import { PurchaseListQueryDto } from "./dto/purchase-list-query.dto";
import { UpdatePurchaseDto } from "./dto/update-purchase.dto";

const purchaseInclude = {
  supplier: true,
  createdByAdmin: { select: { id: true, email: true } },
  items: {
    include: {
      product: {
        include: {
          translations: true,
          category: { include: { translations: true } },
        },
      },
    },
  },
} as const;

type PurchaseWithRelations = Prisma.PurchaseGetPayload<{
  include: typeof purchaseInclude;
}>;

type PreparedItem = CreatePurchaseItemDto & { id: string };

const parseDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const purchaseTotal = (purchase: PurchaseWithRelations): Prisma.Decimal =>
  moneySum(
    purchase.items.map((item) => item.purchaseUnitPrice.mul(item.quantity)),
  );

const serializePurchase = (purchase: PurchaseWithRelations) => ({
  ...purchase,
  items: purchase.items.map((item) => ({
    ...item,
    purchaseUnitPrice: item.purchaseUnitPrice.toString(),
    totalPurchaseCost: item.purchaseUnitPrice.mul(item.quantity).toString(),
  })),
  totalPurchaseCost: purchaseTotal(purchase).toString(),
});

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
  ) {}

  async list(query: PurchaseListQueryDto): Promise<unknown> {
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo)
      throw new BadRequestException("dateFrom must be on or before dateTo");
    const where = this.listWhere(query);
    const total = await this.prisma.purchase.count({ where });

    if (query.sort === "totalAsc" || query.sort === "totalDesc") {
      const all = await this.prisma.purchase.findMany({
        where,
        orderBy: [{ date: "desc" }, { id: "asc" }],
        include: purchaseInclude,
      });
      const direction = query.sort === "totalAsc" ? 1 : -1;
      const offset = adminListOffset(query);
      const items = all
        .sort(
          (left, right) =>
            purchaseTotal(left).comparedTo(purchaseTotal(right)) * direction ||
            left.id.localeCompare(right.id),
        )
        .slice(offset, offset + query.pageSize)
        .map(serializePurchase);
      return adminListEnvelope(items, total, query);
    }

    const items = await this.prisma.purchase.findMany({
      where,
      skip: adminListOffset(query),
      take: query.pageSize,
      orderBy: [
        { date: query.sort === "dateAsc" ? "asc" : "desc" },
        { createdAt: query.sort === "dateAsc" ? "asc" : "desc" },
        { id: "asc" },
      ],
      include: purchaseInclude,
    });
    return adminListEnvelope(items.map(serializePurchase), total, query);
  }

  async get(id: string): Promise<unknown> {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: purchaseInclude,
    });
    if (!purchase) throw new NotFoundException("Purchase not found");
    return serializePurchase(purchase);
  }

  async create(input: CreatePurchaseDto, adminId: string): Promise<unknown> {
    const purchaseId = randomUUID();
    const createdAt = new Date();
    const date = parseDate(input.date);
    const items = input.items.map((item) => ({ ...item, id: randomUUID() }));
    try {
      const purchase = await this.prisma.$transaction(
        async (tx) => {
          await this.ensureReferences(tx, input.supplierId, items);
          await this.ledger.recalculateProducts(
            tx,
            items.map((item) => item.productId),
            {
              upsert: this.ledgerEntries(items, date, createdAt),
            },
          );
          return tx.purchase.create({
            data: {
              id: purchaseId,
              purchaseNumber: `PUR-${input.date.replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
              date,
              supplierId: input.supplierId,
              notes: input.notes?.trim() || null,
              createdByAdminId: adminId,
              createdAt,
              items: {
                create: items.map((item) => ({
                  id: item.id,
                  productId: item.productId,
                  quantity: item.quantity,
                  purchaseUnitPrice: money(item.purchaseUnitPrice),
                })),
              },
            },
            include: purchaseInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return serializePurchase(purchase);
    } catch (error) {
      rethrowPurchaseWriteError(error);
    }
  }

  async update(id: string, input: UpdatePurchaseDto): Promise<unknown> {
    try {
      const purchase = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.purchase.findUnique({
            where: { id },
            include: purchaseInclude,
          });
          if (!current) throw new NotFoundException("Purchase not found");

          const date = input.date ? parseDate(input.date) : current.date;
          const nextItems: PreparedItem[] = input.items
            ? input.items.map((item) => ({ ...item, id: randomUUID() }))
            : current.items.map((item) => ({
                id: item.id,
                productId: item.productId,
                quantity: item.quantity,
                purchaseUnitPrice: item.purchaseUnitPrice.toString(),
              }));
          const supplierId = input.supplierId ?? current.supplierId;
          await this.ensureReferences(tx, supplierId, nextItems);
          const affectedProductIds = [
            ...new Set([
              ...current.items.map((item) => item.productId),
              ...nextItems.map((item) => item.productId),
            ]),
          ];
          await this.ledger.recalculateProducts(tx, affectedProductIds, {
            upsert: this.ledgerEntries(nextItems, date, current.createdAt),
            ...(input.items
              ? { deleteIds: current.items.map((item) => item.id) }
              : {}),
          });

          return tx.purchase.update({
            where: { id },
            data: {
              ...(input.date !== undefined ? { date } : {}),
              ...(input.supplierId !== undefined ? { supplierId } : {}),
              ...(input.notes !== undefined
                ? { notes: input.notes?.trim() || null }
                : {}),
              ...(input.items
                ? {
                    items: {
                      deleteMany: {},
                      create: nextItems.map((item) => ({
                        id: item.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        purchaseUnitPrice: money(item.purchaseUnitPrice),
                      })),
                    },
                  }
                : {}),
            },
            include: purchaseInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return serializePurchase(purchase);
    } catch (error) {
      rethrowPurchaseWriteError(error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.purchase.findUnique({
            where: { id },
            include: { items: true },
          });
          if (!current) throw new NotFoundException("Purchase not found");
          await this.ledger.recalculateProducts(
            tx,
            current.items.map((item) => item.productId),
            { deleteIds: current.items.map((item) => item.id) },
          );
          await tx.purchase.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      rethrowPurchaseWriteError(error);
    }
  }

  private listWhere(query: PurchaseListQueryDto): Prisma.PurchaseWhereInput {
    const itemFilter: Prisma.PurchaseItemWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.categoryId
        ? { product: { categoryId: query.categoryId } }
        : {}),
    };
    return {
      ...(query.dateFrom || query.dateTo
        ? {
            date: {
              ...(query.dateFrom ? { gte: parseDate(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: parseDate(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.productId || query.categoryId
        ? { items: { some: itemFilter } }
        : {}),
      ...(query.q
        ? {
            OR: [
              {
                purchaseNumber: {
                  contains: query.q,
                  mode: "insensitive" as const,
                },
              },
              {
                items: {
                  some: {
                    product: {
                      sku: { contains: query.q, mode: "insensitive" as const },
                    },
                  },
                },
              },
              {
                items: {
                  some: {
                    product: {
                      translations: {
                        some: {
                          name: {
                            contains: query.q,
                            mode: "insensitive" as const,
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private async ensureReferences(
    tx: Prisma.TransactionClient,
    supplierId: string,
    items: readonly CreatePurchaseItemDto[],
  ): Promise<void> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const [supplier, productCount] = await Promise.all([
      tx.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true },
      }),
      tx.product.count({ where: { id: { in: productIds } } }),
    ]);
    if (!supplier) throw new NotFoundException("Supplier not found");
    if (productCount !== productIds.length)
      throw new NotFoundException("One or more products were not found");
  }

  private ledgerEntries(
    items: readonly PreparedItem[],
    date: Date,
    createdAt: Date,
  ): PurchaseLedgerEntry[] {
    return items.map((item) => ({
      type: "purchase",
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitCost: money(item.purchaseUnitPrice),
      occurredAt: date,
      createdAt,
    }));
  }
}

function rethrowPurchaseWriteError(error: unknown): never {
  if (
    error instanceof Error &&
    error.message.startsWith("Only ") &&
    error.message.endsWith(" units are currently available.")
  )
    throw new BadRequestException(error.message);
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  )
    throw new ConflictException(
      "A concurrent finance change prevented this operation; please retry",
    );
  rethrowCatalogConflict(error);
}
