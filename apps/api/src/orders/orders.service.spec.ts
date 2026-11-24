import {
  BadRequestException,
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { OrderEmailService } from "./order-email.service";
import { OrderPersistenceService } from "./order-persistence.service";
import { OrderTelegramService } from "./order-telegram.service";
import { OrdersService } from "./orders.service";

const productId = "4ebeb944-3503-47a2-9843-d37f1eb34768";
const orderInput = {
  locale: "hy" as const,
  customer: {
    name: "Անի",
    email: "ani@example.com",
    phone: "091123456",
    address: "Երևան",
  },
  items: [{ productId, quantity: 2, expectedUnitPrice: "24000" }],
};
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
const legacyOrder = {
  ...persistedOrder,
  paymentMethod: "CASH_ON_DELIVERY",
  // Fingerprint stored by the original checkout for orderInput.
  requestFingerprint:
    "231fe1f8a12acf2be8cce7b99143b6ce23a9be5a63e9836ad3fa7f7926117a16",
};
const telegramNotification = {
  id: "telegram-notification",
  status: "PENDING",
  recipientType: "MERCHANT_TELEGRAM",
};

describe("OrdersService", () => {
  const findProducts = jest.fn();
  const findOrderByIdempotencyKey = jest.fn();
  const findOrderWithNotifications = jest.fn();
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
    findOrderWithNotifications,
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

  function mockPaidOrder() {
    paymentInitializer.verifyAndApplyStatus.mockResolvedValueOnce({
      orderReference: persistedOrder.reference,
      paymentStatus: "PAID",
      locale: "hy",
      newlyPaidOrderId: persistedOrder.id,
    });
    findOrderWithNotifications.mockResolvedValueOnce({
      ...persistedOrder,
      notifications: persistedOrder.notifications.map((notification) => ({
        ...notification,
        eventType: "PAYMENT_CONFIRMED",
      })),
    });
  }

  beforeEach(() => {
    paymentInitializer.verifyAndApplyStatus.mockReset();
    findOrderWithNotifications.mockReset();
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

  it.each(["CASH_ON_DELIVERY", undefined] as const)(
    "rejects new %s orders before looking up products or creating an order",
    async (paymentMethod) => {
      await expect(
        service.submit(
          paymentMethod ? { ...orderInput, paymentMethod } : orderInput,
          "web-order-cod-rejected",
        ),
      ).rejects.toThrow("Pay on delivery is unavailable");
      expect(findProducts).not.toHaveBeenCalled();
      expect(createPendingOrder).not.toHaveBeenCalled();
      expect(initializePayment).not.toHaveBeenCalled();
    },
  );

  it("excludes the resistance bands category from checkout", async () => {
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
      service.submit(
        { ...orderInput, paymentMethod: "CARD" },
        "web-order-band-rejected",
      ),
    ).rejects.toThrow("One or more products cannot be ordered");
    expect(createPendingOrder).not.toHaveBeenCalled();
    expect(initializePayment).not.toHaveBeenCalled();
  });

  it("returns the original COD acceptance without sending duplicate notifications", async () => {
    findOrderByIdempotencyKey.mockResolvedValueOnce({
      ...legacyOrder,
      notifications: legacyOrder.notifications.map((notification) => ({
        ...notification,
        status: "SENT",
      })),
    });

    await expect(
      service.submit(orderInput, "web-req-retry-1234"),
    ).resolves.toEqual({
      kind: "COD_ACCEPTED",
      accepted: true,
      orderReference: legacyOrder.reference,
    });
    expect(createPendingOrder).not.toHaveBeenCalled();
    expect(findProducts).not.toHaveBeenCalled();
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

  it("retries only failed durable notifications with the same persisted idempotency key", async () => {
    findOrderByIdempotencyKey.mockResolvedValueOnce({
      ...legacyOrder,
      notifications: [
        { ...legacyOrder.notifications[0]!, status: "SENT" },
        { ...legacyOrder.notifications[1]!, status: "FAILED" },
      ],
    });

    await service.submit(orderInput, "web-req-duplicate-1234");

    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendCustomerEmail).toHaveBeenCalledTimes(1);
    expect(sendCustomerEmail).toHaveBeenCalledWith(
      expect.objectContaining({ orderReference: persistedOrder.reference }),
      "customer-notification",
    );
    expect(markNotificationSent).toHaveBeenCalledTimes(1);
  });

  it("records a failed notification on COD replay without losing the accepted order", async () => {
    findOrderByIdempotencyKey.mockResolvedValueOnce(legacyOrder);
    sendEmail.mockRejectedValueOnce(
      new Error("provider details must not escape"),
    );

    await expect(
      service.submit(orderInput, "web-req-notification-fail"),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(markNotificationFailed).toHaveBeenCalledWith(
      "merchant-notification",
    );
    expect(sendCustomerEmail).not.toHaveBeenCalled();
  });

  it("persists and sends Telegram independently once the card payment is confirmed", async () => {
    mockPaidOrder();

    await expect(
      telegramOrders.paymentStatus(persistedOrder.reference),
    ).resolves.toMatchObject({
      paymentStatus: "PAID",
    });

    expect(createMerchantTelegramNotification).toHaveBeenCalledWith(
      persistedOrder.id,
      "PAYMENT_CONFIRMED",
    );
    expect(sendTelegram).toHaveBeenCalledWith(
      expect.objectContaining({
        orderReference: persistedOrder.reference,
        locale: "hy",
        total: "48000",
        paidByCard: true,
      }),
    );
    expect(markNotificationSent).toHaveBeenCalledWith(telegramNotification.id);
    expect(markNotificationSent).toHaveBeenCalledWith("merchant-notification");
    expect(markNotificationSent).toHaveBeenCalledWith("customer-notification");
  });

  it("never adds a Telegram intent when replaying a historical COD order", async () => {
    findOrderByIdempotencyKey.mockResolvedValueOnce(legacyOrder);

    await expect(
      telegramOrders.submit(orderInput, "web-telegram-historical"),
    ).resolves.toMatchObject({
      kind: "COD_ACCEPTED",
    });
    expect(createPendingOrder).not.toHaveBeenCalled();
    expect(createMerchantTelegramNotification).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("does not create a Telegram intent when Telegram is disabled", async () => {
    telegram.isEnabled = false;
    mockPaidOrder();
    await telegramOrders.paymentStatus(persistedOrder.reference);

    expect(createMerchantTelegramNotification).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
    expect(markNotificationSent).toHaveBeenCalledTimes(2);
  });

  it("does not create a Telegram intent for a card checkout", async () => {
    await telegramOrders.submit(
      { ...orderInput, paymentMethod: "CARD" },
      "web-telegram-card",
    );

    expect(createMerchantTelegramNotification).not.toHaveBeenCalled();
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("retries a failed Telegram intent and skips it once confirmed sent", async () => {
    const key = "web-telegram-retry";
    const sentEmails = legacyOrder.notifications.map((notification) => ({
      ...notification,
      status: "SENT",
    }));
    findOrderByIdempotencyKey
      .mockResolvedValueOnce({
        ...legacyOrder,
        notifications: [
          ...sentEmails,
          { ...telegramNotification, status: "FAILED" },
        ],
      })
      .mockResolvedValueOnce({
        ...legacyOrder,
        notifications: [
          ...sentEmails,
          { ...telegramNotification, status: "SENT" },
        ],
      });

    await expect(telegramOrders.submit(orderInput, key)).resolves.toMatchObject(
      {
        kind: "COD_ACCEPTED",
      },
    );
    expect(markNotificationSent).toHaveBeenCalledWith(telegramNotification.id);
    await expect(telegramOrders.submit(orderInput, key)).resolves.toMatchObject(
      {
        kind: "COD_ACCEPTED",
      },
    );
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    expect(createMerchantTelegramNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendCustomerEmail).not.toHaveBeenCalled();
  });

  it.each(["creation", "attempt", "mark sent", "mark failed"] as const)(
    "keeps the payment confirmed and sends both emails when Telegram tracking fails during %s",
    async (stage) => {
      const trackingError = new Error("provider or database details");
      const warning = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => {});
      switch (stage) {
        case "creation":
          createMerchantTelegramNotification.mockRejectedValueOnce(
            trackingError,
          );
          break;
        case "attempt":
          recordNotificationAttempt.mockImplementation((id: string) =>
            id === telegramNotification.id
              ? Promise.reject(trackingError)
              : Promise.resolve(),
          );
          break;
        case "mark sent":
          markNotificationSent.mockImplementation((id: string) =>
            id === telegramNotification.id
              ? Promise.reject(trackingError)
              : Promise.resolve(),
          );
          break;
        case "mark failed":
          sendTelegram.mockRejectedValueOnce(trackingError);
          markNotificationFailed.mockRejectedValueOnce(trackingError);
          break;
      }

      try {
        mockPaidOrder();
        await expect(
          telegramOrders.paymentStatus(persistedOrder.reference),
        ).resolves.toMatchObject({ paymentStatus: "PAID" });
        expect(markNotificationSent).toHaveBeenCalledWith(
          "merchant-notification",
        );
        expect(markNotificationSent).toHaveBeenCalledWith(
          "customer-notification",
        );
        expect(sendTelegram).toHaveBeenCalledTimes(
          stage === "creation" || stage === "attempt" ? 0 : 1,
        );
        expect(warning).toHaveBeenCalledWith(
          "Could not track order Telegram notification",
        );
      } finally {
        warning.mockRestore();
      }
    },
  );

  it("keeps the email error response while still delivering Telegram", async () => {
    findOrderByIdempotencyKey.mockResolvedValueOnce({
      ...legacyOrder,
      notifications: [...legacyOrder.notifications, telegramNotification],
    });
    sendEmail.mockRejectedValueOnce(new Error("email provider error"));

    await expect(
      telegramOrders.submit(orderInput, "web-telegram-email-failure"),
    ).rejects.toThrow("Order notification delivery is unavailable");
    expect(markNotificationFailed).toHaveBeenCalledWith(
      "merchant-notification",
    );
    expect(sendCustomerEmail).not.toHaveBeenCalled();
    expect(markNotificationSent).toHaveBeenCalledWith(telegramNotification.id);
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
        currency: "AMD",
        total: "48000",
        items: [
          {
            productId,
            sku: "SKU-ONE",
            name: "Պրոտեին",
            quantity: 2,
            unitPrice: "24000",
            lineTotal: "48000",
          },
        ],
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
      service.submit(
        { ...orderInput, paymentMethod: "CARD" },
        "web-req-usd-123456",
      ),
    ).rejects.toThrow(ConflictException);
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  it("rejects a stale basket price before persisting or emailing", async () => {
    await expect(
      service.submit(
        {
          ...orderInput,
          paymentMethod: "CARD",
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
      service.submit(
        { ...orderInput, paymentMethod: "CARD" },
        "web-req-unknown-123456",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(createPendingOrder).not.toHaveBeenCalled();
  });

  describe("card checkout availability", () => {
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
            { ...orderInput, paymentMethod: "CARD" },
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
