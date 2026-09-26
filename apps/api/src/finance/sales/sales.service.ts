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
import { Prisma, SaleSourceType } from "../../generated/prisma/client";
import { money, moneySum, safePercent } from "../domain/money";
import { InventoryLedgerService } from "../inventory/inventory-ledger.service";
import { SaleLedgerEntry } from "../inventory/inventory-ledger.types";
import { CreateSaleDto, CreateSaleItemDto } from "./dto/create-sale.dto";
import { SaleListQueryDto } from "./dto/sale-list-query.dto";
import { UpdateSaleDto } from "./dto/update-sale.dto";

const saleInclude = {
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

type SaleWithRelations = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;
type PreparedItem = CreateSaleItemDto & { id: string };

const parseDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const optionalText = (value: string | null | undefined): string | null =>
  value?.trim() || null;

const saleTotals = (sale: SaleWithRelations) => {
  const netRevenue = moneySum(
    sale.items.map((item) =>
      item.actualUnitPrice.mul(item.quantity).sub(item.lineDiscount),
    ),
  );
  const costOfGoodsSold = moneySum(
    sale.items.map((item) => item.costUnitSnapshot.mul(item.quantity)),
  );
  return {
    netRevenue,
    costOfGoodsSold,
    grossProfit: netRevenue.sub(costOfGoodsSold),
  };
};

const serializeSale = (sale: SaleWithRelations) => {
  const items = sale.items.map((item) => {
    const netRevenue = item.actualUnitPrice
      .mul(item.quantity)
      .sub(item.lineDiscount);
    const costOfGoodsSold = item.costUnitSnapshot.mul(item.quantity);
    const grossProfit = netRevenue.sub(costOfGoodsSold);
    return {
      ...item,
      actualUnitPrice: item.actualUnitPrice.toString(),
      lineDiscount: item.lineDiscount.toString(),
      costUnitSnapshot: item.costUnitSnapshot.toString(),
      netRevenue: netRevenue.toString(),
      costOfGoodsSold: costOfGoodsSold.toString(),
      grossProfit: grossProfit.toString(),
      grossMarginPercent: (
        safePercent(grossProfit, netRevenue) ?? money(0)
      ).toString(),
    };
  });
  const totalNetRevenue = moneySum(items.map((item) => money(item.netRevenue)));
  const totalCostOfGoodsSold = moneySum(
    items.map((item) => money(item.costOfGoodsSold)),
  );
  const totalGrossProfit = totalNetRevenue.sub(totalCostOfGoodsSold);
  return {
    ...sale,
    items,
    totalNetRevenue: totalNetRevenue.toString(),
    totalCostOfGoodsSold: totalCostOfGoodsSold.toString(),
    totalGrossProfit: totalGrossProfit.toString(),
    grossMarginPercent: (
      safePercent(totalGrossProfit, totalNetRevenue) ?? money(0)
    ).toString(),
  };
};

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
  ) {}

  async list(query: SaleListQueryDto): Promise<unknown> {
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo)
      throw new BadRequestException("dateFrom must be on or before dateTo");
    const where = this.listWhere(query);
    const total = await this.prisma.sale.count({ where });
    if (
      ["revenueAsc", "revenueDesc", "profitAsc", "profitDesc"].includes(
        query.sort,
      )
    ) {
      const all = await this.prisma.sale.findMany({
        where,
        orderBy: [{ date: "desc" }, { id: "asc" }],
        include: saleInclude,
      });
      const field = query.sort.startsWith("revenue")
        ? "netRevenue"
        : "grossProfit";
      const direction = query.sort.endsWith("Asc") ? 1 : -1;
      const offset = adminListOffset(query);
      const items = all
        .sort(
          (left, right) =>
            saleTotals(left)[field].comparedTo(saleTotals(right)[field]) *
              direction || left.id.localeCompare(right.id),
        )
        .slice(offset, offset + query.pageSize)
        .map(serializeSale);
      return adminListEnvelope(items, total, query);
    }
    const items = await this.prisma.sale.findMany({
      where,
      skip: adminListOffset(query),
      take: query.pageSize,
      orderBy: [
        { date: query.sort === "dateAsc" ? "asc" : "desc" },
        { createdAt: query.sort === "dateAsc" ? "asc" : "desc" },
        { id: "asc" },
      ],
      include: saleInclude,
    });
    return adminListEnvelope(items.map(serializeSale), total, query);
  }

  async get(id: string): Promise<unknown> {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: saleInclude,
    });
    if (!sale) throw new NotFoundException("Sale not found");
    return serializeSale(sale);
  }

  async create(input: CreateSaleDto, adminId: string): Promise<unknown> {
    const saleId = randomUUID();
    const createdAt = new Date();
    const date = parseDate(input.date);
    const items = input.items.map((item) => ({ ...item, id: randomUUID() }));
    try {
      const sale = await this.prisma.$transaction(
        async (tx) => {
          await this.ensureProducts(tx, items);
          const replay = await this.ledger.recalculateProducts(
            tx,
            items.map((item) => item.productId),
            { upsert: this.ledgerEntries(items, date, createdAt) },
          );
          return tx.sale.create({
            data: {
              id: saleId,
              saleNumber: `SAL-${input.date.replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
              date,
              orderId: optionalText(input.orderId),
              sourceType: SaleSourceType.MANUAL,
              sourceId: null,
              channel: input.channel,
              trainerReferralCode: optionalText(input.trainerReferralCode),
              customerName: optionalText(input.customerName),
              customerPhone: optionalText(input.customerPhone),
              notes: optionalText(input.notes),
              createdByAdminId: adminId,
              createdAt,
              items: {
                create: items.map((item) => ({
                  id: item.id,
                  productId: item.productId,
                  quantity: item.quantity,
                  actualUnitPrice: money(item.actualUnitPrice),
                  lineDiscount: money(item.lineDiscount ?? 0),
                  costUnitSnapshot: this.costSnapshot(
                    replay,
                    item.productId,
                    item.id,
                  ),
                })),
              },
            },
            include: saleInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return serializeSale(sale);
    } catch (error) {
      rethrowSaleWriteError(error);
    }
  }

  async update(id: string, input: UpdateSaleDto): Promise<unknown> {
    try {
      const sale = await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.sale.findUnique({
            where: { id },
            include: saleInclude,
          });
          if (!current || current.sourceType !== SaleSourceType.MANUAL)
            throw new NotFoundException("Manual sale not found");

          const date = input.date ? parseDate(input.date) : current.date;
          const nextItems: PreparedItem[] = input.items
            ? input.items.map((item) => ({ ...item, id: randomUUID() }))
            : current.items.map((item) => ({
                id: item.id,
                productId: item.productId,
                quantity: item.quantity,
                actualUnitPrice: item.actualUnitPrice.toString(),
                lineDiscount: item.lineDiscount.toString(),
              }));
          await this.ensureProducts(tx, nextItems);
          const affectedProductIds = [
            ...new Set([
              ...current.items.map((item) => item.productId),
              ...nextItems.map((item) => item.productId),
            ]),
          ];
          const replay = await this.ledger.recalculateProducts(
            tx,
            affectedProductIds,
            {
              upsert: this.ledgerEntries(nextItems, date, current.createdAt),
              ...(input.items
                ? { deleteIds: current.items.map((item) => item.id) }
                : {}),
            },
          );

          return tx.sale.update({
            where: { id },
            data: {
              ...(input.date !== undefined ? { date } : {}),
              ...(input.orderId !== undefined
                ? { orderId: optionalText(input.orderId) }
                : {}),
              ...(input.channel !== undefined
                ? { channel: input.channel }
                : {}),
              ...(input.trainerReferralCode !== undefined
                ? {
                    trainerReferralCode: optionalText(
                      input.trainerReferralCode,
                    ),
                  }
                : {}),
              ...(input.customerName !== undefined
                ? { customerName: optionalText(input.customerName) }
                : {}),
              ...(input.customerPhone !== undefined
                ? { customerPhone: optionalText(input.customerPhone) }
                : {}),
              ...(input.notes !== undefined
                ? { notes: optionalText(input.notes) }
                : {}),
              ...(input.items
                ? {
                    items: {
                      deleteMany: {},
                      create: nextItems.map((item) => ({
                        id: item.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        actualUnitPrice: money(item.actualUnitPrice),
                        lineDiscount: money(item.lineDiscount ?? 0),
                        costUnitSnapshot: this.costSnapshot(
                          replay,
                          item.productId,
                          item.id,
                        ),
                      })),
                    },
                  }
                : {}),
            },
            include: saleInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return serializeSale(sale);
    } catch (error) {
      rethrowSaleWriteError(error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.sale.findUnique({
            where: { id },
            include: { items: true },
          });
          if (!current || current.sourceType !== SaleSourceType.MANUAL)
            throw new NotFoundException("Manual sale not found");
          await this.ledger.recalculateProducts(
            tx,
            current.items.map((item) => item.productId),
            { deleteIds: current.items.map((item) => item.id) },
          );
          await tx.sale.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      rethrowSaleWriteError(error);
    }
  }

  private listWhere(query: SaleListQueryDto): Prisma.SaleWhereInput {
    const itemFilter: Prisma.SaleItemWhereInput = {
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
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.trainerReferralCode
        ? { trainerReferralCode: query.trainerReferralCode }
        : {}),
      ...(query.productId || query.categoryId
        ? { items: { some: itemFilter } }
        : {}),
      ...(query.q
        ? {
            OR: [
              {
                saleNumber: { contains: query.q, mode: "insensitive" as const },
              },
              { orderId: { contains: query.q, mode: "insensitive" as const } },
              {
                customerName: {
                  contains: query.q,
                  mode: "insensitive" as const,
                },
              },
              {
                customerPhone: {
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

  private async ensureProducts(
    tx: Prisma.TransactionClient,
    items: readonly CreateSaleItemDto[],
  ): Promise<void> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const productCount = await tx.product.count({
      where: { id: { in: productIds } },
    });
    if (productCount !== productIds.length)
      throw new NotFoundException("One or more products were not found");
  }

  private ledgerEntries(
    items: readonly PreparedItem[],
    date: Date,
    createdAt: Date,
  ): SaleLedgerEntry[] {
    return items.map((item) => ({
      type: "sale",
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      occurredAt: date,
      createdAt,
    }));
  }

  private costSnapshot(
    replay: Map<string, { saleCosts: Map<string, Prisma.Decimal> }>,
    productId: string,
    itemId: string,
  ): Prisma.Decimal {
    const snapshot = replay.get(productId)?.saleCosts.get(itemId);
    if (!snapshot)
      throw new ConflictException("Sale cost could not be calculated");
    return snapshot;
  }
}

function rethrowSaleWriteError(error: unknown): never {
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
