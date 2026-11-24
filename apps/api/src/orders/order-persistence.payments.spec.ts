import { OrderPersistenceService } from "./order-persistence.service";

describe("OrderPersistenceService card payment state", () => {
  const updateMany = jest.fn();
  const orderUpdate = jest.fn();
  const createMany = jest.fn();
  const queryRaw = jest.fn();
  const findUnique = jest.fn();
  const tx = {
    paymentAttempt: { updateMany },
    order: { update: orderUpdate },
    orderNotification: { createMany },
  };
  const prisma = {
    $transaction: jest.fn((run: (client: typeof tx) => unknown) => run(tx)),
    $queryRaw: queryRaw,
    paymentAttempt: { findUnique },
  };
  const service = new OrderPersistenceService(prisma as never);
  const input = {
    orderId: "order-id",
    paymentAttemptId: "attempt-id",
    providerStatus: "payment_deposited",
  };

  beforeEach(() => jest.clearAllMocks());

  it("moves a pending attempt to PAID once and creates confirmation intents", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await expect(
      service.applyVerifiedPaymentStatus({ ...input, status: "PAID" }),
    ).resolves.toEqual({ changed: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "attempt-id",
        orderId: "order-id",
        status: { in: ["PENDING", "FAILED", "EXPIRED"] },
      },
      data: { status: "PAID", providerStatus: "payment_deposited" },
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-id" },
      data: { status: "PAID" },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          orderId: "order-id",
          eventType: "PAYMENT_CONFIRMED",
          recipientType: "MERCHANT",
        },
        {
          orderId: "order-id",
          eventType: "PAYMENT_CONFIRMED",
          recipientType: "CUSTOMER",
        },
      ],
      skipDuplicates: true,
    });
  });

  it("does nothing when another request already applied the status", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.applyVerifiedPaymentStatus({ ...input, status: "PAID" }),
    ).resolves.toEqual({ changed: false });
    expect(orderUpdate).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });

  it("accepts a late bank decline after a local timeout and never downgrades a paid attempt", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await service.applyVerifiedPaymentStatus({ ...input, status: "FAILED" });
    expect(updateMany.mock.calls[0][0].where.status).toEqual({
      in: ["PENDING", "EXPIRED"],
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-id" },
      data: { status: "PAYMENT_FAILED" },
    });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("requires a matching unpaid attempt and no previous payment confirmation", async () => {
    const retry = {
      ...input,
      status: "CANCELLED",
      providerStatus: "payment_void",
    } as const;
    findUnique.mockResolvedValueOnce({ id: "attempt-id" });
    await expect(service.hasVerifiedUnpaidAttempt(retry)).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: "attempt-id",
        orderId: "order-id",
        status: "CANCELLED",
        providerStatus: "payment_void",
        order: {
          notifications: { none: { eventType: "PAYMENT_CONFIRMED" } },
        },
      },
      select: { id: true },
    });
    findUnique.mockResolvedValueOnce(null);
    await expect(service.hasVerifiedUnpaidAttempt(retry)).resolves.toBe(false);
  });

  it("allocates bank OrderIDs from the database sequence", async () => {
    queryRaw.mockResolvedValue([{ id: BigInt(410000007) }]);
    await expect(service.nextAmeriaOrderId()).resolves.toBe("410000007");
  });
});
