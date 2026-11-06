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
const CANCELLATION_WINDOW_MS = 72 * 60 * 60_000;

export function bankAmountIs(value: unknown, amount: 0 | 10): boolean {
  return (
    value === amount ||
    value === String(amount) ||
    value === `${amount}.0` ||
    value === `${amount}.00`
  );
}

export function sameBankPayment(
  row: Pick<CardPaymentSandboxSession, "reference" | "ameriaOrderId">,
  details: Record<string, unknown>,
): boolean {
  return (
    bankAmountIs(details.Amount, 10) &&
    details.Currency === "051" &&
    (details.OrderID === row.ameriaOrderId ||
      details.OrderID === String(row.ameriaOrderId)) &&
    details.Opaque === row.reference
  );
}

function withinCancellationWindow(row: CardPaymentSandboxSession): boolean {
  const age = Date.now() - row.createdAt.getTime();
  return age >= 0 && age < CANCELLATION_WINDOW_MS;
}

function canCancel(
  row: CardPaymentSandboxSession,
  details: Record<string, unknown>,
): boolean {
  return (
    withinCancellationWindow(row) &&
    sameBankPayment(row, details) &&
    details.ResponseCode === "00" &&
    (details.OrderStatus === 1 || details.OrderStatus === "1") &&
    details.PaymentState === "payment_approved" &&
    bankAmountIs(details.ApprovedAmount, 10) &&
    bankAmountIs(details.DepositedAmount, 0) &&
    bankAmountIs(details.RefundedAmount, 0)
  );
}

