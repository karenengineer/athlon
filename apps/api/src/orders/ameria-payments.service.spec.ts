import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import {
  AmeriaPaymentsService,
  interpretPaymentDetails,
  PAYMENT_EXPIRES_AFTER_MS,
} from "./ameria-payments.service";

const reference = "ATH-1234ABCD1234ABCD1234ABCD1234ABCD";
const now = new Date("2026-11-24T10:00:00Z");
const recent = new Date(now.getTime() - 60_000);
const old = new Date(now.getTime() - PAYMENT_EXPIRES_AFTER_MS - 1);

const deposited = {
  ResponseCode: "00",
  Amount: 13000,
  DepositedAmount: 13000,
  Currency: "051",
  OrderID: 410000001,
  Opaque: reference,
  OrderStatus: 2,
  PaymentState: "payment_deposited",
};
const attemptFacts = {
  reference,
  ameriaOrderId: "410000001",
  expectedAmount: "13000",
  createdAt: recent,
  now,
};

describe("interpretPaymentDetails", () => {
  it("marks PAID only for a fully deposited payment of this exact order", () => {
    expect(interpretPaymentDetails(deposited, attemptFacts)).toEqual({
      status: "PAID",
      providerStatus: "payment_deposited",
    });
    expect(
      interpretPaymentDetails(
        { ...deposited, Amount: "13000.00", OrderStatus: "2" },
        attemptFacts,
      ).status,
    ).toBe("PAID");
  });

  it.each([
    ["another order id", { OrderID: 410000002 }],
    ["another reference", { Opaque: "ATH-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF" }],
    ["a smaller amount", { Amount: 10, DepositedAmount: 10 }],
    ["a partial deposit", { DepositedAmount: 5000 }],
    ["another currency", { Currency: "840" }],
    ["a bank error", { ResponseCode: "01" }],
    ["a mismatched state", { PaymentState: "payment_approved" }],
    ["a pre-authorization", { OrderStatus: 1 }],
    ["an auto-authorization", { OrderStatus: 5 }],
    ["a non-numeric amount", { Amount: "13000abc" }],
  ])("keeps waiting on %s", (_label, override) => {
    expect(
      interpretPaymentDetails({ ...deposited, ...override }, attemptFacts)
        .status,
    ).toBe("PENDING");
  });

  it("maps declined, voided and refunded payments", () => {
    expect(
      interpretPaymentDetails({ ...deposited, OrderStatus: 6 }, attemptFacts),
    ).toEqual({ status: "FAILED", providerStatus: "payment_declined" });
    expect(
      interpretPaymentDetails({ ...deposited, OrderStatus: 3 }, attemptFacts)
        .status,
    ).toBe("CANCELLED");
    expect(
      interpretPaymentDetails({ ...deposited, OrderStatus: 4 }, attemptFacts)
        .status,
    ).toBe("CANCELLED");
  });

  it("fails a declined card even though the bank reports a non-00 response code", () => {
    // Real live response for a wrong CVV: OrderStatus 6 with the decline code.
    expect(
      interpretPaymentDetails(
        {
          ...deposited,
          ResponseCode: "0341017",
          OrderStatus: 6,
          DepositedAmount: 0,
          PaymentState: "payment_declined",
        },
        attemptFacts,
      ),
    ).toEqual({ status: "FAILED", providerStatus: "payment_declined" });
    expect(
      interpretPaymentDetails(
        { ...deposited, ResponseCode: "0341017", OrderStatus: "6" },
        attemptFacts,
      ).status,
    ).toBe("FAILED");
  });

  it.each([
    ["another order id", { OrderID: 410000002 }],
    ["another reference", { Opaque: "ATH-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF" }],
    ["another amount", { Amount: 10 }],
    ["another currency", { Currency: "840" }],
  ])("does not fail a declined report for %s", (_label, override) => {
    expect(
      interpretPaymentDetails(
        { ...deposited, ResponseCode: "0341017", OrderStatus: 6, ...override },
        attemptFacts,
      ).status,
    ).toBe("PENDING");
  });

  it("expires a payment that never completed after the bank timeout", () => {
    expect(
      interpretPaymentDetails({ ...deposited, OrderStatus: 0 }, attemptFacts)
        .status,
    ).toBe("PENDING");
    expect(
      interpretPaymentDetails(
        { ...deposited, OrderStatus: 0 },
        { ...attemptFacts, createdAt: old },
      ).status,
    ).toBe("EXPIRED");
    // A late deposit still wins over the timeout.
    expect(
      interpretPaymentDetails(deposited, { ...attemptFacts, createdAt: old })
        .status,
    ).toBe("PAID");
  });
});

