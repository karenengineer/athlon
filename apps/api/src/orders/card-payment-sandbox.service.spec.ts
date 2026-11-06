import { PrismaService } from "../database/prisma.service";
import { AmeriaSandboxClient } from "./ameria-sandbox.client";
import { CardPaymentSandboxService } from "./card-payment-sandbox.service";

describe("CardPaymentSandboxService", () => {
  const owner = {
    id: "fixture-owner",
    expiresAtMs: Date.now() + 900_000,
    sandboxAccess: true,
  };
  const input = {
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    locale: "HY" as const,
    items: [],
    total: "12000",
  };
  const rows = new Map<string, any>();
  const bank = { initialize: jest.fn(), details: jest.fn(), cancel: jest.fn() };
  let service: CardPaymentSandboxService;
  const model = {
    findUnique: jest.fn(({ where }: any) => {
      const row = where.reference
        ? rows.get(where.reference)
        : [...rows.values()].find(
            (row) =>
              row.ownerHash === where.ownerHash_idempotencyKey.ownerHash &&
              row.idempotencyKey ===
                where.ownerHash_idempotencyKey.idempotencyKey,
          );
      return Promise.resolve(row ? { ...row } : null);
    }),
    create: jest.fn(({ data }: any) => {
      if (
        [...rows.values()].some(
          (row) =>
            row.ownerHash === data.ownerHash &&
            row.idempotencyKey === data.idempotencyKey,
        )
      )
        throw Object.assign(new Error("fixture unique conflict"), {
          code: "P2002",
        });
      const row = {
        status: "PENDING",
        initialization: "INITIALIZING",
        ameriaOrderId: 30543001 + rows.size,
        nextCheckAt: new Date(0),
        createdAt: new Date(),
        cancellationAttemptedAt: null,
        cancellationAcknowledgedAt: null,
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
        (where.nextCheckAt instanceof Date &&
          (row.nextCheckAt as Date).getTime() !==
            (where.nextCheckAt as Date).getTime()) ||
        (where.nextCheckAt?.lte && row.nextCheckAt > where.nextCheckAt.lte) ||
        (where.cancellationAttemptedAt !== undefined &&
          (row.cancellationAttemptedAt as Date | null)?.getTime() !==
            (where.cancellationAttemptedAt as Date | null)?.getTime()) ||
        (where.status && row.status !== where.status)
      )
        return Promise.resolve({ count: 0 });
      Object.assign(row, data);
      return Promise.resolve({ count: 1 });
    }),
  };
  beforeEach(() => {
    rows.clear();
    jest.clearAllMocks();
    bank.initialize.mockResolvedValue({
      paymentId: "fixture-payment",
      checkoutUrl:
        "https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=fixture-payment&lang=am",
    });
    bank.cancel.mockResolvedValue(undefined);
    service = new CardPaymentSandboxService(
      prismaFixture(),
      bank as unknown as AmeriaSandboxClient,
    );
  });
  it("requires an unlocked owner and idempotency key before any allocation", async () => {
    await expect(
      service.create(input, { ...owner, sandboxAccess: false }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.create({ ...input, idempotencyKey: undefined }, owner),
    ).rejects.toMatchObject({ status: 409 });
    expect(model.create).not.toHaveBeenCalled();
  });
  it("persists before bank initialization and deduplicates concurrent requests and service restart", async () => {
    bank.initialize.mockImplementation(() => {
      expect(rows.size).toBe(1);
      return Promise.resolve({
        paymentId: "fixture-payment",
        checkoutUrl: "fixture",
      });
    });
    const results = await Promise.allSettled([
      service.create(input, owner),
      service.create(input, owner),
    ]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    expect(bank.initialize).toHaveBeenCalledTimes(1);
    const restarted = new CardPaymentSandboxService(
      prismaFixture(),
      bank as unknown as AmeriaSandboxClient,
    );
    expect(await restarted.create(input, owner)).toMatchObject({
      total: "10",
      basketTotal: "12000",
      mode: "AMERIA_SANDBOX",
    });
    expect(bank.initialize).toHaveBeenCalledTimes(1);
    await expect(
      service.create({ ...input, total: "13000" }, owner),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("never repeats an ambiguous initialization or allocates another ID for its key", async () => {
    bank.initialize.mockRejectedValue(new Error("transport"));
    await expect(service.create(input, owner)).rejects.toMatchObject({
      status: 503,
    });
    await expect(service.create(input, owner)).rejects.toMatchObject({
      status: 503,
    });
    expect(bank.initialize).toHaveBeenCalledTimes(1);
    expect(rows.size).toBe(1);
  });
  it("does not call the bank on sequence exhaustion", async () => {
    model.create.mockRejectedValueOnce(new Error("sequence limit"));
    await expect(service.create(input, owner)).rejects.toMatchObject({
      status: 503,
    });
    expect(bank.initialize).not.toHaveBeenCalled();
  });

  function authorization(reference: string) {
    return {
      ResponseCode: "00",
      OrderID: 30543001,
      Opaque: reference,
      OrderStatus: 1,
      PaymentState: "payment_approved",
      Amount: 10,
      Currency: "051",
      ApprovedAmount: 10,
      DepositedAmount: 0,
      RefundedAmount: 0,
    };
  }

  it("advertises only an eligible authorization and verifies a single concurrent cancellation", async () => {
    const { reference } = await service.create(input, owner);
    const approved = authorization(reference);
    const cancelled = {
      ...approved,
      OrderStatus: 3,
      PaymentState: "payment_void",
    };
    bank.details.mockResolvedValue(approved);
    expect(await service.get(reference, owner.id)).toMatchObject({
      status: "PENDING",
      cancellationStatus: "AVAILABLE",
    });
    bank.cancel.mockImplementationOnce(() => {
      expect(rows.get(reference).cancellationAttemptedAt).toBeInstanceOf(Date);
      bank.details.mockResolvedValue(cancelled);
      return Promise.resolve();
    });
    await Promise.all([
      service.cancel(reference, owner),
      service.cancel(reference, owner),
    ]);
    expect(bank.cancel).toHaveBeenCalledTimes(1);
    expect(bank.cancel).toHaveBeenCalledWith("fixture-payment");
    expect(rows.get(reference).cancellationAcknowledgedAt).toBeInstanceOf(Date);
    const stored = await service.get(reference, owner.id);
    expect(stored.status).toBe("CANCELLED");
    expect(stored).not.toHaveProperty("cancellationStatus");
    expect(stored).not.toHaveProperty("checkoutUrl");
  });

  it("retains an unconfirmed cancellation after a lost response and reconciles without another bank write", async () => {
    const { reference } = await service.create(input, owner);
    const approved = authorization(reference);
    bank.details.mockResolvedValue(approved);
    bank.cancel.mockRejectedValueOnce(new Error("fixture transport timeout"));
    const attempted = await service.cancel(reference, owner);
    expect(attempted).toMatchObject({
      status: "PENDING",
      cancellationStatus: "UNCONFIRMED",
    });
    expect(attempted).not.toHaveProperty("checkoutUrl");

    const restarted = new CardPaymentSandboxService(
      prismaFixture(),
      bank as unknown as AmeriaSandboxClient,
    );
    await restarted.cancel(reference, owner);
    bank.details.mockResolvedValue({
      ...approved,
      OrderStatus: 3,
      PaymentState: "payment_void",
    });
    expect(await restarted.get(reference, owner.id)).toMatchObject({
      status: "CANCELLED",
    });
    expect(bank.cancel).toHaveBeenCalledTimes(1);
    expect(rows.get(reference).cancellationAcknowledgedAt).toBeNull();
  });

  it("cannot overwrite an attempted cancellation with a status poll started before its claim", async () => {
    const { reference } = await service.create(input, owner);
    const approved = authorization(reference);
    let signalPoll!: () => void;
    let finishPoll!: () => void;
    const started = new Promise<void>((resolve) => {
      signalPoll = resolve;
    });
    const delayed = new Promise<void>((resolve) => {
      finishPoll = resolve;
    });
    bank.details
      .mockResolvedValue(approved)
      .mockImplementationOnce(async () => {
        signalPoll();
        await delayed;
        return {
          ...approved,
          OrderStatus: 2,
          PaymentState: "payment_deposited",
          DepositedAmount: 10,
        };
      });
    const poll = service.get(reference, owner.id);
    await started;
    bank.cancel.mockRejectedValueOnce(new Error("fixture transport timeout"));
    await service.cancel(reference, owner);
    finishPoll();
    expect(await poll).toMatchObject({
      status: "PENDING",
      cancellationStatus: "UNCONFIRMED",
    });
    expect(rows.get(reference).status).toBe("PENDING");
  });

  it("waits for the exact bank void even after the cancellation is acknowledged", async () => {
    const { reference } = await service.create(input, owner);
    const approved = authorization(reference);
    bank.details.mockResolvedValueOnce(approved).mockResolvedValue({
      ...approved,
      OrderStatus: 4,
      PaymentState: "payment_refunded",
    });
    expect(await service.cancel(reference, owner)).toMatchObject({
      status: "PENDING",
      cancellationStatus: "UNCONFIRMED",
    });
    expect(await service.get(reference, owner.id)).toMatchObject({
      status: "PENDING",
      cancellationStatus: "UNCONFIRMED",
    });
  });

  it.each([
    { OrderStatus: 2, PaymentState: "payment_deposited", DepositedAmount: 10 },
    { OrderStatus: 3, PaymentState: "payment_void" },
    { ApprovedAmount: 0 },
    { DepositedAmount: 1 },
    { RefundedAmount: 1 },
    { Opaque: "another-order" },
    { OrderID: 30543002 },
    { Currency: "840" },
    { Amount: 11 },
  ])(
    "never sends a cancellation for ineligible bank details %j",
    async (invalid) => {
      const { reference } = await service.create(input, owner);
      bank.details.mockResolvedValue({
        ...authorization(reference),
        ...invalid,
      });
      await expect(service.cancel(reference, owner)).rejects.toMatchObject({
        status: 409,
      });
      expect(bank.cancel).not.toHaveBeenCalled();
      expect(rows.get(reference).cancellationAttemptedAt).toBeNull();
    },
  );

  it("requires current browser authorization, ownership and a fresh bank session", async () => {
    const { reference } = await service.create(input, owner);
    await expect(
      service.cancel(reference, { ...owner, sandboxAccess: false }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.cancel(reference, { ...owner, expiresAtMs: 0 }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.cancel(reference, { ...owner, id: "different-browser" }),
    ).rejects.toMatchObject({ status: 404 });
    rows.get(reference).createdAt = new Date(Date.now() - 72 * 60 * 60_000);
    await expect(service.cancel(reference, owner)).rejects.toMatchObject({
      status: 409,
    });
    expect(bank.details).not.toHaveBeenCalled();
    expect(bank.cancel).not.toHaveBeenCalled();
  });
  it.each([
    "------------------------------------",
    "not-a-uuid",
    "00000000-0000-0000-0000-000000000000",
  ])(
    "rejects malformed references before database lookup: %s",
    async (reference) => {
      await expect(service.get(reference, owner.id)).rejects.toMatchObject({
        status: 404,
      });
      expect(model.findUnique).not.toHaveBeenCalled();
    },
  );
  it("does not let a stale status response overwrite a newer verification claim", async () => {
    const session = await service.create(input, owner);
    bank.details.mockImplementation(() => {
      const row = rows.get(session.reference);
      row.nextCheckAt = new Date(Date.now() + 30_000);
      return Promise.resolve({
        ResponseCode: "00",
        OrderStatus: 6,
        Amount: 10,
        Currency: "051",
        OrderID: 30543001,
        Opaque: session.reference,
      });
    });
    expect(await service.get(session.reference, owner.id)).toMatchObject({
      status: "PENDING",
    });
  });
  it("limits bank timeout to remaining browser authorization and leaves expired pending results unconfirmed", async () => {
    const session = await service.create(input, {
      ...owner,
      expiresAtMs: Date.now() + 60_000,
    });
    expect(
      bank.initialize.mock.calls[0]![0].timeoutSeconds,
    ).toBeLessThanOrEqual(60);
    const row = rows.get(session.reference);
    row.expiresAt = new Date(0);
    bank.details.mockResolvedValue({ ResponseCode: "0-100", OrderStatus: "0" });
    expect(await service.get(session.reference, owner.id)).toMatchObject({
      status: "PENDING",
    });
    expect(await service.get(session.reference, owner.id)).not.toHaveProperty(
      "checkoutUrl",
    );
  });
  it.each([
    [
      {
        ResponseCode: "00",
        OrderStatus: 2,
        PaymentState: "payment_deposited",
        Amount: 10,
        Currency: "051",
      },
      "SUCCEEDED",
    ],
    [
      {
        ResponseCode: "00",
        OrderStatus: 1,
        PaymentState: "payment_approved",
        Amount: 10,
        Currency: "051",
      },
      "PENDING",
    ],
    [
      {
        ResponseCode: "00",
        OrderStatus: 6,
        PaymentState: "payment_declined",
        Amount: 10,
        Currency: "051",
      },
      "FAILED",
    ],
    [
      {
        ResponseCode: "00",
        OrderStatus: 3,
        PaymentState: "payment_void",
        Amount: 10,
        Currency: "051",
      },
      "CANCELLED",
    ],
    [
      {
        ResponseCode: "00",
        OrderStatus: 1,
        PaymentState: "payment_approved",
        Amount: 10,
        Currency: "051",
        DepositedAmount: 0,
      },
      "PENDING",
    ],
    [
      {
        ResponseCode: "05",
        OrderStatus: "6",
        PaymentState: "payment_declined",
        Amount: 10,
        Currency: "051",
        DepositedAmount: 0,
      },
      "FAILED",
    ],
  ])(
    "verifies stored bank identity and reconciles one-step result %j",
    async (details, status) => {
      const session = await service.create(input, owner);
      bank.details.mockResolvedValue({
        ...details,
        OrderID: 30543001,
        Opaque: session.reference,
      });
      expect(await service.get(session.reference, owner.id)).toMatchObject({
        status,
      });
      expect(bank.details).toHaveBeenCalledWith("fixture-payment");
      await service.get(session.reference, owner.id);
      expect(bank.details).toHaveBeenCalledTimes(1);
      await expect(
        service.get(session.reference, "another-owner"),
      ).rejects.toMatchObject({ status: 404 });
    },
  );
  it.each([
    { Amount: 100 },
    { Currency: "840" },
    { OrderID: 999 },
    { Opaque: "forged" },
    { DepositedAmount: 1 },
    { ResponseCode: 0 },
    { OrderStatus: 2, PaymentState: "payment_approved" },
  ])("fails closed for forged or mismatched result %j", async (forged) => {
    const session = await service.create(input, owner);
    bank.details.mockResolvedValue({
      ResponseCode: "00",
      OrderStatus: 2,
      PaymentState: "payment_deposited",
      Amount: 10,
      Currency: "051",
      OrderID: 30543001,
      Opaque: session.reference,
      ...forged,
    });
    await expect(
      service.get(session.reference, owner.id),
    ).rejects.toMatchObject({ status: 503 });
    expect([...rows.values()][0].status).toBe("PENDING");
  });
  function prismaFixture() {
    let chain = Promise.resolve();
    const tx = {
      cardPaymentSandboxSession: model,
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    return {
      ...tx,
      $transaction: (fn: (value: typeof tx) => Promise<unknown>) => {
        const result = chain.then(() => fn(tx));
        chain = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    } as unknown as PrismaService;
  }
});
