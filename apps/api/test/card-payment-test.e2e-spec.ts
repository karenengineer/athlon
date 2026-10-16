import { ConfigService } from "@nestjs/config";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import {
  AvailabilityStatus,
  Locale,
  Prisma,
} from "../src/generated/prisma/client";
import { AmeriaVposClient } from "../src/orders/ameria-vpos.client";
import { OrderEmailService } from "../src/orders/order-email.service";

const base = "/api/v1/public/card-payment-test";
const origin = "http://localhost:4200";
const productId = "00000000-0000-4000-8000-000000000001";
const sessionInput = {
  locale: "hy",
  items: [{ productId, quantity: 1, expectedUnitPrice: "12000" }],
};

describe("Guest card-payment MOCK flow", () => {
  let app: INestApplication;
  let config: ConfigService;
  const productFindMany = jest.fn();
  const orderCreate = jest.fn();

  beforeEach(async () => {
    productFindMany.mockReset().mockResolvedValue([
      {
        id: productId,
        sku: "TEST-WHEY",
        price: new Prisma.Decimal("12000"),
        currency: "AMD",
        availability: AvailabilityStatus.IN_STOCK,
        published: true,
        translations: [{ locale: Locale.HY, name: "Հայերեն" }],
      },
    ]);
    orderCreate.mockReset();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        product: { findMany: productFindMany },
        order: { create: orderCreate },
      })
      .compile();
    config = moduleRef.get(ConfigService);
    config.set("NODE_ENV", "production");
    config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", true);
    config.set("CORS_ORIGINS", origin);
    app = configureApplication(moduleRef.createNestApplication());
    await app.init();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });

  async function owner() {
    const response = await request(app.getHttpServer())
      .get(`${base}/config`)
      .expect(200);
    const cookies = response.headers["set-cookie"] as unknown as string[];
    return {
      cookie: cookies[0]!.split(";")[0]!,
      csrfToken: response.body.csrfToken as string,
      response,
    };
  }
  const mutate = (guest: { cookie: string; csrfToken: string }, path: string) =>
    request(app.getHttpServer())
      .post(`${base}/${path}`)
      .set("Cookie", guest.cookie)
      .set("Origin", origin)
      .set("x-card-payment-test-csrf", guest.csrfToken);

  it("reports disabled config without authentication or creating an owner cookie", async () => {
    config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", false);
    const response = await request(app.getHttpServer())
      .get(`${base}/config`)
      .expect(200);
    expect(response.body).toEqual({
      enabled: false,
      mode: "MOCK",
      csrfToken: null,
    });
    expect(response.headers["set-cookie"]).toBeUndefined();
    await request(app.getHttpServer())
      .post(`${base}/sessions`)
      .send(sessionInput)
      .expect(404);
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it("bootstraps and reuses a production guest owner without an account", async () => {
    const guest = await owner();
    expect(guest.response.body).toEqual({
      enabled: true,
      mode: "MOCK",
      csrfToken: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(guest.cookie).toMatch(
      /^athlon_card_payment_test_owner=[a-f0-9]{64}$/,
    );
    const cookie = (
      guest.response.headers["set-cookie"] as unknown as string[]
    )[0]!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain(`Path=${base}`);
    expect(cookie).not.toContain("Domain=");
    const reused = await request(app.getHttpServer())
      .get(`${base}/config`)
      .set("Cookie", guest.cookie)
      .expect(200);
    expect(reused.body.csrfToken).toBe(guest.csrfToken);
    const created = await mutate(guest, "sessions")
      .send(sessionInput)
      .expect(201);
    expect(created.body).toMatchObject({
      mode: "MOCK",
      status: "PENDING",
      total: "12000",
      locale: "HY",
      currency: "AMD",
      items: [{ name: "Հայերեն" }],
    });
    expect(created.body).not.toHaveProperty("ownerId");
    expect(created.body).not.toHaveProperty("customer");
    await request(app.getHttpServer())
      .get(`${base}/sessions/${created.body.reference}`)
      .set("Cookie", guest.cookie)
      .expect(200);
    await mutate(guest, `sessions/${created.body.reference}/outcome`)
      .send({ outcome: "SUCCESS" })
      .expect(201);
    await mutate(guest, `sessions/${created.body.reference}/outcome`)
      .send({ outcome: "SUCCESS" })
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe("SUCCEEDED"));
    await mutate(guest, `sessions/${created.body.reference}/outcome`)
      .send({ outcome: "DECLINED" })
      .expect(409);
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("isolates reads and outcomes to the creating browser", async () => {
    const first = await owner();
    const second = await owner();
    const created = await mutate(first, "sessions")
      .send(sessionInput)
      .expect(201);
    await request(app.getHttpServer())
      .get(`${base}/sessions/${created.body.reference}`)
      .set("Cookie", second.cookie)
      .expect(404);
    await mutate(second, `sessions/${created.body.reference}/outcome`)
      .send({ outcome: "SUCCESS" })
      .expect(404);
    await request(app.getHttpServer())
      .get(`${base}/sessions/${created.body.reference}`)
      .expect(403);
    await mutate(first, `sessions/${created.body.reference}/outcome`)
      .set("x-card-payment-test-csrf", second.csrfToken)
      .send({ outcome: "SUCCESS" })
      .expect(403);
  });

  it.each([undefined, "null", "https://attacker.example", `${origin}/`])(
    "rejects mutation Origin %s even with valid guest tokens",
    async (foreignOrigin) => {
      const guest = await owner();
      const attempt = request(app.getHttpServer())
        .post(`${base}/sessions`)
        .set("Cookie", guest.cookie)
        .set("x-card-payment-test-csrf", guest.csrfToken)
        .set("X-Forwarded-Host", "localhost:4200")
        .set("X-Forwarded-For", "127.0.0.1");
      if (foreignOrigin !== undefined) attempt.set("Origin", foreignOrigin);
      await attempt.send(sessionInput).expect(403);
      expect(productFindMany).not.toHaveBeenCalled();
    },
  );

  it("rejects missing or invalid owner and CSRF before catalog lookup", async () => {
    const guest = await owner();
    for (const token of [undefined, "invalid"]) {
      const attempt = request(app.getHttpServer())
        .post(`${base}/sessions`)
        .set("Cookie", guest.cookie)
        .set("Origin", origin);
      if (token) attempt.set("x-card-payment-test-csrf", token);
      await attempt.send(sessionInput).expect(403);
    }
    await request(app.getHttpServer())
      .post(`${base}/sessions`)
      .set("Origin", origin)
      .set("x-card-payment-test-csrf", guest.csrfToken)
      .send(sessionInput)
      .expect(403);
    await request(app.getHttpServer())
      .post(`${base}/sessions`)
      .set("Origin", origin)
      .set("Cookie", "athlon_card_payment_test_owner=unknown")
      .set("x-card-payment-test-csrf", guest.csrfToken)
      .send(sessionInput)
      .expect(403);
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it("rejects supplied foreign and null origins on config, including disabled config", async () => {
    for (const enabled of [true, false]) {
      config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", enabled);
      for (const foreignOrigin of ["null", "https://attacker.example"]) {
        await request(app.getHttpServer())
          .get(`${base}/config`)
          .set("Origin", foreignOrigin)
          .expect(403);
      }
    }
  });

  it("forbids card/customer payloads, missing prices, and invalid outcomes", async () => {
    const guest = await owner();
    for (const input of [
      { ...sessionInput, cardNumber: "mock-only" },
      { ...sessionInput, customer: {} },
      { locale: "hy", items: [{ productId, quantity: 1 }] },
    ]) {
      await mutate(guest, "sessions").send(input).expect(400);
    }
    const created = await mutate(guest, "sessions")
      .send(sessionInput)
      .expect(201);
    await mutate(guest, `sessions/${created.body.reference}/outcome`)
      .send({ outcome: "CHARGE_CARD" })
      .expect(400);
    await mutate(guest, `sessions/${created.body.reference}/outcome`)
      .send({ outcome: "SUCCESS", cardNumber: "mock-only" })
      .expect(400);
  });

  it("expires owner access at 15 minutes even for a session created later", async () => {
    const now = Date.now();
    const clock = jest.spyOn(Date, "now").mockReturnValue(now);
    const guest = await owner();
    clock.mockReturnValue(now + 14 * 60_000);
    const created = await mutate(guest, "sessions")
      .send(sessionInput)
      .expect(201);
    expect(created.body.expiresAt).toBe(
      new Date(now + 15 * 60_000).toISOString(),
    );
    clock.mockReturnValue(now + 15 * 60_000);
    await request(app.getHttpServer())
      .get(`${base}/sessions/${created.body.reference}`)
      .set("Cookie", guest.cookie)
      .expect(403);
    await mutate(guest, `sessions/${created.body.reference}/outcome`)
      .send({ outcome: "SUCCESS" })
      .expect(403);
    const renewed = await request(app.getHttpServer())
      .get(`${base}/config`)
      .set("Cookie", guest.cookie)
      .expect(200);
    expect(renewed.body.csrfToken).not.toBe(guest.csrfToken);
  });

  it("removes the former admin API and never calls real payment or email providers", async () => {
    const payment = jest.spyOn(app.get(AmeriaVposClient), "initializePayment");
    const email = jest.spyOn(app.get(OrderEmailService), "send");
    const customerEmail = jest.spyOn(
      app.get(OrderEmailService),
      "sendCustomer",
    );
    await request(app.getHttpServer())
      .get("/api/v1/admin/card-payment-test/config")
      .expect(404);
    const guest = await owner();
    const created = await mutate(guest, "sessions")
      .send(sessionInput)
      .expect(201);
    await mutate(guest, `sessions/${created.body.reference}/outcome`)
      .send({ outcome: "SUCCESS" })
      .expect(201);
    expect(payment).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
    expect(customerEmail).not.toHaveBeenCalled();
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("rate limits config, create, read, and outcome routes", async () => {
    const guest = await owner();
    let reference = "";
    for (let count = 0; count < 5; count++) {
      const created = await mutate(guest, "sessions")
        .send(sessionInput)
        .expect(201);
      reference = created.body.reference;
    }
    await mutate(guest, "sessions").send(sessionInput).expect(429);
    for (let count = 0; count < 10; count++)
      await mutate(guest, `sessions/${reference}/outcome`)
        .send({ outcome: "SUCCESS" })
        .expect(201);
    await mutate(guest, `sessions/${reference}/outcome`)
      .send({ outcome: "SUCCESS" })
      .expect(429);
    for (let count = 0; count < 30; count++)
      await request(app.getHttpServer())
        .get(`${base}/sessions/${reference}`)
        .set("Cookie", guest.cookie)
        .expect(200);
    await request(app.getHttpServer())
      .get(`${base}/sessions/${reference}`)
      .set("Cookie", guest.cookie)
      .expect(429);
    for (let count = 1; count < 30; count++)
      await request(app.getHttpServer())
        .get(`${base}/config`)
        .set("Cookie", guest.cookie)
        .expect(200);
    await request(app.getHttpServer())
      .get(`${base}/config`)
      .set("Cookie", guest.cookie)
      .expect(429);
  });
});
