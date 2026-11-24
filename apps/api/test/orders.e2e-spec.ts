import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Express } from "express";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { CARD_PAYMENT_INITIALIZER } from "../src/orders/orders.service";
import { OrderPersistenceService } from "../src/orders/order-persistence.service";

describe("Public orders", () => {
  let app: INestApplication;
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  const product = {
    id: "4ebeb944-3503-47a2-9843-d37f1eb34768",
    sku: "SKU-ONE",
    published: true,
    availability: "IN_STOCK",
    price: "24000",
    currency: "AMD",
    translations: [{ locale: "HY", name: "Պրոտեին" }],
  };
  const checkoutUrl = "https://payments.example.test/checkout/1";
  const orderReference = "ATH-1234ABCD1234ABCD1234ABCD1234ABCD";
  const paidOrder = {
    id: "order-test-id",
    reference: orderReference,
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
    notifications: [
      {
        id: "e2e-merchant-notification",
        status: "PENDING",
        recipientType: "MERCHANT",
        eventType: "PAYMENT_CONFIRMED",
      },
      {
        id: "e2e-customer-notification",
        status: "PENDING",
        recipientType: "CUSTOMER",
        eventType: "PAYMENT_CONFIRMED",
      },
    ],
  };
  const payment = {
    isEnabled: false,
    isTrustedCheckoutUrl: (url: string) => url === checkoutUrl,
    initialize: jest.fn(),
    verifyAndApplyStatus: jest.fn(),
  };
  const prisma = {
    product: {
      findMany: jest.fn(),
    },
    siteSetting: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const persistence = {
    findByIdempotencyKey: jest.fn().mockResolvedValue(null),
    createPendingOrder: jest.fn(),
    nextAmeriaOrderId: jest.fn().mockResolvedValue("1760000000001"),
    findOrderWithNotifications: jest.fn().mockResolvedValue(paidOrder),
    createMerchantTelegramNotification: jest.fn(),
    markInitializationFailed: jest.fn().mockResolvedValue(undefined),
    recordProviderPaymentId: jest.fn().mockResolvedValue(undefined),
    recordNotificationAttempt: jest.fn().mockResolvedValue(undefined),
    markNotificationSent: jest.fn().mockResolvedValue(undefined),
    markNotificationFailed: jest.fn().mockResolvedValue(undefined),
  };

  function mockConfirmedPayment() {
    payment.isEnabled = true;
    payment.verifyAndApplyStatus.mockResolvedValueOnce({
      orderReference,
      paymentStatus: "PAID",
      locale: "HY",
      newlyPaidOrderId: paidOrder.id,
    });
  }

  beforeEach(async () => {
    payment.isEnabled = false;
    payment.initialize.mockReset().mockResolvedValue({
      providerPaymentId: "fixture-payment",
      checkoutUrl,
    });
    payment.verifyAndApplyStatus.mockReset();
    process.env.RESEND_API_KEY = "test-only-key";
    process.env.ORDER_FROM_EMAIL = "orders@example.test";
    process.env.ORDER_TELEGRAM_BOT_TOKEN = "";
    process.env.ORDER_TELEGRAM_CHAT_ID = "";
    fetchMock
      .mockReset()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "email_test_1" }), { status: 200 }),
      );
    prisma.product.findMany.mockReset().mockResolvedValue([product]);
    persistence.createMerchantTelegramNotification
      .mockReset()
      .mockResolvedValue({ id: "e2e-telegram-notification" });
    persistence.createPendingOrder
      .mockReset()
      .mockImplementation(
        (input: Parameters<OrderPersistenceService["createPendingOrder"]>[0]) =>
          Promise.resolve({
            created: true,
            order: {
              id: "order-test-id",
              reference: input.reference,
              paymentAttempts: [
                { id: "payment-attempt", ameriaOrderId: "1760000000001" },
              ],
              locale: input.locale,
              customerName: input.customerName,
              customerEmail: input.customerEmail,
              customerPhone: input.customerPhone,
              deliveryAddress: input.deliveryAddress,
              total: input.total,
              items: input.items,
            },
          }),
      );
    global.fetch = fetchMock as typeof fetch;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(OrderPersistenceService)
      .useValue(persistence)
      .overrideProvider(CARD_PAYMENT_INITIALIZER)
      .useValue(payment)
      .compile();
    app = configureApplication(moduleRef.createNestApplication());
    await app.init();
    await app.listen(0, "127.0.0.1");
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.ORDER_FROM_EMAIL;
    delete process.env.ORDER_TELEGRAM_BOT_TOKEN;
    delete process.env.ORDER_TELEGRAM_CHAT_ID;
    global.fetch = originalFetch;
  });

  it("accepts a priced card basket and returns the hosted checkout", async () => {
    payment.isEnabled = true;
    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .set("Idempotency-Key", "e2e-order-0001")
      .send({
        locale: "hy",
        paymentMethod: "CARD",
        customer: {
          name: "Անի",
          email: "ani@example.com",
          phone: "+374 91 123456",
          address: "Երևան, Աբովյան 1",
        },
        items: [
          {
            productId: product.id,
            quantity: 2,
            expectedUnitPrice: "24000",
          },
        ],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          kind: "CARD_PAYMENT_PENDING",
          accepted: true,
          orderReference: expect.any(String),
          paymentStatus: "PENDING",
          checkoutUrl,
        });
      });

    expect(payment.initialize).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends both emails after the bank confirms the card payment", async () => {
    mockConfirmedPayment();
    await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${orderReference}/payment-status`)
      .expect(200)
      .expect({ orderReference, paymentStatus: "PAID", locale: "HY" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "e2e-merchant-notification",
    );
    const email = JSON.parse(init.body as string);
    expect(email).toEqual(
      expect.objectContaining({
        to: ["athlonsportgoods@gmail.com"],
        from: "orders@athlonsport.am",
      }),
    );
    expect(email.text).toContain("Պրոտեին");
    expect(email.text).toContain("48,000");
    const [, customerInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(
      (customerInit.headers as Record<string, string>)["Idempotency-Key"],
    ).toBe("e2e-customer-notification");
    expect(JSON.parse(customerInit.body as string).to).toEqual([
      "ani@example.com",
    ]);
  });

  it("rejects missing customer details before trying to send email", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .set("Idempotency-Key", "e2e-missing-customer-123")
      .send({ locale: "hy", customer: {}, items: [] })
      .expect(400);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends configured Telegram alongside both emails for a confirmed payment", async () => {
    mockConfirmedPayment();
    const token = "123456:e2e-order-test";
    const chatId = "-1001234567890";
    const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    process.env.ORDER_TELEGRAM_BOT_TOKEN = token;
    process.env.ORDER_TELEGRAM_CHAT_ID = chatId;
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url === telegramUrl ? { ok: true } : { id: "email_test_1" },
        ),
      ),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${orderReference}/payment-status`)
      .expect(200);

    expect(persistence.createMerchantTelegramNotification).toHaveBeenCalledWith(
      "order-test-id",
      "PAYMENT_CONFIRMED",
    );
    expect(persistence.markNotificationSent).toHaveBeenCalledWith(
      "e2e-telegram-notification",
    );
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(
      calls.filter(([url]) => url === "https://api.resend.com/emails"),
    ).toHaveLength(2);
    const telegramRequest = calls.find(([url]) => url === telegramUrl)?.[1];
    expect(JSON.parse(telegramRequest!.body as string)).toEqual(
      expect.objectContaining({
        chat_id: chatId,
        text: expect.stringContaining("Ընդամենը: 48000 AMD"),
      }),
    );
  });

  it("requires a valid idempotency key and customer email", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .send({
        locale: "hy",
        customer: {
          name: "Անի",
          phone: "091123456",
          address: "Երևան",
        },
        items: [
          { productId: product.id, quantity: 1, expectedUnitPrice: "24000" },
        ],
      })
      .expect(400);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["CASH_ON_DELIVERY", undefined] as const)(
    "rejects new %s orders at the public endpoint",
    async (paymentMethod) => {
      payment.isEnabled = true;
      await request(app.getHttpServer())
        .post("/api/v1/public/orders")
        .set("Idempotency-Key", "e2e-cod-disabled")
        .send({
          locale: "hy",
          paymentMethod,
          customer: {
            name: "Անի",
            email: "ani@example.com",
            phone: "091123456",
            address: "Երևան",
          },
          items: [
            { productId: product.id, quantity: 1, expectedUnitPrice: "24000" },
          ],
        })
        .expect(400);
      expect(persistence.createPendingOrder).not.toHaveBeenCalled();
      expect(payment.initialize).not.toHaveBeenCalled();
    },
  );

  it("rejects card payment while Ameria merchant setup is not verified", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .set("Idempotency-Key", "e2e-card-disabled-1234")
      .send({
        locale: "hy",
        paymentMethod: "CARD",
        customer: {
          name: "Անի",
          email: "ani@example.com",
          phone: "091123456",
          address: "Երևան",
        },
        items: [
          { productId: product.id, quantity: 1, expectedUnitPrice: "24000" },
        ],
      })
      .expect(503);

    expect(persistence.createPendingOrder).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exposes a false public card-payment flag without exposing Ameria credentials", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/public/settings")
      .expect(200)
      .expect(({ body }) => {
        expect(body.cardPaymentsEnabled).toBe(false);
        expect(JSON.stringify(body)).not.toMatch(/AMERIA|password|merchant/i);
      });
  });

  it("never accepts browser-supplied payment IDs or paid flags as proof", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/public/orders/ATH-1234ABCD/payment-status")
      .expect(400);

    await request(app.getHttpServer())
      .get(
        "/api/v1/public/orders/ATH-1234ABCD1234ABCD1234ABCD1234ABCD/payment-status?paymentId=forged&status=PAID",
      )
      .expect(503)
      .expect(({ body }) => {
        expect(body).not.toHaveProperty("paymentStatus");
        expect(body).not.toHaveProperty("orderReference");
      });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a stale basket price without sending an email", async () => {
    payment.isEnabled = true;
    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .set("Idempotency-Key", "e2e-order-stale-0002")
      .send({
        locale: "hy",
        paymentMethod: "CARD",
        customer: {
          name: "Անի",
          email: "ani@example.com",
          phone: "091123456",
          address: "Երևան",
        },
        items: [
          { productId: product.id, quantity: 1, expectedUnitPrice: "100" },
        ],
      })
      .expect(409);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not trust a browser-supplied product name or total", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .set("Idempotency-Key", "e2e-order-inject-0003")
      .send({
        locale: "hy",
        customer: {
          name: "Անի",
          email: "ani@example.com",
          phone: "091123456",
          address: "Երևան",
        },
        items: [
          {
            productId: product.id,
            quantity: 1,
            expectedUnitPrice: "24000",
            name: "Injected item",
            lineTotal: "1",
          },
        ],
        total: "1",
      })
      .expect(400);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps a card payment confirmed when its notification fails", async () => {
    mockConfirmedPayment();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "secret provider details" }), {
        status: 500,
      }),
    );

    await request(app.getHttpServer())
      .get(`/api/v1/public/orders/${orderReference}/payment-status`)
      .expect(200)
      .expect({ orderReference, paymentStatus: "PAID", locale: "HY" });

    expect(persistence.markNotificationFailed).toHaveBeenCalledWith(
      "e2e-merchant-notification",
    );
  });

  it("rejects invalid products and does not contact the email provider", async () => {
    payment.isEnabled = true;
    prisma.product.findMany.mockResolvedValueOnce([]);

    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .set("Idempotency-Key", "e2e-order-product-0005")
      .send({
        locale: "hy",
        paymentMethod: "CARD",
        customer: {
          name: "Անի",
          email: "ani@example.com",
          phone: "091123456",
          address: "Երևան",
        },
        items: [
          {
            productId: product.id,
            quantity: 1,
            expectedUnitPrice: "24000",
          },
        ],
      })
      .expect(400);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated order submissions", async () => {
    payment.isEnabled = true;
    const express = app.getHttpAdapter().getInstance() as Express;
    expect(express.get("trust proxy")).toBe(1);
    const payload = {
      locale: "hy",
      paymentMethod: "CARD",
      customer: {
        name: "Անի",
        email: "ani@example.com",
        phone: "091123456",
        address: "Երևան",
      },
      items: [
        {
          productId: product.id,
          quantity: 1,
          expectedUnitPrice: "24000",
        },
      ],
    };

    for (let index = 0; index < 5; index++) {
      await request(app.getHttpServer())
        .post("/api/v1/public/orders")
        .set("Idempotency-Key", `e2e-rate-${index}-12345678`)
        .set("x-forwarded-for", "198.51.100.10")
        .send(payload)
        .expect(201);
    }

    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .set("Idempotency-Key", "e2e-rate-limit-12345678")
      .set("x-forwarded-for", "198.51.100.10")
      .send(payload)
      .expect(429);

    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .set("Idempotency-Key", "e2e-rate-other-12345678")
      .set("x-forwarded-for", "198.51.100.11")
      .send(payload)
      .expect(201);
  });
});
