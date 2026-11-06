import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { ACCESS_COOKIE } from "../src/auth/auth.constants";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { AmeriaSandboxClient } from "../src/orders/ameria-sandbox.client";

const base = "/api/v1/admin/sandbox-payments";
const reference = "00000000-0000-4000-8000-000000000001";
const csrf = "isolated-sandbox-csrf-fixture";
const payment = () => ({
  reference,
  ameriaOrderId: 30543001,
  createdAt: new Date("2026-11-06T12:00:00Z"),
  providerPaymentId: "fixture-bank-payment",
  initialization: "READY",
  status: "SUCCEEDED",
  cancellationAttemptedAt: null,
  refundAttemptedAt: null as Date | null,
  refundAcknowledgedAt: null as Date | null,
  refundedAt: null as Date | null,
});

describe("Admin sandbox payments HTTP flow (bank mocked)", () => {
  let app: INestApplication;
  let cookies: string;
  let row: ReturnType<typeof payment>;
  const model = {
    findMany: jest.fn(() => Promise.resolve([{ ...row }])),
    findUnique: jest.fn(() => Promise.resolve({ ...row })),
    updateMany: jest.fn(
      ({ data }: { data: Partial<ReturnType<typeof payment>> }) => {
        Object.assign(row, data);
        return Promise.resolve({ count: 1 });
      },
    ),
  };
  const bank = {
    details: jest.fn(),
    refund: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ cardPaymentSandboxSession: model })
      .overrideProvider(AmeriaSandboxClient)
      .useValue(bank)
      .compile();
    const config = module.get(ConfigService);
    config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", true);
    config.set("CARD_PAYMENT_TEST_MODE", "AMERIA_SANDBOX");
    config.set("AMERIA_PAYMENTS_ENABLED", false);
    const jwt = module.get(JwtService);
    const token = jwt.sign(
      {
        sub: "fixture-admin",
        email: "admin@example.test",
        role: "ADMIN",
        type: "access",
      },
      { secret: config.getOrThrow<string>("ACCESS_TOKEN_SECRET") },
    );
    cookies = `${ACCESS_COOKIE}=${token}; athlon_csrf=${csrf}`;
    app = configureApplication(module.createNestApplication());
    await app.init();
  });

  beforeEach(() => {
    row = payment();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("requires a signed-in admin and CSRF before accessing or changing the payments", async () => {
    await request(app.getHttpServer()).get(base).expect(401);
    await request(app.getHttpServer())
      .post(`${base}/${reference}/refund`)
      .expect(401);
    for (const action of ["refund", "recheck"]) {
      await request(app.getHttpServer())
        .post(`${base}/${reference}/${action}`)
        .set("Cookie", cookies)
        .expect(403);
    }
    expect(model.findMany).not.toHaveBeenCalled();
    expect(model.findUnique).not.toHaveBeenCalled();
    expect(bank.details).not.toHaveBeenCalled();
    expect(bank.refund).not.toHaveBeenCalled();
  });

  it("reads and refunds a captured sandbox payment with an authenticated request", async () => {
    const capture = {
      Amount: 10,
      Currency: "051",
      Opaque: reference,
      OrderID: 30543001,
      ResponseCode: "00",
      OrderStatus: "2",
      PaymentState: "payment_deposited",
      DepositedAmount: 10,
      RefundedAmount: 0,
    };
    bank.details.mockResolvedValueOnce(capture).mockResolvedValueOnce({
      ...capture,
      OrderStatus: 4,
      PaymentState: "payment_refunded",
      RefundedAmount: 10,
    });
    const list = await request(app.getHttpServer())
      .get(base)
      .set("Cookie", cookies)
      .expect("Cache-Control", "no-store")
      .expect(200);
    expect(list.body).toEqual({
      items: [
        {
          reference,
          ameriaOrderId: 30543001,
          createdAt: row.createdAt.toISOString(),
          status: "SUCCEEDED",
          canRefund: true,
        },
      ],
      hasNext: false,
      refundsEnabled: true,
    });

    const refund = await request(app.getHttpServer())
      .post(`${base}/${reference}/refund`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrf)
      .expect("Cache-Control", "no-store")
      .expect(200);
    expect(refund.body).toMatchObject({
      reference,
      status: "REFUNDED",
      canRefund: false,
    });
    expect(row.status).toBe("SUCCEEDED");
    expect(bank.refund).toHaveBeenCalledWith("fixture-bank-payment");
    expect(bank.refund).toHaveBeenCalledTimes(1);
  });
});
