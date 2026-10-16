import { ConfigService } from "@nestjs/config";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { PrismaService } from "../src/database/prisma.service";
import { Locale } from "../src/generated/prisma/enums";
import { AmeriaSandboxClient } from "../src/orders/ameria-sandbox.client";
import { CardPaymentSandboxService } from "../src/orders/card-payment-sandbox.service";
import { cleanupOwnedResources } from "./isolated-cleanup";

const exec = promisify(execFile);
// Never connects to DATABASE_URL. The opt-in suite owns a unique temporary DB.
const integration =
  process.env.ATHLON_PG_INTEGRATION === "1" ? describe : describe.skip;
integration("Isolated actual PostgreSQL sandbox payment persistence", () => {
  const container = `athlon-payment-sandbox-${randomUUID()}`;
  let created = false;
  let prisma: PrismaService | undefined;
  let service: CardPaymentSandboxService;
  const bank = { initialize: jest.fn(), details: jest.fn() };
  const owner = {
    id: "isolated-browser",
    sandboxAccess: true,
    expiresAtMs: Date.now() + 900_000,
  };
  const basket = () => ({
    locale: Locale.HY,
    total: "12000",
    items: [],
    idempotencyKey: randomUUID(),
  });
  beforeAll(async () => {
    await exec("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      container,
      "--label",
      "athlon.test=payment-sandbox",
      "-e",
      "POSTGRES_USER=athlon_sandbox",
      "-e",
      "POSTGRES_PASSWORD=isolated-sandbox-only",
      "-e",
      "POSTGRES_DB=athlon_sandbox",
      "-p",
      "127.0.0.1::5432",
      "postgres:17-alpine",
    ]);
    created = true;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await exec("docker", [
          "exec",
          container,
          "pg_isready",
          "-U",
          "athlon_sandbox",
          "-d",
          "athlon_sandbox",
        ]);
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!ready) throw new Error("Isolated PostgreSQL did not start");
    const { stdout } = await exec("docker", ["port", container, "5432/tcp"]);
    const port = stdout.trim().match(/^127\.0\.0\.1:(\d+)$/)?.[1];
    if (!port) throw new Error("Expected isolated loopback port");
    const url = `postgresql://athlon_sandbox:isolated-sandbox-only@127.0.0.1:${port}/athlon_sandbox`;
    await exec("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: url },
      timeout: 60_000,
    });
    prisma = new PrismaService(new ConfigService({ DATABASE_URL: url }));
    service = new CardPaymentSandboxService(
      prisma,
      bank as unknown as AmeriaSandboxClient,
    );
  }, 120_000);
  afterAll(async () => {
    await cleanupOwnedResources([
      ...(prisma
        ? [
            {
              label: "isolated Prisma",
              cleanup: () => prisma!.onModuleDestroy(),
            },
          ]
        : []),
      ...(created
        ? [
            {
              label: container,
              cleanup: () =>
                exec("docker", ["stop", container], { timeout: 15_000 }),
            },
          ]
        : []),
    ]);
  }, 30_000);
  beforeEach(() => {
    jest.clearAllMocks();
    bank.initialize.mockImplementation(() =>
      Promise.resolve({ paymentId: randomUUID(), checkoutUrl: "fixture" }),
    );
  });

  it("serializes concurrent same-key reservations without consuming extra finite IDs, across service instances", async () => {
    const input = {
      ...basket(),
      idempotencyKey: "abcdefab-abcd-4abc-8abc-abcdefabcdef",
    };
    const another = new CardPaymentSandboxService(
      prisma!,
      bank as unknown as AmeriaSandboxClient,
    );
    // Hold INSERTs while both case spellings pass their initial reads. With an
    // unnormalized advisory key, two INSERTs queue and both spend a sequence ID.
    let unlock!: () => void;
    let tableLocked!: () => void;
    const ready = new Promise<void>((resolve) => {
      tableLocked = resolve;
    });
    const release = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const blocker = prisma!.$transaction(async (tx) => {
      await tx.$executeRaw`LOCK TABLE "CardPaymentSandboxSession" IN SHARE MODE`;
      tableLocked();
      await release;
    });
    await ready;
    const attempts = Promise.allSettled(
      Array.from({ length: 2 }, (_, index) =>
        (index % 2 ? another : service).create(
          {
            ...input,
            idempotencyKey:
              index % 2
                ? input.idempotencyKey.toUpperCase()
                : input.idempotencyKey,
          },
          owner,
        ),
      ),
    );
    try {
      for (let n = 0; n < 20; n++) {
        const waiting = await prisma!.$queryRaw<
          Array<{ count: bigint }>
        >`SELECT count(*) FROM pg_locks WHERE relation='"CardPaymentSandboxSession"'::regclass AND mode='RowExclusiveLock' AND NOT granted`;
        if (Number(waiting[0]!.count) >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } finally {
      unlock();
      await blocker;
    }
    const results = await attempts;
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    expect(bank.initialize).toHaveBeenCalledTimes(1);
    expect(await prisma!.cardPaymentSandboxSession.count()).toBe(1);
    const sequence = await prisma!.$queryRaw<
      Array<{ last_value: number }>
    >`SELECT last_value FROM card_payment_sandbox_order_id_seq`;
    expect(Number(sequence[0]!.last_value)).toBe(30543001);
    const restarted = new CardPaymentSandboxService(
      prisma!,
      bank as unknown as AmeriaSandboxClient,
    );
    expect(await restarted.create(input, owner)).toMatchObject({
      mode: "AMERIA_SANDBOX",
      total: "10",
    });
    expect(bank.initialize).toHaveBeenCalledTimes(1);
  });
  it("allocates distinct IDs for concurrent baskets and persists ambiguous initialization across restart", async () => {
    const inputs = Array.from({ length: 6 }, basket);
    await Promise.all(inputs.map((input) => service.create(input, owner)));
    const rows = await prisma!.cardPaymentSandboxSession.findMany();
    expect(new Set(rows.map((row) => row.ameriaOrderId)).size).toBe(7);
    expect(
      rows.every(
        (row) => row.ameriaOrderId >= 30543001 && row.ameriaOrderId <= 30544000,
      ),
    ).toBe(true);
    const ambiguous = basket();
    bank.initialize.mockRejectedValueOnce(
      new Error("fixture transport timeout"),
    );
    await expect(service.create(ambiguous, owner)).rejects.toMatchObject({
      status: 503,
    });
    const restarted = new CardPaymentSandboxService(
      prisma!,
      bank as unknown as AmeriaSandboxClient,
    );
    await expect(restarted.create(ambiguous, owner)).rejects.toMatchObject({
      status: 503,
    });
    expect(bank.initialize).toHaveBeenCalledTimes(7);
    expect(await prisma!.order.count()).toBe(0);
    expect(await prisma!.paymentAttempt.count()).toBe(0);
    expect(await prisma!.sale.count()).toBe(0);
    expect(await prisma!.orderNotification.count()).toBe(0);
  });
  it("consumes rolled-back sequence allocations and exhausts at30544000 without cycling or bank calls", async () => {
    const before = await prisma!.$queryRaw<
      Array<{ last_value: number }>
    >`SELECT last_value FROM card_payment_sandbox_order_id_seq`;
    await expect(
      prisma!.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT nextval('card_payment_sandbox_order_id_seq')`;
        throw new Error("rollback fixture");
      }),
    ).rejects.toThrow("rollback fixture");
    const after = await prisma!.$queryRaw<
      Array<{ last_value: number }>
    >`SELECT last_value FROM card_payment_sandbox_order_id_seq`;
    expect(Number(after[0]!.last_value)).toBe(
      Number(before[0]!.last_value) + 1,
    );
    await prisma!
      .$queryRaw`SELECT setval('card_payment_sandbox_order_id_seq',30543999,true)`;
    await service.create(basket(), owner);
    expect(bank.initialize).toHaveBeenCalledTimes(1);
    await expect(service.create(basket(), owner)).rejects.toMatchObject({
      status: 503,
    });
    expect(bank.initialize).toHaveBeenCalledTimes(1);
    const seq = await prisma!.$queryRaw<
      Array<{ last_value: number }>
    >`SELECT last_value FROM card_payment_sandbox_order_id_seq`;
    expect(Number(seq[0]!.last_value)).toBe(30544000);
    const properties = await prisma!.$queryRaw<
      Array<{ cycle: boolean }>
    >`SELECT cycle FROM pg_sequences WHERE sequencename='card_payment_sandbox_order_id_seq'`;
    expect(properties[0]!.cycle).toBe(false);
  });
});
