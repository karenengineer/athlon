import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import {
  CardPaymentSandboxSession,
  Locale,
  Prisma,
} from "../generated/prisma/client";
import { AmeriaSandboxClient } from "./ameria-sandbox.client";
import { CardPaymentTestOwner } from "./card-payment-test-guest-context.service";
import type { CardPaymentTestSession } from "./card-payment-test.service";

type Basket = {
  idempotencyKey?: string | undefined;
  locale: Locale;
  total: string;
  items: CardPaymentTestSession["items"];
};
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

@Injectable()
export class CardPaymentSandboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bank: AmeriaSandboxClient,
  ) {}

  async create(
    input: Basket,
    owner: CardPaymentTestOwner,
  ): Promise<CardPaymentTestSession> {
    if (!owner.sandboxAccess || owner.expiresAtMs <= Date.now())
      throw new ForbiddenException("Sandbox access required");
    if (
      !input.idempotencyKey ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.idempotencyKey,
      )
    )
      throw new ConflictException("Sandbox idempotency key required");
    const idempotencyKey = input.idempotencyKey.toLowerCase();
    const ownerHash = hash(owner.id);
    const fingerprint = hash(
      JSON.stringify({
        locale: input.locale,
        total: input.total,
        items: input.items,
      }),
    );
    const where = { ownerHash_idempotencyKey: { ownerHash, idempotencyKey } };
    const existing = await this.prisma.cardPaymentSandboxSession.findUnique({
      where,
    });
    if (existing) return this.replay(existing, fingerprint);
    let row: CardPaymentSandboxSession;
    try {
      const reserved = await this.prisma.$transaction(async (tx) => {
        // Lock before INSERT: unique conflicts alone would still consume the finite
        // PostgreSQL sequence through its column default before checking uniqueness.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ownerHash + ":" + idempotencyKey}, 0))::text`;
        const prior = await tx.cardPaymentSandboxSession.findUnique({ where });
        if (prior) return { row: prior, created: false };
        const allocated = await tx.cardPaymentSandboxSession.create({
          data: {
            reference: randomUUID(),
            ownerHash,
            idempotencyKey,
            requestFingerprint: fingerprint,
            locale: input.locale,
            basketTotal: input.total,
            items: input.items as Prisma.InputJsonValue,
            expiresAt: new Date(
              Math.min(Date.now() + 900_000, owner.expiresAtMs),
            ),
          },
        });
        return { row: allocated, created: true };
      });
      if (!reserved.created) return this.replay(reserved.row, fingerprint);
      row = reserved.row;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const raced = await this.prisma.cardPaymentSandboxSession.findUnique({
          where,
        });
        if (raced) return this.replay(raced, fingerprint);
      }
      throw new ServiceUnavailableException(
        "Sandbox session allocation unavailable",
      );
    }
    // The durable INITIALIZING claim is committed before the external request. A crash or
    // timeout must never repeat InitPayment, even if the bank accepted the first request.
    try {
      const timeoutSeconds = Math.floor(
        (row.expiresAt.getTime() - Date.now()) / 1000,
      );
      if (timeoutSeconds < 1) throw new Error("Browser expired");
      const initialized = await this.bank.initialize({
        reference: row.reference,
        orderId: row.ameriaOrderId,
        locale: row.locale,
        timeoutSeconds,
      });
      row = await this.prisma.cardPaymentSandboxSession.update({
        where: { reference: row.reference },
        data: {
          providerPaymentId: initialized.paymentId,
          initialization: "READY",
        },
      });
      return this.publicSession(row);
    } catch {
      await this.prisma.cardPaymentSandboxSession.updateMany({
        where: { reference: row.reference, initialization: "INITIALIZING" },
        data: { initialization: "UNKNOWN" },
      });
      throw new ServiceUnavailableException(
        "Sandbox initialization is unconfirmed; do not retry with a new key",
      );
    }
  }

  async get(
    reference: string,
    ownerId: string,
  ): Promise<CardPaymentTestSession> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        reference,
      )
    )
      throw new NotFoundException("Sandbox session not found");
    let row = await this.prisma.cardPaymentSandboxSession.findUnique({
      where: { reference },
    });
    if (!row || row.ownerHash !== hash(ownerId))
      throw new NotFoundException("Sandbox session not found");
    if (row.initialization !== "READY" || !row.providerPaymentId)
      throw new ServiceUnavailableException(
        "Sandbox initialization is unconfirmed",
      );
    if (row.status !== "PENDING" || row.nextCheckAt.getTime() > Date.now())
      return this.publicSession(row);
    const claimUntil = new Date(Date.now() + 15_000);
    const claim = await this.prisma.cardPaymentSandboxSession.updateMany({
      where: { reference, status: "PENDING", nextCheckAt: { lte: new Date() } },
      data: { nextCheckAt: claimUntil },
    });
    if (!claim.count) {
      row = (await this.prisma.cardPaymentSandboxSession.findUnique({
        where: { reference },
      }))!;
      return this.publicSession(row);
    }
    const details = await this.bank.details(row.providerPaymentId);
    const moneyEqualsTen = (value: unknown) =>
      (typeof value === "number" || typeof value === "string") &&
      /^10(?:\.0{1,2})?$/.test(String(value));
    // The bank can report no attempt / ACS pending with a non-success response
    // code. Such responses never prove payment or modify a terminal status.
    const orderStatus = /^[0-6]$/.test(String(details.OrderStatus))
      ? Number(details.OrderStatus)
      : -1;
    if ([0, 1, 5].includes(orderStatus) && details.ResponseCode !== "00")
      return this.publicSession(row);
    if (details.ResponseCode !== "00" && orderStatus !== 6)
      throw new ServiceUnavailableException(
        "Sandbox payment details could not be verified",
      );
    if (
      !moneyEqualsTen(details.Amount) ||
      details.Currency !== "051" ||
      String(details.OrderID) !== String(row.ameriaOrderId) ||
      details.Opaque !== row.reference ||
      (orderStatus === 2 &&
        details.DepositedAmount !== undefined &&
        !moneyEqualsTen(details.DepositedAmount))
    )
      throw new ServiceUnavailableException(
        "Sandbox payment details could not be verified",
      );
    let status = "PENDING";
    if (orderStatus === 2 && details.PaymentState === "payment_deposited")
      status = "SUCCEEDED";
    else if (orderStatus === 6) status = "FAILED";
    else if (orderStatus === 3 || orderStatus === 4) status = "CANCELLED";
    else if (![0, 1, 5].includes(orderStatus))
      throw new ServiceUnavailableException(
        "Sandbox payment state could not be verified",
      );
    if (status !== "PENDING") {
      await this.prisma.cardPaymentSandboxSession.updateMany({
        where: { reference, status: "PENDING", nextCheckAt: claimUntil },
        data: { status },
      });
    }
    row = (await this.prisma.cardPaymentSandboxSession.findUnique({
      where: { reference },
    }))!;
    return this.publicSession(row);
  }

  private replay(
    row: CardPaymentSandboxSession,
    fingerprint: string,
  ): CardPaymentTestSession {
    if (row.requestFingerprint !== fingerprint)
      throw new ConflictException(
        "Idempotency key belongs to a different basket",
      );
    if (row.initialization !== "READY")
      throw new ServiceUnavailableException(
        "Sandbox initialization is unconfirmed; do not retry with a new key",
      );
    return this.publicSession(row);
  }
  private publicSession(
    row: CardPaymentSandboxSession,
  ): CardPaymentTestSession {
    const lang = row.locale === "HY" ? "am" : row.locale.toLowerCase();
    return {
      reference: row.reference,
      mode: "AMERIA_SANDBOX",
      status: row.status as CardPaymentTestSession["status"],
      locale: row.locale,
      currency: "AMD",
      total: "10",
      basketTotal: row.basketTotal.toString(),
      items: row.items as unknown as CardPaymentTestSession["items"],
      expiresAt: row.expiresAt.toISOString(),
      ...(row.providerPaymentId &&
      row.status === "PENDING" &&
      row.expiresAt.getTime() > Date.now()
        ? {
            checkoutUrl: `https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=${encodeURIComponent(row.providerPaymentId)}&lang=${lang}`,
          }
        : {}),
    };
  }
}
