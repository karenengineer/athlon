import { ConflictException, Injectable } from "@nestjs/common";
import {
  Locale,
  OrderPaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";

export interface PendingOrderItemSnapshot {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string | null;
  lineTotal: string | null;
}

export interface PendingPaymentAttemptInput {
  provider: PaymentProvider;
  status: PaymentStatus;
  ameriaOrderId: string;
  requestIdempotencyKey: string;
  expectedAmount: string;
  currency: string;
}

export interface CreatePendingOrderInput {
  reference: string;
  idempotencyKey: string;
  requestFingerprint: string;
  locale: Locale;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMethod: OrderPaymentMethod;
  currency: string;
  total: string | null;
  items: PendingOrderItemSnapshot[];
  paymentAttempt?: PendingPaymentAttemptInput;
}

const orderInclude = {
  items: true,
  paymentAttempts: true,
  notifications: true,
} satisfies Prisma.OrderInclude;

const unsentNotification = { status: { not: "SENT" as const } };

type VerifiedAttemptStatus = Exclude<PaymentStatus, "PENDING">;

/** Attempt states a bank-verified status may replace. The bank is the source
 * of truth, so a late deposit still wins over a local FAILED/EXPIRED guess,
 * but nothing ever moves back to PENDING and PAID only leaves via a verified
 * void or refund. */
const allowedPreviousStatuses: Record<VerifiedAttemptStatus, PaymentStatus[]> =
  {
    PAID: ["PENDING", "FAILED", "EXPIRED"],
    FAILED: ["PENDING"],
    EXPIRED: ["PENDING"],
    CANCELLED: ["PENDING", "PAID", "FAILED", "EXPIRED"],
  };

const orderStatusFor = {
  PAID: "PAID",
  FAILED: "PAYMENT_FAILED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED",
} as const satisfies Record<VerifiedAttemptStatus, string>;

@Injectable()
export class OrderPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async createPendingOrder(input: CreatePendingOrderInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: orderInclude,
        });
        if (existing) return checkedExistingOrder(existing, input);

        const order = await tx.order.create({
          data: {
            reference: input.reference,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: input.requestFingerprint,
            locale: input.locale,
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            customerPhone: input.customerPhone,
            deliveryAddress: input.deliveryAddress,
            paymentMethod: input.paymentMethod,
            status: input.paymentAttempt ? "PAYMENT_PENDING" : "PENDING",
            currency: input.currency,
            total: input.total,
            items: { create: input.items },
            ...(input.paymentAttempt
              ? { paymentAttempts: { create: input.paymentAttempt } }
              : {}),
            ...(input.paymentMethod === "CASH_ON_DELIVERY"
              ? {
                  notifications: {
                    create: [
                      {
                        eventType: "ORDER_ACCEPTED" as const,
                        recipientType: "MERCHANT" as const,
                      },
                      {
                        eventType: "ORDER_ACCEPTED" as const,
                        recipientType: "CUSTOMER" as const,
                      },
                    ],
                  },
                }
              : {}),
          },
          include: orderInclude,
        });
        return { order, created: true };
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: orderInclude,
      });
      if (!existing) throw error;
      return checkedExistingOrder(existing, input);
    }
  }

  findByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.order.findUnique({
      where: { idempotencyKey },
      include: orderInclude,
    });
  }

  async markInitializationFailed(orderId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "PAYMENT_FAILED",
          paymentAttempts: {
            updateMany: {
              where: { status: "PENDING" },
              data: { status: "FAILED", providerStatus: "INIT_FAILED" },
            },
          },
        },
      });
    });
  }

  async recordProviderPaymentId(
    paymentAttemptId: string,
    providerPaymentId: string,
    checkoutUrl: string,
  ): Promise<void> {
    await this.prisma.paymentAttempt.update({
      where: { id: paymentAttemptId },
      data: { providerPaymentId, checkoutUrl },
    });
  }

  createMerchantTelegramNotification(
    orderId: string,
    eventType: "ORDER_ACCEPTED" | "PAYMENT_CONFIRMED" = "ORDER_ACCEPTED",
  ) {
    return this.prisma.orderNotification.create({
      data: {
        orderId,
        eventType,
        recipientType: "MERCHANT_TELEGRAM",
      },
      select: { id: true },
    });
  }

  /** Next vPOS OrderID: a unique positive int32 from a database sequence. */
  async nextAmeriaOrderId(): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ id: bigint | number }>>`
      SELECT nextval('ameria_live_order_id_seq') AS id
    `;
    const id = rows[0]?.id;
    if (id === undefined) throw new Error("Could not allocate a bank order id");
    return id.toString();
  }

  findCardOrderForVerification(reference: string) {
    return this.prisma.order.findUnique({
      where: { reference },
      include: {
        paymentAttempts: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
  }

  findOrderWithNotifications(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
  }

  /**
   * Apply a bank-verified attempt status. The conditional update makes the
   * transition atomic and idempotent: concurrent pollers cannot both move an
   * attempt to PAID, so payment-confirmed notifications are created once.
   */
  async applyVerifiedPaymentStatus(input: {
    orderId: string;
    paymentAttemptId: string;
    status: VerifiedAttemptStatus;
    providerStatus: string;
  }): Promise<{ changed: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.paymentAttempt.updateMany({
        where: {
          id: input.paymentAttemptId,
          orderId: input.orderId,
          status: { in: allowedPreviousStatuses[input.status] },
        },
        data: {
          status: input.status,
          providerStatus: input.providerStatus.slice(0, 100),
        },
      });
      if (updated.count !== 1) return { changed: false };

      await tx.order.update({
        where: { id: input.orderId },
        data: { status: orderStatusFor[input.status] },
      });
      if (input.status === "PAID") {
        await tx.orderNotification.createMany({
          data: (["MERCHANT", "CUSTOMER"] as const).map((recipientType) => ({
            orderId: input.orderId,
            eventType: "PAYMENT_CONFIRMED" as const,
            recipientType,
          })),
          skipDuplicates: true,
        });
      }
      return { changed: true };
    });
  }

  /** Card attempts still waiting for a bank verdict, oldest first. */
  findPendingCardOrderReferences(input: {
    createdBefore: Date;
    createdAfter: Date;
    limit: number;
  }) {
    return this.prisma.order.findMany({
      where: {
        paymentMethod: "CARD",
        status: "PAYMENT_PENDING",
        createdAt: { lt: input.createdBefore, gt: input.createdAfter },
        paymentAttempts: {
          some: { status: "PENDING", providerPaymentId: { not: null } },
        },
      },
      orderBy: { createdAt: "asc" },
      take: input.limit,
      select: { reference: true },
    });
  }

  async recordNotificationAttempt(
    notificationId: string,
    { skipSent = false } = {},
  ): Promise<void> {
    await this.prisma.orderNotification.update({
      where: { id: notificationId, ...(skipSent ? unsentNotification : {}) },
      data: { attemptCount: { increment: 1 }, status: "PENDING" },
    });
  }

  async markNotificationSent(notificationId: string): Promise<void> {
    await this.prisma.orderNotification.update({
      where: { id: notificationId },
      data: { status: "SENT", sentAt: new Date(), lastErrorCode: null },
    });
  }

  async markNotificationFailed(
    notificationId: string,
    { skipSent = false } = {},
  ): Promise<void> {
    await this.prisma.orderNotification.update({
      where: { id: notificationId, ...(skipSent ? unsentNotification : {}) },
      data: { status: "FAILED", lastErrorCode: "DELIVERY_FAILED" },
    });
  }
}

function checkedExistingOrder<T extends { requestFingerprint: string }>(
  order: T,
  input: CreatePendingOrderInput,
) {
  if (order.requestFingerprint !== input.requestFingerprint) {
    throw new ConflictException(
      "Idempotency key was used for a different order",
    );
  }
  return { order, created: false };
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === "P2002";
}
