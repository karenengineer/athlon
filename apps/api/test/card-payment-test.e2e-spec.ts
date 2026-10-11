import { ConfigService } from "@nestjs/config";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
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

describe("Admin card-payment test flow", () => {
  let app: INestApplication;
  let accessToken: string;
  let config: ConfigService;
  const csrf = "card-test-csrf-token";
  const productId = "00000000-0000-4000-8000-000000000001";
  const productFindMany = jest.fn();
  const orderCreate = jest.fn();
  const prismaMock = {
    product: { findMany: productFindMany },
    order: { create: orderCreate },
  };

  beforeAll(async () => {
    accessToken = await new JwtService().signAsync(
      {
        sub: "55c20c13-3b51-44fb-a6ff-33fe765d29bb",
        email: "admin@athlon.test",
        role: "ADMIN",
        type: "access",
      },
      {
        secret: "test-access-secret-with-at-least-32-characters",
        expiresIn: 900,
      },
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();
    config = moduleRef.get(ConfigService);
    app = configureApplication(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => app?.close());

  beforeEach(() => {
    config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", false);
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
  });

  const adminCookies = () => [
    `athlon_access=${accessToken}`,
    `athlon_csrf=${csrf}`,
  ];
  const sessionInput = {
    locale: "hy",
    items: [{ productId, quantity: 1, expectedUnitPrice: "12000" }],
  };

  it("requires an admin session even to inspect whether the flow is enabled", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/card-payment-test/config")
      .expect(401);
  });

  it("fails closed for config and session operations when the flag is disabled", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/card-payment-test/config")
      .set("Cookie", adminCookies())
      .expect(200)
      .expect({ enabled: false, mode: "MOCK" });
    await request(app.getHttpServer())
      .post("/api/v1/admin/card-payment-test/sessions")
      .set("Cookie", adminCookies())
      .set("x-csrf-token", csrf)
      .send(sessionInput)
      .expect(404);
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it("requires matching CSRF on authenticated session mutations", async () => {
    config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", true);
    await request(app.getHttpServer())
      .post("/api/v1/admin/card-payment-test/sessions")
      .set("Cookie", [`athlon_access=${accessToken}`])
      .send(sessionInput)
      .expect(403);
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it("creates, reads, and idempotently completes an isolated mock session", async () => {
    config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", true);
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/card-payment-test/sessions")
      .set("Cookie", adminCookies())
      .set("x-csrf-token", csrf)
      .send(sessionInput)
      .expect(201);

    expect(created.body).toMatchObject({
      mode: "MOCK",
      status: "PENDING",
      locale: "HY",
      currency: "AMD",
      total: "12000",
      items: [{ name: "Հայերեն", unitPrice: "12000", lineTotal: "12000" }],
    });
    expect(created.body).not.toHaveProperty("customer");

    await request(app.getHttpServer())
      .get(`/api/v1/admin/card-payment-test/sessions/${created.body.reference}`)
      .set("Cookie", adminCookies())
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe("PENDING"));

    const completed = await request(app.getHttpServer())
      .post(
        `/api/v1/admin/card-payment-test/sessions/${created.body.reference}/outcome`,
      )
      .set("Cookie", adminCookies())
      .set("x-csrf-token", csrf)
      .send({ outcome: "SUCCESS" })
      .expect(201);
    expect(completed.body).toMatchObject({ mode: "MOCK", status: "SUCCEEDED" });

    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/card-payment-test/sessions/${created.body.reference}/outcome`,
      )
      .set("Cookie", adminCookies())
      .set("x-csrf-token", csrf)
      .send({ outcome: "SUCCESS" })
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe("SUCCEEDED"));

    expect(orderCreate).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated session creation and invalid outcome DTOs", async () => {
    config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", true);
    await request(app.getHttpServer())
      .post("/api/v1/admin/card-payment-test/sessions")
      .set("x-csrf-token", csrf)
      .send(sessionInput)
      .expect(401);

    const session = await request(app.getHttpServer())
      .post("/api/v1/admin/card-payment-test/sessions")
      .set("Cookie", adminCookies())
      .set("x-csrf-token", csrf)
      .send(sessionInput)
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/v1/admin/card-payment-test/sessions/${session.body.reference}/outcome`,
      )
      .set("Cookie", adminCookies())
      .set("x-csrf-token", csrf)
      .send({ outcome: "CHARGE_CARD" })
      .expect(400);
  });

  it("requires an expected price field on every requested item", async () => {
    config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", true);
    await request(app.getHttpServer())
      .post("/api/v1/admin/card-payment-test/sessions")
      .set("Cookie", adminCookies())
      .set("x-csrf-token", csrf)
      .send({ locale: "hy", items: [{ productId, quantity: 1 }] })
      .expect(400);
    expect(productFindMany).not.toHaveBeenCalled();
  });
});
