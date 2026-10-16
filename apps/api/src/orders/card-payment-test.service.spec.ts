import { ConfigService } from "@nestjs/config";
import { Prisma } from "../generated/prisma/client";
import { AvailabilityStatus, Locale } from "../generated/prisma/enums";
import { PrismaService } from "../database/prisma.service";
import { CardPaymentTestService } from "./card-payment-test.service";

const translations = [
  { locale: Locale.HY, name: "Հայերեն" },
  { locale: Locale.EN, name: "English name" },
  { locale: Locale.RU, name: "Русское имя" },
];

const publishedProduct = {
  id: "00000000-0000-4000-8000-000000000001",
  sku: "TEST-WHEY",
  price: new Prisma.Decimal("12000.00"),
  currency: "AMD",
  availability: AvailabilityStatus.IN_STOCK,
  published: true,
  translations,
};

const validItem = {
  productId: publishedProduct.id,
  quantity: 2,
  expectedUnitPrice: "12000.00",
};

const validInput: {
  locale: "hy";
  items: Array<{
    productId: string;
    quantity: number;
    expectedUnitPrice: string | null;
  }>;
} = {
  locale: "hy" as const,
  items: [validItem],
};

const owner = { id: "test-browser", expiresAtMs: Number.MAX_SAFE_INTEGER };

