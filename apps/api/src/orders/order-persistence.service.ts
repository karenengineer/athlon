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

  async recordNotificationAttempt(notificationId: string): Promise<void> {
    await this.prisma.orderNotification.update({
      where: { id: notificationId },
      data: { attemptCount: { increment: 1 }, status: "PENDING" },
    });
  }

  async markNotificationSent(notificationId: string): Promise<void> {
    await this.prisma.orderNotification.update({
      where: { id: notificationId },
      data: { status: "SENT", sentAt: new Date(), lastErrorCode: null },
    });
  }

  async markNotificationFailed(notificationId: string): Promise<void> {
    await this.prisma.orderNotification.update({
      where: { id: notificationId },
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
