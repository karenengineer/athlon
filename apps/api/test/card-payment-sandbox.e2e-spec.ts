import { ConfigService } from "@nestjs/config";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import {
  AvailabilityStatus,
  Locale,
  Prisma,
} from "../src/generated/prisma/client";
import { AmeriaSandboxClient } from "../src/orders/ameria-sandbox.client";
import { AMERIA_PAYMENT_FLOW_READY } from "../src/orders/ameria-vpos.client";

const base = "/api/v1/public/card-payment-test";
const origin = "https://athlon.am";
const productId = "00000000-0000-4000-8000-000000000001";
const accessToken = "isolated-fixture-access-token-at-least-32-chars";
const input = () => ({
  locale: "hy",
  items: [{ productId, quantity: 1, expectedUnitPrice: "12000" }],
  idempotencyKey: randomUUID(),
});

describe("Guest Ameria sandbox HTTP flow (bank mocked)", () => {
  let app: INestApplication;
  let config: ConfigService;
  const rows = new Map<string, any>();
  const bank = { initialize: jest.fn(), details: jest.fn() };
  const productFindMany = jest.fn();
  const orderCreate = jest.fn();
  const model = {
    findUnique: jest.fn(({ where }: any) =>
      Promise.resolve(
        where.reference
          ? (rows.get(where.reference) ?? null)
          : ([...rows.values()].find(
              (row) =>
                row.ownerHash === where.ownerHash_idempotencyKey.ownerHash &&
                row.idempotencyKey ===
                  where.ownerHash_idempotencyKey.idempotencyKey,
            ) ?? null),
      ),
    ),
    create: jest.fn(({ data }: any) => {
      const row = {
        status: "PENDING",
        initialization: "INITIALIZING",
        ameriaOrderId: 30543001 + rows.size,
        nextCheckAt: new Date(0),
        ...data,
      };
      rows.set(row.reference, row);
      return Promise.resolve({ ...row });
    }),
    update: jest.fn(({ where, data }: any) => {
      Object.assign(rows.get(where.reference), data);
      return Promise.resolve({ ...rows.get(where.reference) });
    }),
    updateMany: jest.fn(({ where, data }: any) => {
      const row = rows.get(where.reference);
      if (
        !row ||
        (where.status && where.status !== row.status) ||
        (where.nextCheckAt instanceof Date &&
          (row.nextCheckAt as Date).getTime() !==
            (where.nextCheckAt as Date).getTime()) ||
        (where.nextCheckAt?.lte && row.nextCheckAt > where.nextCheckAt.lte)
      )
        return Promise.resolve({ count: 0 });
      Object.assign(row, data);
      return Promise.resolve({ count: 1 });
    }),
  };
  beforeEach(async () => {
    rows.clear();
    jest.clearAllMocks();
    bank.initialize.mockResolvedValue({
      paymentId: "fixture-bank-payment",
      checkoutUrl: "fixture",
    });
    productFindMany.mockResolvedValue([
      {
        id: productId,
        sku: "FIXTURE",
        price: new Prisma.Decimal("12000"),
        currency: "AMD",
        availability: AvailabilityStatus.IN_STOCK,
        published: true,
        translations: [{ locale: Locale.HY, name: "Թեստ" }],
      },
    ]);
    const tx = {
      cardPaymentSandboxSession: model,
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        ...tx,
        product: { findMany: productFindMany },
        order: {
          create: orderCreate,
          findUnique: jest.fn().mockResolvedValue(null),
        },
        $transaction: (fn: (value: typeof tx) => Promise<unknown>) => fn(tx),
      })
      .overrideProvider(AmeriaSandboxClient)
      .useValue(bank)
      .compile();
    config = module.get(ConfigService);
    config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", true);
    config.set("CARD_PAYMENT_TEST_MODE", "AMERIA_SANDBOX");
    config.set("CARD_PAYMENT_TEST_ACCESS_TOKEN", accessToken);
    config.set("CORS_ORIGINS", origin);
    app = configureApplication(module.createNestApplication());
    await app.init();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });
  async function browser() {
    const response = await request(app.getHttpServer())
      .get(`${base}/config`)
      .expect(200);
    return {
      cookie: (response.headers["set-cookie"] as unknown as string[])[0]!.split(
        ";",
      )[0]!,
      csrf: response.body.csrfToken as string,
      response,
    };
  }
  const post = (guest: { cookie: string; csrf: string }, path: string) =>
    request(app.getHttpServer())
      .post(`${base}/${path}`)
      .set("Cookie", guest.cookie)
      .set("Origin", origin)
      .set("x-card-payment-test-csrf", guest.csrf);
  const get = (guest: { cookie: string }, path: string) =>
    request(app.getHttpServer())
      .get(`${base}/${path}`)
      .set("Cookie", guest.cookie);
  async function unlocked() {
    const guest = await browser();
    await post(guest, "access").send({ accessToken }).expect(201);
    return guest;
  }

  it("requires explicit token unlock with owner CSRF, then config reflects only that browser's grant", async () => {
    const guest = await browser();
    expect(guest.response.body).toMatchObject({
      mode: "AMERIA_SANDBOX",
      enabled: true,
      accessRequired: true,
    });
    await post(guest, "sessions").send(input()).expect(403);
    await post(guest, "access")
      .send({ accessToken: "wrong-token-fixture-32-characters-long" })
      .expect(403);
    await request(app.getHttpServer())
      .post(`${base}/access`)
      .set("Cookie", guest.cookie)
      .set("Origin", origin)
      .send({ accessToken })
      .expect(403);
    expect(bank.initialize).not.toHaveBeenCalled();
    const unlocked = await post(guest, "access")
      .send({ accessToken })
      .expect(201);
    expect(unlocked.body).toEqual({ unlocked: true });
    expect((await get(guest, "config").expect(200)).body.accessRequired).toBe(
      false,
    );
    expect((await browser()).response.body.accessRequired).toBe(true);
  });
  it("charges AMD10 independently of basket, uses bank verification only and isolates browser ownership", async () => {
    const guest = await unlocked();
    const other = await browser();
    const created = await post(guest, "sessions").send(input()).expect(201);
    expect(created.body).toMatchObject({
      mode: "AMERIA_SANDBOX",
      total: "10",
      basketTotal: "12000",
      status: "PENDING",
      locale: "HY",
    });
    expect(created.body).not.toHaveProperty("ownerHash");
    expect(created.body).not.toHaveProperty("providerPaymentId");
    expect(created.body.checkoutUrl).toBe(
      "https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=fixture-bank-payment&lang=am",
    );
    await get(other, `sessions/${created.body.reference}`).expect(404);
    await post(guest, `sessions/${created.body.reference}/outcome`)
      .send({ outcome: "SUCCESS" })
      .expect(403);
    bank.details.mockResolvedValue({
      ResponseCode: "00",
      Amount: 10,
      Currency: "051",
      OrderID: 30543001,
      Opaque: created.body.reference,
      OrderStatus: "2",
      PaymentState: "payment_deposited",
      DepositedAmount: 10,
    });
    const verified = await get(
      guest,
      `sessions/${created.body.reference}?paymentID=attacker&resposneCode=00&orderID=999&opaque=forged`,
    ).expect(200);
    expect(verified.body.status).toBe("SUCCEEDED");
    expect(bank.details).toHaveBeenCalledWith("fixture-bank-payment");
    expect(orderCreate).not.toHaveBeenCalled();
    expect(AMERIA_PAYMENT_FLOW_READY).toBe(false);
    await request(app.getHttpServer())
      .post("/api/v1/public/orders")
      .set("Idempotency-Key", "isolated-normal-card-disabled")
      .send({
        ...input(),
        idempotencyKey: undefined,
        paymentMethod: "CARD",
        customer: {
          name: "Fixture",
          email: "fixture@example.test",
          phone: "091123456",
          address: "Fixture address",
        },
      })
      .expect(503);
    expect(orderCreate).not.toHaveBeenCalled();
  });
  it("requires idempotency and reuses persisted initialization on retry", async () => {
    const guest = await unlocked();
    const data = input();
    await post(guest, "sessions")
      .send({ locale: data.locale, items: data.items })
      .expect(409);
    const first = await post(guest, "sessions").send(data).expect(201);
    const retry = await post(guest, "sessions").send(data).expect(201);
    expect(retry.body.reference).toBe(first.body.reference);
    expect(bank.initialize).toHaveBeenCalledTimes(1);
  });
  it("returns404 for malformed references without a database UUID conversion error", async () => {
    const guest = await unlocked();
    await get(guest, "sessions/------------------------------------").expect(
      404,
    );
    expect(model.findUnique).not.toHaveBeenCalled();
  });
  it("never grants access from config reads or extends access after owner expiry", async () => {
    const guest = await unlocked();
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now + 900_001);
    await post(guest, "sessions").send(input()).expect(403);
    expect((await get(guest, "config").expect(200)).body.accessRequired).toBe(
      true,
    );
    expect(bank.initialize).not.toHaveBeenCalled();
  });
});
