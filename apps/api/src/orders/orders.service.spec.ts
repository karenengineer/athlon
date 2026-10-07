import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { OrderEmailService } from "./order-email.service";
import { OrderPersistenceService } from "./order-persistence.service";
import { OrdersService } from "./orders.service";

const productId = "4ebeb944-3503-47a2-9843-d37f1eb34768";
const orderInput = {
  locale: "hy" as const,
  paymentMethod: "CASH_ON_DELIVERY" as const,
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
    { id: "merchant-notification", status: "PENDING", recipientType: "MERCHANT" },
    { id: "customer-notification", status: "PENDING", recipientType: "CUSTOMER" },
  ],
};

describe("OrdersService", () => {
  const findProducts = jest.fn();
  const findOrderByIdempotencyKey = jest.fn();
  const sendEmail = jest.fn().mockResolvedValue(undefined);
  const sendCustomerEmail = jest.fn().mockResolvedValue(undefined);
  const createPendingOrder = jest.fn();
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
    findByIdempotencyKey: findOrderByIdempotencyKey,
    markInitializationFailed,
    recordProviderPaymentId,
    recordNotificationAttempt,
    markNotificationSent,
    markNotificationFailed,
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
  });

  it("prices COD from published DB products, persists snapshots, and emails ATHLON", async () => {
    const result = await service.submit(orderInput, "web-req-1234567890");

    expect(result).toEqual({
      kind: "COD_ACCEPTED",
      accepted: true,
      orderReference: expect.stringMatching(/^ATH-[A-F0-9]{32}$/),
    });
    expect(findProducts).toHaveBeenCalledWith({
      where: { id: { in: [productId] }, published: true },
      include: { translations: true },
    });
    expect(createPendingOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "web-req-1234567890",
        customerEmail: "ani@example.com",
        paymentMethod: "CASH_ON_DELIVERY",
        currency: "AMD",
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
        total: "48000",
      }),
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ orderReference: persistedOrder.reference }),
      "merchant-notification",
    );
    expect(sendCustomerEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: expect.objectContaining({ email: "ani@example.com" }),
      }),
      "customer-notification",
    );
    expect(markNotificationSent).toHaveBeenCalledTimes(2);
  });

  it("returns a prior COD acceptance for duplicate idempotency keys without duplicate emails", async () => {
    createPendingOrder.mockResolvedValueOnce({
      order: {
        ...persistedOrder,
        notifications: persistedOrder.notifications.map((notification) => ({
          ...notification,
          status: "SENT",
        })),
      },
      created: false,
    });

    await expect(
      service.submit(orderInput, "web-req-duplicate-1234"),
    ).resolves.toEqual({
      kind: "COD_ACCEPTED",
      accepted: true,
      orderReference: persistedOrder.reference,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendCustomerEmail).not.toHaveBeenCalled();
  });

  it("replays the exact stored COD order and notification state on a matching idempotency retry", async () => {
    const first = await service.submit(orderInput, "web-req-retry-1234");
    const fingerprint = createPendingOrder.mock.calls[0]![0].requestFingerprint;
    expect(first.kind).toBe("COD_ACCEPTED");
    sendEmail.mockClear();
    sendCustomerEmail.mockClear();
    findProducts.mockClear();
    findOrderByIdempotencyKey.mockResolvedValueOnce({
      ...persistedOrder,
      paymentMethod: "CASH_ON_DELIVERY",
      requestFingerprint: fingerprint,
      notifications: persistedOrder.notifications.map((notification) => ({
        ...notification,
        status: "SENT",
      })),
    });

    await expect(
      service.submit(orderInput, "web-req-retry-1234"),
    ).resolves.toEqual(first);
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
        { ...orderInput, customer: { ...orderInput.customer, address: "Other" } },
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
      .mockImplementationOnce(() => Promise.resolve({
        ...fingerprintOrder,
        requestFingerprint,
      }));
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
    createPendingOrder.mockResolvedValueOnce({
      order: {
        ...persistedOrder,
        notifications: [
          { ...persistedOrder.notifications[0]!, status: "SENT" },
          { ...persistedOrder.notifications[1]!, status: "FAILED" },
        ],
      },
      created: false,
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

  it("records a failed notification for retry without losing the accepted order", async () => {
    sendEmail.mockRejectedValueOnce(new Error("provider details must not escape"));

    await expect(
      service.submit(orderInput, "web-req-notification-fail"),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(markNotificationFailed).toHaveBeenCalledWith("merchant-notification");
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
    expect(
      createPendingOrder.mock.calls[0]![0].requestFingerprint,
    ).toMatch(/^[a-f0-9]{64}$/);
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

  it("rejects out-of-stock products", async () => {
    findProducts.mockResolvedValueOnce([
      { ...publishedProduct, availability: "OUT_OF_STOCK" },
    ]);

    await expect(
      service.submit(orderInput, "web-req-stock-123456"),
    ).rejects.toThrow(ConflictException);
    expect(createPendingOrder).not.toHaveBeenCalled();
  });
});