describe("CardPaymentTestService", () => {
  const productFindMany = jest.fn();
  let service: CardPaymentTestService;

  beforeEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    productFindMany.mockReset().mockResolvedValue([publishedProduct]);
    service = new CardPaymentTestService(
      { product: { findMany: productFindMany } } as unknown as PrismaService,
      { get: jest.fn().mockReturnValue(true) } as unknown as ConfigService,
    );
  });

  it("uses current published product data and localized names to calculate AMD totals", async () => {
    const session = await service.createSession(
      {
        ...validInput,
        locale: "en",
      },
      owner,
    );

    expect(session).toMatchObject({
      mode: "MOCK",
      status: "PENDING",
      locale: "EN",
      currency: "AMD",
      total: "24000",
      items: [
        {
          productId: publishedProduct.id,
          sku: "TEST-WHEY",
          name: "English name",
          quantity: 2,
          unitPrice: "12000",
          lineTotal: "24000",
        },
      ],
    });
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [publishedProduct.id] }, published: true },
        include: { translations: true },
      }),
    );
  });

  it("rejects a basket price that differs from the current catalog price", async () => {
    await expect(
      service.createSession(
        {
          ...validInput,
          items: [{ ...validItem, expectedUnitPrice: "11999" }],
        },
        owner,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it.each([
    ["non-AMD", { ...publishedProduct, currency: "USD" }],
    [
      "out-of-stock",
      { ...publishedProduct, availability: AvailabilityStatus.OUT_OF_STOCK },
    ],
    ["unpriced", { ...publishedProduct, price: null }],
  ])("rejects %s catalog products", async (_label, product) => {
    productFindMany.mockResolvedValue([product]);
    await expect(
      service.createSession(validInput, owner),
    ).rejects.toBeDefined();
  });

  it.each([0, 21, 1.5])("rejects invalid quantity %s", async (quantity) => {
    await expect(
      service.createSession(
        {
          ...validInput,
          items: [{ ...validItem, quantity }],
        },
        owner,
      ),
    ).rejects.toBeDefined();
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it("rejects duplicate and oversized product lists before database lookup", async () => {
    const duplicate = [validItem, validItem];
    const tooMany = Array.from({ length: 31 }, (_, index) => ({
      productId: `${index}`,
      quantity: 1,
      expectedUnitPrice: "12000",
    }));

    await expect(
      service.createSession({ locale: "hy", items: duplicate }, owner),
    ).rejects.toBeDefined();
    await expect(
      service.createSession({ locale: "hy", items: tooMany }, owner),
    ).rejects.toBeDefined();
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it("only looks up published products and rejects products absent from that result", async () => {
    productFindMany.mockResolvedValue([]);
    await expect(
      service.createSession(validInput, owner),
    ).rejects.toBeDefined();
    expect(productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [publishedProduct.id] }, published: true },
      }),
    );
  });

  it("rejects unknown references and reports expired sessions", async () => {
    expect(() => service.getSession("unknown", owner.id)).toThrow(
      "Mock session not found",
    );
    jest.useFakeTimers().setSystemTime(new Date("2026-10-11T10:00:00Z"));
    const session = await service.createSession(validInput, owner);
    jest.advanceTimersByTime(15 * 60 * 1000 + 1);
    expect(() => service.getSession(session.reference, owner.id)).toThrow(
      "Mock session expired",
    );
  });

  it("keeps the session map bounded and prunes expired entries on writes", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-11T10:00:00Z"));
    const sessions = await Promise.all(
      Array.from({ length: 500 }, () =>
        service.createSession(validInput, owner),
      ),
    );
    jest.advanceTimersByTime(15 * 60 * 1000 + 1);
    const newest = await service.createSession(validInput, owner);

    expect(() =>
      service.getSession(sessions[499]!.reference, owner.id),
    ).toThrow("Mock session not found");
    expect(service.getSession(newest.reference, owner.id).status).toBe(
      "PENDING",
    );
  });

  it("refuses to exceed 500 live sessions", async () => {
    await Promise.all(
      Array.from({ length: 500 }, () =>
        service.createSession(validInput, owner),
      ),
    );
    await expect(
      service.createSession(validInput, owner),
    ).rejects.toMatchObject({
      status: 503,
    });
  });

  it.each([
    ["SUCCESS", "SUCCEEDED"],
    ["DECLINED", "FAILED"],
    ["CANCELLED", "CANCELLED"],
    ["TIMEOUT", "EXPIRED"],
  ] as const)(
    "maps %s to %s and makes same-outcome retries idempotent",
    async (outcome, status) => {
      const session = await service.createSession(validInput, owner);
      expect(
        service.completeSession(session.reference, outcome, owner.id),
      ).toMatchObject({
        status,
      });
      expect(
        service.completeSession(session.reference, outcome, owner.id),
      ).toMatchObject({
        status,
      });
    },
  );

  it("rejects a conflicting replay after a final mock outcome", async () => {
    const session = await service.createSession(validInput, owner);
    service.completeSession(session.reference, "SUCCESS", owner.id);
    expect(() =>
      service.completeSession(session.reference, "DECLINED", owner.id),
    ).toThrow("Mock session already has a different outcome");
  });

  it("completes mock success without creating an order or calling payment/email providers", async () => {
    const session = await service.createSession(validInput, owner);
    const result = service.completeSession(
      session.reference,
      "SUCCESS",
      owner.id,
    );

    expect(result).toMatchObject({ mode: "MOCK", status: "SUCCEEDED" });
    expect(productFindMany).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the test feature is disabled", async () => {
    service = new CardPaymentTestService(
      { product: { findMany: productFindMany } } as unknown as PrismaService,
      { get: jest.fn().mockReturnValue(false) } as unknown as ConfigService,
    );

    await expect(
      service.createSession(validInput, owner),
    ).rejects.toMatchObject({
      status: 404,
    });
    expect(productFindMany).not.toHaveBeenCalled();
  });

  it("does not create a session if the feature is disabled during catalog lookup", async () => {
    const config = new ConfigService({ CARD_PAYMENT_TEST_FLOW_ENABLED: true });
    service = new CardPaymentTestService(
      { product: { findMany: productFindMany } } as unknown as PrismaService,
      config,
    );
    productFindMany.mockImplementation(() => {
      config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", false);
      return Promise.resolve([publishedProduct]);
    });
    await expect(
      service.createSession(validInput, owner),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects session creation if the browser expires during catalog lookup", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-11T10:00:00Z"));
    const expiring = { id: owner.id, expiresAtMs: Date.now() + 1000 };
    productFindMany.mockImplementation(() => {
      jest.advanceTimersByTime(1000);
      return Promise.resolve([publishedProduct]);
    });
    await expect(
      service.createSession(validInput, expiring),
    ).rejects.toMatchObject({ status: 403 });
  });
});