function confirmsCancellation(
  row: CardPaymentSandboxSession,
  details: Record<string, unknown>,
): boolean {
  return (
    sameBankPayment(row, details) &&
    details.ResponseCode === "00" &&
    (details.OrderStatus === 3 || details.OrderStatus === "3") &&
    details.PaymentState === "payment_void" &&
    bankAmountIs(details.DepositedAmount, 0) &&
    bankAmountIs(details.RefundedAmount, 0)
  );
}

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
    this.assertSandboxAccess(owner);
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
    const row = await this.ownedReadySession(reference, ownerId);
    if (row.status !== "PENDING" || row.nextCheckAt.getTime() > Date.now())
      return this.publicSession(row);
    const claimUntil = new Date(Date.now() + 15_000);
    const claim = await this.prisma.cardPaymentSandboxSession.updateMany({
      where: {
        reference,
        status: "PENDING",
        nextCheckAt: { lte: new Date() },
        cancellationAttemptedAt: row.cancellationAttemptedAt,
      },
      data: { nextCheckAt: claimUntil },
    });
    if (!claim.count)
      return this.publicSession(
        await this.ownedReadySession(reference, ownerId),
      );

    const details = await this.bank.details(row.providerPaymentId);
    const status = row.cancellationAttemptedAt
      ? confirmsCancellation(row, details)
        ? "CANCELLED"
        : "PENDING"
      : this.checkoutStatus(row, details);
    if (status !== "PENDING") {
      await this.prisma.cardPaymentSandboxSession.updateMany({
        where: {
          reference,
          status: "PENDING",
          nextCheckAt: claimUntil,
          cancellationAttemptedAt: row.cancellationAttemptedAt,
        },
        data: { status },
      });
    }
    const latest = await this.ownedReadySession(reference, ownerId);
    return this.publicSession(
      latest,
      latest.nextCheckAt.getTime() === claimUntil.getTime() &&
        latest.status === "PENDING" &&
        !latest.cancellationAttemptedAt &&
        canCancel(latest, details),
    );
  }

  async cancel(
    reference: string,
    owner: CardPaymentTestOwner,
  ): Promise<CardPaymentTestSession> {
    this.assertSandboxAccess(owner);
    const row = await this.ownedReadySession(reference, owner.id);
    if (row.cancellationAttemptedAt) return this.publicSession(row);
    if (row.status !== "PENDING" || !withinCancellationWindow(row))
      throw new ConflictException(
        "Sandbox payment is not eligible for cancellation",
      );
    const details = await this.bank.details(row.providerPaymentId);
    if (!canCancel(row, details))
      throw new ConflictException(
        "Sandbox payment is not eligible for cancellation",
      );
    this.assertSandboxAccess(owner);

    // Claim durably before the bank call. A timeout can mean the bank accepted it.
    const attemptedAt = new Date();
    const claim = await this.prisma.cardPaymentSandboxSession.updateMany({
      where: {
        reference,
        status: "PENDING",
        cancellationAttemptedAt: null,
      },
      data: {
        cancellationAttemptedAt: attemptedAt,
        nextCheckAt: attemptedAt,
      },
    });
    if (!claim.count)
      return this.publicSession(
        await this.ownedReadySession(reference, owner.id),
      );

    try {
      await this.bank.cancel(row.providerPaymentId);
    } catch {
      return this.publicSession(
        await this.ownedReadySession(reference, owner.id),
      );
    }
    await this.prisma.cardPaymentSandboxSession.updateMany({
      where: { reference, cancellationAttemptedAt: attemptedAt },
      data: { cancellationAcknowledgedAt: new Date() },
    });
    const readBack = await this.bank
      .details(row.providerPaymentId)
      .catch(() => null);
    if (readBack && confirmsCancellation(row, readBack)) {
      await this.prisma.cardPaymentSandboxSession.updateMany({
        where: {
          reference,
          status: "PENDING",
          cancellationAttemptedAt: attemptedAt,
        },
        data: { status: "CANCELLED" },
      });
    }
    return this.publicSession(
      await this.ownedReadySession(reference, owner.id),
    );
  }

  private assertSandboxAccess(owner: CardPaymentTestOwner): void {
    if (!owner.sandboxAccess || owner.expiresAtMs <= Date.now())
      throw new ForbiddenException("Sandbox access required");
  }

  private async ownedReadySession(reference: string, ownerId: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        reference,
      )
    )
      throw new NotFoundException("Sandbox session not found");
    const row = await this.prisma.cardPaymentSandboxSession.findUnique({
      where: { reference },
    });
    if (!row || row.ownerHash !== hash(ownerId))
      throw new NotFoundException("Sandbox session not found");
    if (row.initialization !== "READY" || !row.providerPaymentId)
      throw new ServiceUnavailableException(
        "Sandbox initialization is unconfirmed",
      );
    return { ...row, providerPaymentId: row.providerPaymentId };
  }

  private checkoutStatus(
    row: CardPaymentSandboxSession,
    details: Record<string, unknown>,
  ): CardPaymentTestSession["status"] {
    // The bank can report no attempt / ACS pending with a non-success response
    // code. Such responses never prove payment or modify a terminal status.
    const orderStatus = /^[0-6]$/.test(String(details.OrderStatus))
      ? Number(details.OrderStatus)
      : -1;
    if ([0, 1, 5].includes(orderStatus) && details.ResponseCode !== "00")
      return "PENDING";
    if (details.ResponseCode !== "00" && orderStatus !== 6)
      throw new ServiceUnavailableException(
        "Sandbox payment details could not be verified",
      );
    if (
      !sameBankPayment(row, details) ||
      (orderStatus === 2 &&
        details.DepositedAmount !== undefined &&
        !bankAmountIs(details.DepositedAmount, 10))
    )
      throw new ServiceUnavailableException(
        "Sandbox payment details could not be verified",
      );
    if (orderStatus === 2 && details.PaymentState === "payment_deposited")
      return "SUCCEEDED";
    if (orderStatus === 6) return "FAILED";
    if (orderStatus === 3 || orderStatus === 4) return "CANCELLED";
    if ([0, 1, 5].includes(orderStatus)) return "PENDING";
    throw new ServiceUnavailableException(
      "Sandbox payment state could not be verified",
    );
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
    cancellationAvailable = false,
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
      ...(row.status === "PENDING" && row.cancellationAttemptedAt
        ? { cancellationStatus: "UNCONFIRMED" }
        : cancellationAvailable
          ? { cancellationStatus: "AVAILABLE" }
          : {}),
      ...(row.providerPaymentId &&
      row.status === "PENDING" &&
      !row.cancellationAttemptedAt &&
      row.expiresAt.getTime() > Date.now()
        ? {
            checkoutUrl: `https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=${encodeURIComponent(row.providerPaymentId)}&lang=${lang}`,
          }
        : {}),
    };
  }
}
