import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Express } from "express";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
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
    findCheckoutByIdempotencyKey: jest.fn(),
    createPendingOrder: jest.fn(),
    createMerchantTelegramNotification: jest.fn(),
    markInitializationFailed: jest.fn().mockResolvedValue(undefined),
    recordProviderPaymentId: jest.fn().mockResolvedValue(undefined),
    recordNotificationAttempt: jest.fn().mockResolvedValue(undefined),
    markNotificationSent: jest.fn().mockResolvedValue(undefined),
    markNotificationFailed: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
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
    persistence.findCheckoutByIdempotencyKey
      .mockReset()
      .mockResolvedValue(null);
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
              paymentAttempts: [],
              locale: input.locale,
              customerName: input.customerName,
              customerEmail: input.customerEmail,
              customerPhone: input.customerPhone,
              deliveryAddress: input.deliveryAddress,
              total: input.total,
              items: input.items,
              notifications: [
                {
                  id: "e2e-merchant-notification",
                  status: "PENDING",
                  recipientType: "MERCHANT",
                },
                {
                  id: "e2e-customer-notification",
                  status: "PENDING",
                  recipientType: "CUSTOMER",
                },
              ],
            },
          }),
      );
    global.fetch = fetchMock as typeof fetch;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(OrderPersistenceService)
      .useValue(persistence)
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

  it("rejects pay-on-delivery and method-less orders without saving or emailing", async () => {
    for (const [key, method] of [
      ["e2e-order-cash-0001", { paymentMethod: "CASH_ON_DELIVERY" }],
      ["e2e-order-nomethod-0001", {}],
    ] as const) {
      await request(app.getHttpServer())
        .post("/api/v1/public/orders")
        .set("Idempotency-Key", key)
        .send({
          locale: "hy",
          ...method,
          customer: {
            name: "Անի",
            email: "ani@example.com",
            phone: "+374 91 123456",
            address: "Երևան, Աբովյան 1",
          },
          items: [
            { productId: product.id, quantity: 2, expectedUnitPrice: "24000" },
          ],
        })
        .expect(400)
        .expect(({ body }) => {
          expect(JSON.stringify(body)).toContain(
            "Only online card payment is available",
          );
        });
    }

    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(persistence.createPendingOrder).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects missing customer details before trying to send email", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .set("Idempotency-Key", "e2e-missing-customer-123")
      .send({ locale: "hy", customer: {}, items: [] })
      .expect(400);

    expect(fetchMock).not.toHaveBeenCalled();
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

  it("requires the checkout key in the header and returns a non-cacheable missing status", async () => {
    const url = "/api/v1/public/orders/checkout-status";
    await request(app.getHttpServer()).get(url).expect(400);
    expect(persistence.findCheckoutByIdempotencyKey).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .get(url)
      .set("Idempotency-Key", "e2e-card-status-key")
      .expect("Cache-Control", "no-store")
      .expect(200, { paymentStatus: "NOT_FOUND" });
    expect(persistence.findCheckoutByIdempotencyKey).toHaveBeenCalledWith(
      "e2e-card-status-key",
    );
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

  it("rejects invalid products and does not contact the email provider", async () => {
    prisma.product.findMany.mockResolvedValueOnce([]);

    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .set("Idempotency-Key", "e2e-order-product-0005")
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
          },
        ],
      })
      .expect(400);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated order submissions", async () => {
    const express = app.getHttpAdapter().getInstance() as Express;
    expect(express.get("trust proxy")).toBe(1);
    const payload = {
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
        },
      ],
    };

    for (let index = 0; index < 5; index++) {
      await request(app.getHttpServer())
        .post("/api/v1/public/orders")
        .set("Idempotency-Key", `e2e-rate-${index}-12345678`)
        .set("x-forwarded-for", "198.51.100.10")
        .send(payload)
        .expect(400);
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
      .expect(400);
  });
});
