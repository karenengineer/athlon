import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { AdminSandboxPaymentsService } from "./admin-sandbox-payments.service";
import { AmeriaSandboxClient } from "./ameria-sandbox.client";

const reference = "00000000-0000-4000-8000-000000000001";
const captured = {
  ResponseCode: "00",
  Amount: 10,
  Currency: "051",
  OrderID: 30543001,
  Opaque: reference,
  OrderStatus: 2,
  PaymentState: "payment_deposited",
  DepositedAmount: 10,
  RefundedAmount: 0,
};
const refunded = {
  ...captured,
  OrderStatus: "4",
  PaymentState: "payment_refunded",
  RefundedAmount: "10.00",
};
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

function setup(row = payment(), settings: Record<string, unknown> = {}) {
  const model = {
    findMany: jest.fn().mockResolvedValue([row]),
    findUnique: jest.fn().mockImplementation(() => Promise.resolve({ ...row })),
    updateMany: jest.fn(
      (input: {
        where: Partial<ReturnType<typeof payment>>;
        data: Partial<ReturnType<typeof payment>>;
      }) => {
        const matches = Object.entries(input.where).every(
          ([key, value]) => row[key as keyof typeof row] === value,
        );
        if (!matches) return Promise.resolve({ count: 0 });
        Object.assign(row, input.data);
        return Promise.resolve({ count: 1 });
      },
    ),
  };
  const bank = {
    details: jest.fn().mockResolvedValue(captured),
    refund: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AdminSandboxPaymentsService(
    { cardPaymentSandboxSession: model } as unknown as PrismaService,
    bank as unknown as AmeriaSandboxClient,
    new ConfigService({
      CARD_PAYMENT_TEST_FLOW_ENABLED: true,
      CARD_PAYMENT_TEST_MODE: "AMERIA_SANDBOX",
      AMERIA_PAYMENTS_ENABLED: false,
      ...settings,
    }),
  );
  return { row, model, bank, service };
}

describe("AdminSandboxPaymentsService", () => {
  it("returns only display fields in a bounded page without querying the bank", async () => {
    const { service, model, bank, row } = setup();
    model.findMany.mockResolvedValue(
      Array.from({ length: 26 }, (_, index) => ({
        ...row,
        ameriaOrderId: row.ameriaOrderId + index,
        ownerHash: "not-for-the-admin-response",
        items: [{ name: "not-for-the-admin-response" }],
      })),
    );

    const response = await service.list(2);
    expect(model.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 25, take: 26 }),
    );
    expect(response).toMatchObject({ hasNext: true, refundsEnabled: true });
    expect(response.items).toHaveLength(25);
    expect(response.items[0]).toEqual({
      reference,
      ameriaOrderId: row.ameriaOrderId,
      createdAt: row.createdAt.toISOString(),
      status: "SUCCEEDED",
      canRefund: true,
    });
    expect(bank.details).not.toHaveBeenCalled();
  });

  it.each([
    { CARD_PAYMENT_TEST_FLOW_ENABLED: false },
    { CARD_PAYMENT_TEST_MODE: "MOCK" },
    { AMERIA_PAYMENTS_ENABLED: true },
  ])("blocks bank operations in configuration %j", async (settings) => {
    const { service, bank, model } = setup(payment(), settings);
    expect(await service.list(1)).toMatchObject({
      refundsEnabled: false,
      items: [{ canRefund: false }],
    });
    await expect(service.refund(reference)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.recheck(reference)).rejects.toMatchObject({
      status: 403,
    });
    expect(model.updateMany).not.toHaveBeenCalled();
    expect(bank.details).not.toHaveBeenCalled();
    expect(bank.refund).not.toHaveBeenCalled();
  });

  it.each([
    { Opaque: "other-reference" },
    { OrderID: 30543002 },
    { Currency: "840" },
    { Amount: 11 },
    { DepositedAmount: 9 },
    { RefundedAmount: 1 },
    { PaymentState: "payment_approved", OrderStatus: 1 },
  ])(
    "rejects an ineligible bank response %j before claiming a refund",
    async (details) => {
      const { service, bank, model } = setup();
      bank.details.mockResolvedValue({ ...captured, ...details });

      await expect(service.refund(reference)).rejects.toMatchObject({
        status: 409,
      });
      expect(model.updateMany).not.toHaveBeenCalled();
      expect(bank.refund).not.toHaveBeenCalled();
    },
  );

  it("claims a concurrent refund once and verifies the readback without changing checkout status", async () => {
    const { service, bank, row } = setup();
    bank.details
      .mockResolvedValueOnce(captured)
      .mockResolvedValueOnce(captured)
      .mockResolvedValueOnce(refunded);
    bank.refund.mockImplementation(() => {
      expect(row.refundAttemptedAt).toBeInstanceOf(Date);
      return Promise.resolve();
    });

    await Promise.all([service.refund(reference), service.refund(reference)]);
    expect(bank.refund).toHaveBeenCalledTimes(1);
    expect(bank.refund).toHaveBeenCalledWith(row.providerPaymentId);
    expect(row.status).toBe("SUCCEEDED");
    expect(row.refundAcknowledgedAt).toBeInstanceOf(Date);
    expect(row.refundedAt).toBeInstanceOf(Date);
    expect(await service.refund(reference)).toMatchObject({
      status: "REFUNDED",
      canRefund: false,
    });
    expect(bank.refund).toHaveBeenCalledTimes(1);
  });

  it("records a matching historical refund without submitting or claiming a new one", async () => {
    const { service, bank, row } = setup();
    bank.details.mockResolvedValue(refunded);

    expect(await service.refund(reference)).toMatchObject({
      status: "REFUNDED",
      canRefund: false,
    });
    expect(row.refundedAt).toBeInstanceOf(Date);
    expect(row.refundAttemptedAt).toBeNull();
    expect(row.refundAcknowledgedAt).toBeNull();
    expect(row.status).toBe("SUCCEEDED");
    expect(bank.refund).not.toHaveBeenCalled();
  });

  it("reconciles a timeout by polling bank details without a second refund", async () => {
    const { service, bank, row } = setup();
    bank.refund.mockRejectedValue(new Error("fixture timeout"));
    expect(await service.refund(reference)).toMatchObject({
      status: "REFUND_UNCONFIRMED",
      canRefund: false,
    });
    expect(row.refundAcknowledgedAt).toBeNull();
    expect(row.refundedAt).toBeNull();

    bank.details.mockResolvedValueOnce({ ...refunded, RefundedAmount: 1 });
    expect(await service.recheck(reference)).toMatchObject({
      status: "REFUND_UNCONFIRMED",
    });
    bank.details.mockResolvedValueOnce(refunded);
    expect(await service.recheck(reference)).toMatchObject({
      status: "REFUNDED",
      canRefund: false,
    });
    expect(row.refundAcknowledgedAt).toBeNull();
    expect(bank.refund).toHaveBeenCalledTimes(1);
  });

  it("rejects a recheck without an existing refund attempt", async () => {
    const { service, bank } = setup();
    await expect(service.recheck(reference)).rejects.toMatchObject({
      status: 409,
    });
    expect(bank.details).not.toHaveBeenCalled();
    expect(bank.refund).not.toHaveBeenCalled();
  });
});
