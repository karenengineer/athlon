import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { OrderEmailService } from "./order-email.service";
import { OrderPersistenceService } from "./order-persistence.service";
import { OrderTelegramService } from "./order-telegram.service";
import { createOrderRequestFingerprint, OrdersService } from "./orders.service";

const productId = "4ebeb944-3503-47a2-9843-d37f1eb34768";
const orderInput = {
  locale: "hy" as const,
  paymentMethod: "CARD" as const,
  customer: {
    name: "Անի",
    email: "ani@example.com",
    phone: "091123456",
    address: "Երևան",
  },
  items: [{ productId, quantity: 2, expectedUnitPrice: "24000" }],
};
/** Cash orders placed before checkout became card-only. */
const cashInput = { ...orderInput, paymentMethod: "CASH_ON_DELIVERY" as const };
const persistedOrder = {
  id: "order-id",
  reference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
  locale: "HY",
  customerName: "Անի",
  customerEmail: "ani@example.com",
  customerPhone: "091123456",
  deliveryAddress: "Երևան",
  total: "48000",
  items: [
    {
      sku: "SKU-ONE",
      name: "Պրոտեին",
      quantity: 2,
      unitPrice: "24000",
      lineTotal: "48000",
    },
  ],
  paymentAttempts: [{ id: "attempt-id", ameriaOrderId: "1760000000001" }],
  notifications: [
    {
      id: "merchant-notification",
      status: "PENDING",
      recipientType: "MERCHANT",
    },
    {
      id: "customer-notification",
      status: "PENDING",
      recipientType: "CUSTOMER",
    },
  ],
};
const telegramNotification = {
  id: "telegram-notification",
  status: "PENDING",
  recipientType: "MERCHANT_TELEGRAM",
};