describe("AmeriaPaymentsService", () => {
  const client = {
    configured: true,
    initializePayment: jest.fn(),
    getPaymentDetails: jest.fn(),
    isTrustedCheckoutUrl: jest.fn(() => true),
  };
  const persistence = {
    findCardOrderForVerification: jest.fn(),
    applyVerifiedPaymentStatus: jest.fn(),
    hasVerifiedUnpaidAttempt: jest.fn(),
  };
  const service = new AmeriaPaymentsService(
    client as never,
    persistence as never,
  );
  const order = {
    id: "order-id",
    reference,
    locale: "HY" as const,
    currency: "AMD",
    total: { toString: () => "13000" },
    paymentAttempts: [{ id: "attempt-id", ameriaOrderId: "410000001" }],
  };
  const storedOrder = (attempt: Record<string, unknown> = {}) => ({
    id: "order-id",
    reference,
    locale: "HY",
    paymentMethod: "CARD",
    paymentAttempts: [
      {
        id: "attempt-id",
        status: "PENDING",
        ameriaOrderId: "410000001",
        expectedAmount: new Prisma.Decimal("13000"),
        providerPaymentId: "bank-payment-1",
        createdAt: new Date(),
        ...attempt,
      },
    ],
  });

  beforeEach(() => {
    jest.resetAllMocks();
    client.configured = true;
    client.isTrustedCheckoutUrl.mockReturnValue(true);
  });

  it("is disabled and never calls the bank while live payments are off", async () => {
    client.configured = false;
    expect(service.isEnabled).toBe(false);
    await expect(service.initialize(order)).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(service.verifyAndApplyStatus(reference)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(client.initializePayment).not.toHaveBeenCalled();
    expect(client.getPaymentDetails).not.toHaveBeenCalled();
  });

  it("initializes with the persisted integer OrderID and exact whole-dram total", async () => {
    client.initializePayment.mockResolvedValue({
      providerPaymentId: "p",
      checkoutUrl: "u",
    });
    await service.initialize(order);
    expect(client.initializePayment).toHaveBeenCalledWith({
      reference,
      ameriaOrderId: 410000001,
      amount: 13000,
      locale: "HY",
      description: `ATHLON order ${reference}`,
    });
  });

  it("refuses fractional totals and legacy non-integer OrderIDs", async () => {
    await expect(
      service.initialize({ ...order, total: { toString: () => "13000.5" } }),
    ).rejects.toThrow(ServiceUnavailableException);
    await expect(
      service.initialize({
        ...order,
        paymentAttempts: [{ id: "a", ameriaOrderId: "1760000000000123456" }],
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(client.initializePayment).not.toHaveBeenCalled();
  });

  it("applies a verified deposit once and reports which order became paid", async () => {
    persistence.findCardOrderForVerification.mockResolvedValue(storedOrder());
    client.getPaymentDetails.mockResolvedValue(deposited);
    persistence.applyVerifiedPaymentStatus.mockResolvedValue({ changed: true });

    await expect(service.verifyAndApplyStatus(reference)).resolves.toEqual({
      orderReference: reference,
      paymentStatus: "PAID",
      locale: "HY",
      newlyPaidOrderId: "order-id",
    });
    expect(client.getPaymentDetails).toHaveBeenCalledWith("bank-payment-1");
    expect(persistence.applyVerifiedPaymentStatus).toHaveBeenCalledWith({
      orderId: "order-id",
      paymentAttemptId: "attempt-id",
      status: "PAID",
      providerStatus: "payment_deposited",
    });

    persistence.applyVerifiedPaymentStatus.mockResolvedValue({
      changed: false,
    });
    persistence.findCardOrderForVerification.mockResolvedValue(
      storedOrder({ status: "PAID" }),
    );
    const replay = await service.verifyAndApplyStatus(reference);
    expect(replay.paymentStatus).toBe("PAID");
    expect(replay.newlyPaidOrderId).toBeUndefined();
  });

  it("reports the stored status when the bank is unreachable", async () => {
    persistence.findCardOrderForVerification.mockResolvedValue(storedOrder());
    client.getPaymentDetails.mockRejectedValue(
      new ServiceUnavailableException(),
    );
    const result = await service.verifyAndApplyStatus(reference);
    expect(result.paymentStatus).toBe("PENDING");
    expect(persistence.applyVerifiedPaymentStatus).not.toHaveBeenCalled();
  });

  it.each([
    [6, "FAILED", "payment_declined"],
    [3, "CANCELLED", "payment_void"],
  ])(
    "allows a retry after confirming bank status %s",
    async (code, status, state) => {
      persistence.findCardOrderForVerification.mockResolvedValue(storedOrder());
      client.getPaymentDetails.mockResolvedValue({
        ...deposited,
        OrderStatus: code,
        PaymentState: state,
        DepositedAmount: 0,
      });
      persistence.applyVerifiedPaymentStatus.mockResolvedValue({
        changed: true,
      });
      persistence.hasVerifiedUnpaidAttempt.mockResolvedValue(true);

      await expect(
        service.verifyAndApplyStatus(reference),
      ).resolves.toMatchObject({
        paymentStatus: status,
        retryAllowed: true,
      });
      expect(persistence.hasVerifiedUnpaidAttempt).toHaveBeenCalledWith({
        orderId: "order-id",
        paymentAttemptId: "attempt-id",
        status,
        providerStatus: state,
      });
    },
  );

  it("allows a retry when the fresh unpaid status was already persisted", async () => {
    persistence.findCardOrderForVerification.mockResolvedValue(
      storedOrder({ status: "FAILED", providerStatus: "payment_declined" }),
    );
    client.getPaymentDetails.mockResolvedValue({
      ...deposited,
      OrderStatus: 6,
      PaymentState: "payment_declined",
      DepositedAmount: 0,
    });
    persistence.applyVerifiedPaymentStatus.mockResolvedValue({
      changed: false,
    });
    persistence.hasVerifiedUnpaidAttempt.mockResolvedValue(true);

    await expect(
      service.verifyAndApplyStatus(reference),
    ).resolves.toMatchObject({
      paymentStatus: "FAILED",
      retryAllowed: true,
    });
  });

  it("does not allow a retry when a bank-confirmed deposit won the update race", async () => {
    persistence.findCardOrderForVerification
      .mockResolvedValueOnce(storedOrder())
      .mockResolvedValueOnce(
        storedOrder({ status: "PAID", providerStatus: "payment_deposited" }),
      );
    client.getPaymentDetails.mockResolvedValue({
      ...deposited,
      OrderStatus: 6,
      PaymentState: "payment_declined",
      DepositedAmount: 0,
    });
    persistence.applyVerifiedPaymentStatus.mockResolvedValue({
      changed: false,
    });
    persistence.hasVerifiedUnpaidAttempt.mockResolvedValue(false);

    await expect(service.verifyAndApplyStatus(reference)).resolves.toEqual({
      orderReference: reference,
      paymentStatus: "PAID",
      locale: "HY",
    });
  });

  it("does not allow a retry when a void followed a payment confirmation", async () => {
    persistence.findCardOrderForVerification.mockResolvedValue(storedOrder());
    client.getPaymentDetails.mockResolvedValue({
      ...deposited,
      OrderStatus: 3,
      PaymentState: "payment_void",
      DepositedAmount: 0,
    });
    persistence.applyVerifiedPaymentStatus.mockResolvedValue({ changed: true });
    persistence.hasVerifiedUnpaidAttempt.mockResolvedValue(false);

    await expect(service.verifyAndApplyStatus(reference)).resolves.toEqual({
      orderReference: reference,
      paymentStatus: "CANCELLED",
      locale: "HY",
    });
    expect(persistence.hasVerifiedUnpaidAttempt).toHaveBeenCalled();
  });

  it.each([
    [{ OrderStatus: 4 }, "CANCELLED"],
    [{ OrderStatus: 6, PaymentState: "payment_declined" }, "FAILED"],
    [{ OrderStatus: 6, DepositedAmount: 0 }, "FAILED"],
    [{ OrderStatus: 0, DepositedAmount: 0 }, "EXPIRED"],
    [{ OrderID: 123 }, "EXPIRED"],
  ])(
    "does not authorize retry for uncertain or previously paid bank data (%j)",
    async (override, status) => {
      persistence.findCardOrderForVerification.mockResolvedValue(
        storedOrder({ createdAt: old }),
      );
      client.getPaymentDetails.mockResolvedValue({ ...deposited, ...override });
      persistence.applyVerifiedPaymentStatus.mockResolvedValue({
        changed: true,
      });

      await expect(service.verifyAndApplyStatus(reference)).resolves.toEqual({
        orderReference: reference,
        paymentStatus: status,
        locale: "HY",
      });
      expect(persistence.hasVerifiedUnpaidAttempt).not.toHaveBeenCalled();
    },
  );

  it("does not reveal whether a reference belongs to a cash order", async () => {
    persistence.findCardOrderForVerification.mockResolvedValue({
      ...storedOrder(),
      paymentMethod: "CASH_ON_DELIVERY",
    });
    await expect(service.verifyAndApplyStatus(reference)).rejects.toThrow(
      NotFoundException,
    );
    persistence.findCardOrderForVerification.mockResolvedValue(null);
    await expect(service.verifyAndApplyStatus(reference)).rejects.toThrow(
      NotFoundException,
    );
  });
});
