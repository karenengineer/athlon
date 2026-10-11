import { PrismaService } from "../database/prisma.service";
import { OrderPersistenceService } from "./order-persistence.service";

const createInput = {
  reference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
  idempotencyKey: "web-req-1234567890",
  requestFingerprint: "f".repeat(64),
  locale: "HY" as const,
  customerName: "Անի",
  customerEmail: "ani@example.com",
  customerPhone: "091123456",
  deliveryAddress: "Երևան",
  paymentMethod: "CARD" as const,
  currency: "AMD",
  total: "48000.00",
  items: [
    {
      productId: "4ebeb944-3503-47a2-9843-d37f1eb34768",
      sku: "SKU-ONE",
      name: "Պրոտեին",
      quantity: 2,
      unitPrice: "24000.00",
      lineTotal: "48000.00",
    },
  ],
  paymentAttempt: {
    provider: "AMERIABANK" as const,
    status: "PENDING" as const,
    ameriaOrderId: "1760000000001",
    requestIdempotencyKey: "web-req-1234567890",
    expectedAmount: "48000.00",
    currency: "AMD",
  },
};

describe("OrderPersistenceService", () => {
  const orderFindUnique = jest.fn();
  const orderCreate = jest.fn();
  const orderUpdate = jest.fn().mockResolvedValue(undefined);
  const paymentAttemptUpdate = jest.fn().mockResolvedValue(undefined);
  const notificationUpdate = jest.fn().mockResolvedValue(undefined);
  const transaction = jest.fn();
  const prisma = {
    order: { findUnique: orderFindUnique },
    paymentAttempt: { update: paymentAttemptUpdate },
    orderNotification: { update: notificationUpdate },
    $transaction: transaction,
  } as unknown as PrismaService;
  const service = new OrderPersistenceService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    orderFindUnique.mockResolvedValue(null);
    orderCreate.mockResolvedValue({ id: "order-id", ...createInput });
    transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        order: { findUnique: orderFindUnique, create: orderCreate },
        paymentAttempt: { update: paymentAttemptUpdate },
        orderNotification: { update: notificationUpdate },
      }),
    );
  });

  it("persists immutable localized product and price snapshots with the initial card attempt atomically", async () => {
    await service.createPendingOrder(createInput);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(orderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reference: createInput.reference,
        locale: "HY",
        requestFingerprint: createInput.requestFingerprint,
        customerName: "Անի",
        customerEmail: "ani@example.com",
        paymentMethod: "CARD",
        currency: "AMD",
        total: "48000.00",
        items: {
          create: [
            expect.objectContaining({
              productId: createInput.items[0]!.productId,
              sku: "SKU-ONE",
              name: "Պրոտեին",
              quantity: 2,
              unitPrice: "24000.00",
              lineTotal: "48000.00",
            }),
          ],
        },
        paymentAttempts: {
          create: expect.objectContaining({
            provider: "AMERIABANK",
            status: "PENDING",
            ameriaOrderId: "1760000000001",
            requestIdempotencyKey: createInput.idempotencyKey,
            expectedAmount: "48000.00",
            currency: "AMD",
          }),
        },
      }),
      include: { items: true, paymentAttempts: true, notifications: true },
    });
  });

  it("creates one durable merchant and customer notification intent for a delivery-payment order", async () => {
    const deliveryInput = {
      reference: createInput.reference,
      idempotencyKey: createInput.idempotencyKey,
      requestFingerprint: createInput.requestFingerprint,
      locale: createInput.locale,
      customerName: createInput.customerName,
      customerEmail: createInput.customerEmail,
      customerPhone: createInput.customerPhone,
      deliveryAddress: createInput.deliveryAddress,
      paymentMethod: "CASH_ON_DELIVERY" as const,
      currency: createInput.currency,
      total: createInput.total,
      items: createInput.items,
    };
    await service.createPendingOrder(deliveryInput);

    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notifications: {
            create: [
              { eventType: "ORDER_ACCEPTED", recipientType: "MERCHANT" },
              { eventType: "ORDER_ACCEPTED", recipientType: "CUSTOMER" },
            ],
          },
        }),
      }),
    );
  });

  it("records pending, failed, and sent notification delivery states", async () => {
    await service.recordNotificationAttempt("notification-id");
    expect(notificationUpdate).toHaveBeenCalledWith({
      where: { id: "notification-id" },
      data: { attemptCount: { increment: 1 }, status: "PENDING" },
    });

    await service.markNotificationFailed("notification-id");
    expect(notificationUpdate).toHaveBeenLastCalledWith({
      where: { id: "notification-id" },
      data: { status: "FAILED", lastErrorCode: "DELIVERY_FAILED" },
    });

    await service.markNotificationSent("notification-id");
    expect(notificationUpdate).toHaveBeenLastCalledWith({
      where: { id: "notification-id" },
      data: {
        status: "SENT",
        sentAt: expect.any(Date),
        lastErrorCode: null,
      },
    });
  });

  it("returns an existing order for a repeated idempotency key without creating another", async () => {
    const existing = {
      id: "existing-order",
      reference: createInput.reference,
      requestFingerprint: createInput.requestFingerprint,
    };
    orderFindUnique.mockResolvedValueOnce(existing);

    await expect(service.createPendingOrder(createInput)).resolves.toEqual({
      order: existing,
      created: false,
    });
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("rejects reuse of an idempotency key with a different request fingerprint", async () => {
    orderFindUnique.mockResolvedValueOnce({
      id: "existing-order",
      reference: createInput.reference,
      requestFingerprint: "a".repeat(64),
    });

    await expect(
      service.createPendingOrder({
        ...createInput,
        requestFingerprint: "b".repeat(64),
      }),
    ).rejects.toThrow("Idempotency key was used for a different order");
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("recovers an idempotency race by returning the order created by the concurrent request", async () => {
    const existing = {
      id: "concurrent-order",
      reference: createInput.reference,
      requestFingerprint: createInput.requestFingerprint,
    };
    const uniqueConflict = Object.assign(new Error("unique constraint"), {
      code: "P2002",
      meta: { target: ["idempotencyKey"] },
    });
    transaction.mockRejectedValueOnce(uniqueConflict);
    orderFindUnique.mockResolvedValueOnce(existing);

    await expect(service.createPendingOrder(createInput)).resolves.toEqual({
      order: existing,
      created: false,
    });
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("marks a failed provider initialization on both the order and pending attempt", async () => {
    transaction.mockImplementationOnce((callback: (tx: unknown) => unknown) =>
      callback({
        order: { update: orderUpdate },
        paymentAttempt: { update: paymentAttemptUpdate },
      }),
    );

    await service.markInitializationFailed("order-id");

    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-id" },
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
});
