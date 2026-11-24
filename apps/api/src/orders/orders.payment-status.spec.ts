import { BadRequestException, NotFoundException } from "@nestjs/common";
import { OrdersService } from "./orders.service";

const reference = "ATH-1234ABCD1234ABCD1234ABCD1234ABCD";

describe("OrdersService payment status", () => {
  const send = jest.fn();
  const sendCustomer = jest.fn();
  const sendTelegram = jest.fn();
  const persistence = {
    findCheckoutByIdempotencyKey: jest.fn(),
    findOrderWithNotifications: jest.fn(),
    findPendingCardOrderReferences: jest.fn(),
    recordNotificationAttempt: jest.fn(),
    markNotificationSent: jest.fn(),
    markNotificationFailed: jest.fn(),
    createMerchantTelegramNotification: jest.fn(),
  };
  const initializer = {
    isEnabled: true,
    isTrustedCheckoutUrl: () => true,
    initialize: jest.fn(),
    verifyAndApplyStatus: jest.fn(),
  };
  const service = new OrdersService(
    {} as never,
    { send, sendCustomer } as never,
    persistence as never,
    initializer,
    { isEnabled: true, send: sendTelegram } as never,
  );
  const paidOrder = {
    id: "order-id",
    reference,
    locale: "RU",
    customerName: "Fixture",
    customerEmail: "fixture@example.test",
    customerPhone: "091123456",
    deliveryAddress: "Fixture address",
    total: "13000",
    items: [
      {
        sku: "SKU",
        name: "Whey",
        quantity: 1,
        unitPrice: "13000",
        lineTotal: "13000",
      },
    ],
    notifications: [
      {
        id: "m",
        status: "PENDING",
        recipientType: "MERCHANT",
        eventType: "PAYMENT_CONFIRMED",
      },
      {
        id: "c",
        status: "PENDING",
        recipientType: "CUSTOMER",
        eventType: "PAYMENT_CONFIRMED",
      },
    ],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    initializer.isEnabled = true;
    persistence.createMerchantTelegramNotification.mockResolvedValue({
      id: "t",
    });
  });

  it("rejects malformed references before touching the bank", async () => {
    await expect(service.paymentStatus("not-a-ref")).rejects.toThrow(
      BadRequestException,
    );
    expect(initializer.verifyAndApplyStatus).not.toHaveBeenCalled();
  });

  it("rejects an invalid checkout key before looking for an order", async () => {
    await expect(service.checkoutStatus("short")).rejects.toThrow(
      BadRequestException,
    );
    expect(persistence.findCheckoutByIdempotencyKey).not.toHaveBeenCalled();
  });

  it("reports missing checkouts and withholds cash order information", async () => {
    persistence.findCheckoutByIdempotencyKey.mockResolvedValueOnce(null);
    await expect(service.checkoutStatus("checkout-key")).resolves.toEqual({
      paymentStatus: "NOT_FOUND",
    });
    persistence.findCheckoutByIdempotencyKey.mockResolvedValueOnce({
      reference,
      paymentMethod: "CASH_ON_DELIVERY",
    });
    await expect(service.checkoutStatus("checkout-key")).rejects.toThrow(
      NotFoundException,
    );
    expect(initializer.verifyAndApplyStatus).not.toHaveBeenCalled();
  });

  it("returns only the public bank-verified status for a card checkout key", async () => {
    persistence.findCheckoutByIdempotencyKey.mockResolvedValue({
      reference,
      paymentMethod: "CARD",
    });
    initializer.verifyAndApplyStatus.mockResolvedValue({
      orderReference: reference,
      paymentStatus: "FAILED",
      locale: "RU",
      retryAllowed: true,
    });

    await expect(service.checkoutStatus("checkout-key")).resolves.toEqual({
      orderReference: reference,
      paymentStatus: "FAILED",
      locale: "RU",
      retryAllowed: true,
    });
    expect(initializer.verifyAndApplyStatus).toHaveBeenCalledWith(reference);
  });

  it("sends paid-by-card notifications only on the transition to PAID and hides internals", async () => {
    initializer.verifyAndApplyStatus.mockResolvedValue({
      orderReference: reference,
      paymentStatus: "PAID",
      locale: "RU",
      newlyPaidOrderId: "order-id",
    });
    persistence.findOrderWithNotifications.mockResolvedValue(paidOrder);

    const result = await service.paymentStatus(reference);

    expect(result).toEqual({
      orderReference: reference,
      paymentStatus: "PAID",
      locale: "RU",
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ orderReference: reference, paidByCard: true }),
      "m",
    );
    expect(sendCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ paidByCard: true }),
      "c",
    );
    expect(persistence.createMerchantTelegramNotification).toHaveBeenCalledWith(
      "order-id",
      "PAYMENT_CONFIRMED",
    );
    expect(sendTelegram).toHaveBeenCalledWith(
      expect.objectContaining({ paidByCard: true }),
    );

    jest.clearAllMocks();
    initializer.verifyAndApplyStatus.mockResolvedValue({
      orderReference: reference,
      paymentStatus: "PAID",
      locale: "RU",
    });
    await service.paymentStatus(reference);
    expect(send).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("still answers PAID when notification delivery fails", async () => {
    initializer.verifyAndApplyStatus.mockResolvedValue({
      orderReference: reference,
      paymentStatus: "PAID",
      locale: "RU",
      newlyPaidOrderId: "order-id",
    });
    persistence.findOrderWithNotifications.mockResolvedValue(paidOrder);
    send.mockRejectedValue(new Error("mail down"));
    await expect(service.paymentStatus(reference)).resolves.toMatchObject({
      paymentStatus: "PAID",
    });
  });

  it("reconciles pending card orders and skips work while payments are off", async () => {
    persistence.findPendingCardOrderReferences.mockResolvedValue([
      { reference },
      { reference: "ATH-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF" },
    ]);
    initializer.verifyAndApplyStatus
      .mockResolvedValueOnce({
        orderReference: reference,
        paymentStatus: "PENDING",
        locale: "HY",
      })
      .mockRejectedValueOnce(new Error("bank down"));
    await expect(service.reconcilePendingCardPayments()).resolves.toBe(1);

    initializer.isEnabled = false;
    jest.clearAllMocks();
    await expect(service.reconcilePendingCardPayments()).resolves.toBe(0);
    expect(persistence.findPendingCardOrderReferences).not.toHaveBeenCalled();
  });
});