describe("OrdersService", () => {
  const findProducts = jest.fn();
  const findOrderByIdempotencyKey = jest.fn();
  const sendEmail = jest.fn().mockResolvedValue(undefined);
  const sendCustomerEmail = jest.fn().mockResolvedValue(undefined);
  const createPendingOrder = jest.fn();
  const createMerchantTelegramNotification = jest.fn();
  const markInitializationFailed = jest.fn().mockResolvedValue(undefined);
  const recordProviderPaymentId = jest.fn().mockResolvedValue(undefined);
  const recordNotificationAttempt = jest.fn().mockResolvedValue(undefined);
  const markNotificationSent = jest.fn().mockResolvedValue(undefined);
  const markNotificationFailed = jest.fn().mockResolvedValue(undefined);
  const initializePayment = jest.fn();
  const email = {
    send: sendEmail,
    sendCustomer: sendCustomerEmail,
  } as unknown as OrderEmailService;
  const persistence = {
    createPendingOrder,
    createMerchantTelegramNotification,
    findByIdempotencyKey: findOrderByIdempotencyKey,
    markInitializationFailed,
    recordProviderPaymentId,
    recordNotificationAttempt,
    markNotificationSent,
    markNotificationFailed,
    nextAmeriaOrderId: jest.fn(() => Promise.resolve("410000001")),
  } as unknown as OrderPersistenceService;
  const paymentInitializer = {
    initialize: initializePayment,
    verifyAndApplyStatus: jest.fn(),
    isEnabled: true,
    isTrustedCheckoutUrl: (url: string) =>
      url.startsWith("https://payments.example.test/"),
  };
  const service = new OrdersService(
    { product: { findMany: findProducts } } as unknown as PrismaService,
    email,
    persistence,
    paymentInitializer,
  );
  const sendTelegram = jest.fn();
  const telegram = { isEnabled: true, send: sendTelegram };
  const telegramOrders = new OrdersService(
    { product: { findMany: findProducts } } as unknown as PrismaService,
    email,
    persistence,
    paymentInitializer,
    telegram as unknown as OrderTelegramService,
  );
  const publishedProduct = {
    id: productId,
    sku: "SKU-ONE",
    published: true,
    availability: "IN_STOCK",
    price: "24000",
    currency: "AMD",
    translations: [
      { locale: "HY", name: "Պրոտեին" },
      { locale: "RU", name: "Протеин" },
    ],
  };

  beforeEach(() => {
    findProducts.mockReset().mockResolvedValue([publishedProduct]);
    sendEmail.mockReset().mockResolvedValue(undefined);
    sendCustomerEmail.mockReset().mockResolvedValue(undefined);
    createPendingOrder.mockReset().mockResolvedValue({
      order: persistedOrder,
      created: true,
    });
    createMerchantTelegramNotification
      .mockReset()
      .mockResolvedValue({ id: telegramNotification.id });
    sendTelegram.mockReset().mockResolvedValue(undefined);
    telegram.isEnabled = true;
    findOrderByIdempotencyKey.mockReset().mockResolvedValue(null);
    markInitializationFailed.mockReset().mockResolvedValue(undefined);
    recordProviderPaymentId.mockReset().mockResolvedValue(undefined);
    recordNotificationAttempt.mockReset().mockResolvedValue(undefined);
    markNotificationSent.mockReset().mockResolvedValue(undefined);
    markNotificationFailed.mockReset().mockResolvedValue(undefined);
    initializePayment.mockReset().mockResolvedValue({
      providerPaymentId: "provider-payment-1",
      checkoutUrl: "https://payments.example.test/checkout/1",
    });
    paymentInitializer.isEnabled = true;
    paymentInitializer.isTrustedCheckoutUrl = (url: string) =>
      url.startsWith("https://payments.example.test/");
  });

  it("rejects new cash-on-delivery orders before pricing, saving or notifying", async () => {
    const { paymentMethod: _omitted, ...withoutMethod } = orderInput;
    void _omitted;
    for (const input of [cashInput, withoutMethod]) {
      await expect(
        telegramOrders.submit(input, "web-cash-rejected-1234"),
      ).rejects.toThrow("Only online card payment is available");
    }
    expect(findProducts).not.toHaveBeenCalled();
    expect(createPendingOrder).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it.each(["CARD"] as const)(
    "rejects resistance bands for %s before persisting or initializing payment",
    async (paymentMethod) => {
      const band = {
        ...publishedProduct,
        category: { slug: "resistance-bands" },
      };
      findProducts.mockImplementationOnce(
        ({ where }: { where: { category?: { slug: { not: string } } } }) =>
          Promise.resolve(
            where.category?.slug.not === band.category.slug ? [] : [band],
          ),
      );

      await expect(
        service.submit({ ...orderInput, paymentMethod }, "web-order-band"),
      ).rejects.toThrow("One or more products cannot be ordered");
      expect(createPendingOrder).not.toHaveBeenCalled();
      expect(initializePayment).not.toHaveBeenCalled();
    },
  );

  it("still answers a retry of a cash order placed before card-only checkout", async () => {
    findOrderByIdempotencyKey.mockResolvedValueOnce({
      ...persistedOrder,
      paymentMethod: "CASH_ON_DELIVERY",
      requestFingerprint: createOrderRequestFingerprint(cashInput),
      notifications: persistedOrder.notifications.map((notification) => ({
        ...notification,
        status: "SENT",
      })),
    });

    await expect(
      service.submit(cashInput, "web-req-retry-1234"),
    ).resolves.toEqual({
      kind: "COD_ACCEPTED",
      accepted: true,
      orderReference: persistedOrder.reference,
    });
    expect(findProducts).not.toHaveBeenCalled();
    expect(createPendingOrder).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendCustomerEmail).not.toHaveBeenCalled();
  });

  it("rejects a reused key for an edited order before repricing or sending notifications", async () => {
    findOrderByIdempotencyKey.mockResolvedValueOnce({
      ...persistedOrder,
      paymentMethod: "CASH_ON_DELIVERY",
      requestFingerprint: "a".repeat(64),
    });

    await expect(
      service.submit(
        {
          ...orderInput,
          customer: { ...orderInput.customer, address: "Other" },
        },
        "web-req-edited-1234",
      ),
    ).rejects.toThrow(ConflictException);
    expect(findProducts).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("recovers a pending card checkout URL on the same idempotent request", async () => {
    const input = { ...orderInput, paymentMethod: "CARD" as const };
    const key = "web-card-retry-1234";
    const first = await service.submit(input, key);
    const fingerprint = createPendingOrder.mock.calls[0]![0].requestFingerprint;
    initializePayment.mockClear();
    findProducts.mockClear();
    findOrderByIdempotencyKey.mockResolvedValueOnce({
      ...persistedOrder,
      paymentMethod: "CARD",
      status: "PAYMENT_PENDING",
      requestFingerprint: fingerprint,
      paymentAttempts: [
        {
          id: "attempt-id",
          status: "PENDING",
          providerPaymentId: "provider-payment-1",
          checkoutUrl: "https://payments.example.test/checkout/1",
        },
      ],
    });

    await expect(service.submit(input, key)).resolves.toEqual(first);
    expect(findProducts).not.toHaveBeenCalled();
    expect(initializePayment).not.toHaveBeenCalled();
  });

  it("does not recover a card checkout URL after card payments are disabled", async () => {
    const input = { ...orderInput, paymentMethod: "CARD" as const };
    const key = "web-card-disabled-123";
    await service.submit(input, key);
    const fingerprint = createPendingOrder.mock.calls[0]![0].requestFingerprint;
    findOrderByIdempotencyKey.mockResolvedValueOnce({
      ...persistedOrder,
      paymentMethod: "CARD",
      status: "PAYMENT_PENDING",
      requestFingerprint: fingerprint,
      paymentAttempts: [
        {
          id: "attempt-id",
          status: "PENDING",
          checkoutUrl: "https://payments.example.test/checkout/1",
        },
      ],
    });
    paymentInitializer.isEnabled = false;

    await expect(service.submit(input, key)).rejects.toThrow(ConflictException);
  });

  it("keeps a same-payload retry retryable while checkout initialization is pending", async () => {
    const input = { ...orderInput, paymentMethod: "CARD" as const };
    const key = "web-card-init-pending-123";
    await service.submit(input, key);
    const fingerprint = createPendingOrder.mock.calls[0]![0].requestFingerprint;
    findOrderByIdempotencyKey.mockResolvedValueOnce({
      ...persistedOrder,
      paymentMethod: "CARD",
      status: "PAYMENT_PENDING",
      requestFingerprint: fingerprint,
      paymentAttempts: [
        { id: "attempt-id", status: "PENDING", checkoutUrl: null },
      ],
    });

    await expect(service.submit(input, key)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(createPendingOrder).toHaveBeenCalledTimes(1);
    expect(initializePayment).toHaveBeenCalledTimes(1);
  });

  it("recovers a checkout initialized by a concurrent request", async () => {
    const input = { ...orderInput, paymentMethod: "CARD" as const };
    const key = "web-card-race-1234";
    const fingerprintOrder = {
      ...persistedOrder,
      paymentMethod: "CARD",
      status: "PAYMENT_PENDING",
      requestFingerprint: "",
      paymentAttempts: [
        {
          id: "attempt-id",
          status: "PENDING",
          checkoutUrl: "https://payments.example.test/checkout/1",
        },
      ],
    };
    let requestFingerprint = "";
    findOrderByIdempotencyKey
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(() =>
        Promise.resolve({
          ...fingerprintOrder,
          requestFingerprint,
        }),
      );
    createPendingOrder.mockImplementationOnce(
      (order: { requestFingerprint: string }) => {
        requestFingerprint = order.requestFingerprint;
        return Promise.resolve({
          order: { ...fingerprintOrder, requestFingerprint },
          created: false,
        });
      },
    );

    const result = await service.submit(input, key);

    expect(result).toEqual({
      kind: "CARD_PAYMENT_PENDING",
      accepted: true,
      orderReference: persistedOrder.reference,
      paymentStatus: "PENDING",
      checkoutUrl: "https://payments.example.test/checkout/1",
    });
    expect(initializePayment).not.toHaveBeenCalled();
  });

  it("retries only failed durable notifications when a historical cash order is retried", async () => {
    findOrderByIdempotencyKey.mockResolvedValueOnce({
      ...persistedOrder,
      paymentMethod: "CASH_ON_DELIVERY",
      requestFingerprint: createOrderRequestFingerprint(cashInput),
      notifications: [
        { ...persistedOrder.notifications[0]!, status: "SENT" },
        { ...persistedOrder.notifications[1]!, status: "FAILED" },
      ],
    });

    await service.submit(cashInput, "web-req-duplicate-1234");

    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendCustomerEmail).toHaveBeenCalledTimes(1);
    expect(sendCustomerEmail).toHaveBeenCalledWith(
      expect.objectContaining({ orderReference: persistedOrder.reference }),
      "customer-notification",
    );
    expect(markNotificationSent).toHaveBeenCalledTimes(1);
  });

  it("never adds a Telegram intent when replaying a historical COD order", async () => {
    findOrderByIdempotencyKey.mockResolvedValueOnce({
      ...persistedOrder,
      paymentMethod: "CASH_ON_DELIVERY",
      requestFingerprint: createOrderRequestFingerprint(cashInput),
    });

    await expect(
      telegramOrders.submit(cashInput, "web-telegram-historical"),
    ).resolves.toMatchObject({ kind: "COD_ACCEPTED" });
    expect(createPendingOrder).not.toHaveBeenCalled();
    expect(createMerchantTelegramNotification).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("does not create a Telegram intent for a card checkout", async () => {
    await telegramOrders.submit(
      { ...orderInput, paymentMethod: "CARD" },
      "web-telegram-card",
    );

    expect(createMerchantTelegramNotification).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("retries a failed Telegram intent of a historical cash order and skips it once sent", async () => {
    const replay = {
      ...persistedOrder,
      paymentMethod: "CASH_ON_DELIVERY",
      requestFingerprint: createOrderRequestFingerprint(cashInput),
    };
    const sentEmails = persistedOrder.notifications.map((notification) => ({
      ...notification,
      status: "SENT",
    }));
    findOrderByIdempotencyKey
      .mockResolvedValueOnce({
        ...replay,
        notifications: [
          ...sentEmails,
          { ...telegramNotification, status: "FAILED" },
        ],
      })
      .mockResolvedValueOnce({
        ...replay,
        notifications: [
          ...sentEmails,
          { ...telegramNotification, status: "SENT" },
        ],
      });
    const key = "web-telegram-retry";

    await expect(telegramOrders.submit(cashInput, key)).resolves.toMatchObject({
      kind: "COD_ACCEPTED",
    });
    expect(markNotificationSent).toHaveBeenLastCalledWith(
      telegramNotification.id,
    );
    await telegramOrders.submit(cashInput, key);
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    expect(createMerchantTelegramNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendCustomerEmail).not.toHaveBeenCalled();
  });

  it("creates a pending card attempt and returns the validated hosted checkout URL", async () => {
    const result = await service.submit(
      { ...orderInput, paymentMethod: "CARD" },
      "web-card-1234567890",
    );

    expect(result).toEqual({
      kind: "CARD_PAYMENT_PENDING",
      accepted: true,
      orderReference: persistedOrder.reference,
      paymentStatus: "PENDING",
      checkoutUrl: "https://payments.example.test/checkout/1",
    });
    expect(createPendingOrder.mock.calls[0]![0].requestFingerprint).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(createPendingOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: "CARD",
        paymentAttempt: expect.objectContaining({
          provider: "AMERIABANK",
          status: "PENDING",
          currency: "AMD",
          expectedAmount: "48000",
        }),
      }),
    );
    expect(initializePayment).toHaveBeenCalledWith(persistedOrder);
    expect(recordProviderPaymentId).toHaveBeenCalledWith(
      "attempt-id",
      "provider-payment-1",
      "https://payments.example.test/checkout/1",
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a checkout URL outside the configured bank host", async () => {
    paymentInitializer.isTrustedCheckoutUrl = () => false;

    await expect(
      service.submit(
        { ...orderInput, paymentMethod: "CARD" },
        "web-card-untrusted-123",
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(markInitializationFailed).toHaveBeenCalledWith(persistedOrder.id);
  });

  it("fails closed when no card payment initializer is configured", async () => {
    const noPaymentService = new OrdersService(
      { product: { findMany: findProducts } } as unknown as PrismaService,
      email,
      persistence,
    );

    await expect(
      noPaymentService.submit(
        { ...orderInput, paymentMethod: "CARD" },
        "card-no-provider-123",
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  it("rejects a card basket with an unknown price before persisting it", async () => {
    findProducts.mockResolvedValueOnce([{ ...publishedProduct, price: null }]);

    await expect(
      service.submit(
        {
          ...orderInput,
          paymentMethod: "CARD",
          items: [{ productId, quantity: 1, expectedUnitPrice: null }],
        },
        "card-unpriced-12345678",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  it("rejects products with non-AMD currency", async () => {
    findProducts.mockResolvedValueOnce([
      { ...publishedProduct, currency: "USD" },
    ]);

    await expect(
      service.submit(orderInput, "web-req-usd-123456"),
    ).rejects.toThrow(ConflictException);
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  it("rejects a stale basket price before persisting or emailing", async () => {
    await expect(
      service.submit(
        {
          ...orderInput,
          items: [{ ...orderInput.items[0]!, expectedUnitPrice: "20000" }],
        },
        "web-req-stale-123456",
      ),
    ).rejects.toThrow(ConflictException);
    expect(createPendingOrder).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("persists a failed order/payment state if provider initialization fails", async () => {
    initializePayment.mockRejectedValueOnce(new Error("provider timeout"));

    await expect(
      service.submit(
        { ...orderInput, paymentMethod: "CARD" },
        "web-card-fail-123456",
      ),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(createPendingOrder).toHaveBeenCalled();
    expect(markInitializationFailed).toHaveBeenCalledWith(persistedOrder.id);
  });

  it("rejects unknown or unpublished products", async () => {
    findProducts.mockResolvedValueOnce([]);

    await expect(
      service.submit(orderInput, "web-req-unknown-123456"),
    ).rejects.toThrow(BadRequestException);
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  describe.each(["CARD"] as const)("%s availability", (paymentMethod) => {
    it.each([
      "OUT_OF_STOCK",
      "PREORDER",
      "ON_REQUEST",
      undefined,
      null,
      "UNKNOWN",
    ])(
      "rejects %s products before creating orders, payments, or notifications",
      async (availability) => {
        findProducts.mockResolvedValueOnce([
          { ...publishedProduct, availability },
        ]);

        await expect(
          service.submit(
            { ...orderInput, paymentMethod },
            "web-req-stock-123456",
          ),
        ).rejects.toThrow(ConflictException);
        expect(createPendingOrder).not.toHaveBeenCalled();
        expect(initializePayment).not.toHaveBeenCalled();
        expect(recordProviderPaymentId).not.toHaveBeenCalled();
        expect(sendEmail).not.toHaveBeenCalled();
        expect(sendCustomerEmail).not.toHaveBeenCalled();
        expect(recordNotificationAttempt).not.toHaveBeenCalled();
      },
    );
  });
});
