import { ConfigService } from "@nestjs/config";
import { Prisma } from "../generated/prisma/client";
import { AvailabilityStatus, Locale } from "../generated/prisma/enums";
import { PrismaService } from "../database/prisma.service";
import { AmeriaSandboxClient } from "./ameria-sandbox.client";
import { CardPaymentSandboxService } from "./card-payment-sandbox.service";
import { CardPaymentTestService } from "./card-payment-test.service";

const product = {
  id: "00000000-0000-4000-8000-000000000001",
  sku: "TEST-WHEY",
  price: new Prisma.Decimal("12000.00"),
  currency: "AMD",
  availability: AvailabilityStatus.IN_STOCK,
  published: true,
  translations: [{ locale: Locale.EN, name: "Whey" }],
};
const input = {
  idempotencyKey: "00000000-0000-4000-8000-000000000002",
  locale: "en",
  items: [
    { productId: product.id, quantity: 2, expectedUnitPrice: "12000.00" },
  ],
};

describe("CardPaymentTestService with durable Ameriabank sandbox sessions", () => {
  const config = new ConfigService({
    CARD_PAYMENT_TEST_FLOW_ENABLED: true,
    CARD_PAYMENT_TEST_MODE: "AMERIA_SANDBOX",
  });
  const bank = { initialize: jest.fn(), details: jest.fn() };
  let service: CardPaymentTestService;
  let restart: () => CardPaymentTestService;
  let owner: { id: string; expiresAtMs: number; sandboxAccess: boolean };

  beforeEach(() => {
    jest.resetAllMocks();
    owner = {
      id: "fixture-browser",
      expiresAtMs: Date.now() + 900_000,
      sandboxAccess: true,
    };
    let row: any;
    const model = {
      findUnique: jest.fn(({ where }: any) => {
        if (!row) return Promise.resolve(null);
        const matches = where.reference
          ? row.reference === where.reference
          : row.ownerHash === where.ownerHash_idempotencyKey.ownerHash &&
            row.idempotencyKey ===
              where.ownerHash_idempotencyKey.idempotencyKey;
        return Promise.resolve(matches ? { ...row } : null);
      }),
      create: jest.fn(({ data }: any) => {
        row = {
          ...data,
          status: "PENDING",
          initialization: "INITIALIZING",
          ameriaOrderId: 30543001,
          nextCheckAt: new Date(0),
        };
        return Promise.resolve({ ...row });
      }),
      update: jest.fn(({ data }: any) => {
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      }),
      updateMany: jest.fn(({ data }: any) => {
        Object.assign(row, data);
        return Promise.resolve({ count: 1 });
      }),
    };
    const tx = {
      cardPaymentSandboxSession: model,
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const prisma = {
      ...tx,
      product: { findMany: jest.fn().mockResolvedValue([product]) },
      $transaction: (work: (transaction: typeof tx) => Promise<unknown>) =>
        work(tx),
    } as unknown as PrismaService;
    bank.initialize.mockResolvedValue({ paymentId: "fixture-payment" });
    restart = () =>
      new CardPaymentTestService(
        prisma,
        config,
        new CardPaymentSandboxService(
          prisma,
          bank as unknown as AmeriaSandboxClient,
        ),
      );
    service = restart();
  });

  it("retains the quoted basket and replays the same 10 AMD bank session after restart", async () => {
    const session = await service.createSession(input, owner);
    expect(session).toMatchObject({
      mode: "AMERIA_SANDBOX",
      total: "10",
      basketTotal: "24000",
      locale: "EN",
      status: "PENDING",
      items: [expect.objectContaining({ quantity: 2, lineTotal: "24000" })],
      checkoutUrl:
        "https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=fixture-payment&lang=en",
    });
    expect(await restart().createSession(input, owner)).toEqual(session);
    expect(bank.initialize).toHaveBeenCalledTimes(1);
    expect(bank.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 30543001,
        reference: session.reference,
        locale: "EN",
      }),
    );
  });

  it("verifies bank proof through owner-scoped lookup and rejects chosen outcomes", async () => {
    const session = await service.createSession(input, owner);
    bank.details.mockResolvedValue({
      ResponseCode: "00",
      OrderStatus: 2,
      PaymentState: "payment_deposited",
      OrderID: 30543001,
      Amount: 10,
      Currency: "051",
      Opaque: session.reference,
    });
    await expect(
      restart().getSession(session.reference, "another-browser"),
    ).rejects.toMatchObject({ status: 404 });
    expect(bank.details).not.toHaveBeenCalled();
    expect(() =>
      service.completeSession(session.reference, "SUCCESS", owner.id),
    ).toThrow("Sandbox outcomes are verified by the bank only");
    await expect(
      restart().getSession(session.reference, owner.id),
    ).resolves.toMatchObject({ status: "SUCCEEDED", total: "10" });
    expect(bank.details).toHaveBeenCalledWith("fixture-payment");
  });

  it("rejects a locked browser before initializing a bank session", async () => {
    await expect(
      service.createSession(input, { ...owner, sandboxAccess: false }),
    ).rejects.toMatchObject({ status: 403 });
    expect(bank.initialize).not.toHaveBeenCalled();
  });
});
