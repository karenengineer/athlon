import { ConfigService } from "@nestjs/config";
import { Prisma } from "../generated/prisma/client";
import { AvailabilityStatus, Locale } from "../generated/prisma/enums";
import { PrismaService } from "../database/prisma.service";
import { AmeriaSandboxClient } from "./ameria-sandbox.client";
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
  locale: "en",
  items: [
    { productId: product.id, quantity: 2, expectedUnitPrice: "12000.00" },
  ],
};

const settings: Record<string, unknown> = {
  CARD_PAYMENT_TEST_FLOW_ENABLED: true,
  CARD_PAYMENT_TEST_MODE: "AMERIA_SANDBOX",
  AMERIA_TEST_BACK_URL_BASE: "https://athlon.am",
  AMERIA_TEST_AMOUNT: 10,
  AMERIA_TEST_ORDER_ID_MIN: 30543001,
  AMERIA_TEST_ORDER_ID_MAX: 30543002,
};

describe("CardPaymentTestService (Ameriabank sandbox mode)", () => {
  const aggregate = jest.fn();
  const create = jest.fn();
  const initPayment = jest.fn();
  const getPaymentDetails = jest.fn();
  const checkoutUrl = jest.fn();
  let service: CardPaymentTestService;

  beforeEach(() => {
    aggregate.mockReset().mockResolvedValue({ _max: { orderId: null } });
    create.mockReset().mockResolvedValue({});
    initPayment.mockReset().mockResolvedValue({ paymentId: "pay-1" });
    getPaymentDetails.mockReset();
    checkoutUrl
      .mockReset()
      .mockReturnValue(
        "https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=pay-1&lang=en",
      );
    service = new CardPaymentTestService(
      {
        product: { findMany: jest.fn().mockResolvedValue([product]) },
        cardPaymentTestOrderId: { aggregate, create },
      } as unknown as PrismaService,
      {
        get: jest.fn((key: string, fallback?: unknown) =>
          key in settings ? settings[key] : fallback,
        ),
      } as unknown as ConfigService,
      {
        initPayment,
        getPaymentDetails,
        checkoutUrl,
      } as unknown as AmeriaSandboxClient,
    );
  });

  it("registers a 10 AMD payment with the first in-range OrderID and returns the bank page", async () => {
    const session = await service.createSession(input);

    expect(create).toHaveBeenCalledWith({
      data: { orderId: 30543001, reference: session.reference },
    });
    expect(initPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 30543001,
        amount: "10",
        backUrl: "https://athlon.am/card-payment-test/en",
        opaque: session.reference,
      }),
    );
    expect(session).toMatchObject({
      mode: "AMERIA_SANDBOX",
      status: "PENDING",
      checkoutUrl:
        "https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=pay-1&lang=en",
    });
  });

  it("continues after the highest allocated OrderID and stops at the range end", async () => {
    aggregate.mockResolvedValue({ _max: { orderId: 30543001 } });
    await service.createSession(input);
    expect(create).toHaveBeenCalledWith({
      data: { orderId: 30543002, reference: expect.any(String) },
    });

    aggregate.mockResolvedValue({ _max: { orderId: 30543002 } });
    await expect(service.createSession(input)).rejects.toMatchObject({
      status: 503,
    });
  });

  it("retries when another request took the same OrderID", async () => {
    create.mockRejectedValueOnce({ code: "P2002" }).mockResolvedValue({});
    await service.createSession(input);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("marks the session paid only after the bank reports it", async () => {
    const session = await service.createSession(input);
    getPaymentDetails.mockResolvedValue({
      orderId: "30543001",
      amount: "10",
      orderStatus: "2",
    });

    await expect(
      service.verifySession(session.reference),
    ).resolves.toMatchObject({ status: "SUCCEEDED" });
    expect(getPaymentDetails).toHaveBeenCalledWith("pay-1");
  });

  it.each([
    ["0", "PENDING"],
    ["6", "FAILED"],
    ["3", "CANCELLED"],
  ])("maps bank order status %s to %s", async (orderStatus, expected) => {
    const session = await service.createSession(input);
    getPaymentDetails.mockResolvedValue({
      orderId: "30543001",
      amount: "10",
      orderStatus,
    });
    await expect(
      service.verifySession(session.reference),
    ).resolves.toMatchObject({ status: expected });
  });

  it("rejects bank details that do not match the session", async () => {
    const session = await service.createSession(input);
    getPaymentDetails.mockResolvedValue({
      orderId: "999",
      amount: "10",
      orderStatus: "2",
    });
    await expect(
      service.verifySession(session.reference),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("does not allow mock outcomes on a sandbox session", async () => {
    const session = await service.createSession(input);
    expect(() => service.completeSession(session.reference, "SUCCESS")).toThrow(
      "Outcomes are chosen on the bank's page",
    );
  });
});
