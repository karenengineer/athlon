import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import {
  AMERIA_CURRENCY_AMD,
  AMERIA_PAYMENT_TIMEOUT_SECONDS,
  AmeriaVposClient,
} from "./ameria-vpos.client";
import { OrderPersistenceService } from "./order-persistence.service";
import {
  CardPaymentInitializer,
  CardPaymentStatus,
  VerifiedPaymentStatus,
} from "./orders.types";

/** After the hosted page times out, wait this long before treating a still
 * "started" payment as expired. The bank remains the source of truth: a late
 * deposit still moves the order to PAID. */
const EXPIRY_GRACE_MS = 10 * 60_000;
export const PAYMENT_EXPIRES_AFTER_MS =
  AMERIA_PAYMENT_TIMEOUT_SECONDS * 1000 + EXPIRY_GRACE_MS;

type BankVerdict =
  | { status: Exclude<CardPaymentStatus, "PENDING">; providerStatus: string }
  | { status: "PENDING" };

@Injectable()
export class AmeriaPaymentsService implements CardPaymentInitializer {
  private readonly logger = new Logger(AmeriaPaymentsService.name);

  constructor(
    private readonly client: AmeriaVposClient,
    private readonly persistence: OrderPersistenceService,
  ) {}

  /** False unless AMERIA_PAYMENTS_ENABLED and every live setting is present. */
  get isEnabled(): boolean {
    return this.client.configured;
  }

  isTrustedCheckoutUrl(checkoutUrl: string): boolean {
    return this.client.isTrustedCheckoutUrl(checkoutUrl);
  }

  async initialize(order: {
    id: string;
    reference: string;
    locale: "HY" | "RU" | "EN";
    currency: string;
    total: { toString(): string } | null;
    paymentAttempts: Array<{ id: string; ameriaOrderId: string }>;
  }): Promise<{ providerPaymentId: string; checkoutUrl: string }> {
    const attempt = order.paymentAttempts[0];
    if (
      !this.isEnabled ||
      order.currency !== "AMD" ||
      order.total === null ||
      !attempt ||
      !/^[1-9]\d{0,9}$/.test(attempt.ameriaOrderId)
    ) {
      throw new ServiceUnavailableException("Card payments are unavailable");
    }
    const amount = new Prisma.Decimal(order.total.toString());
    if (amount.lte(0) || !amount.isInteger()) {
      // AMD card amounts are whole drams; never round a customer's total.
      throw new ServiceUnavailableException("Card payments are unavailable");
    }
    return this.client.initializePayment({
      reference: order.reference,
      ameriaOrderId: Number(attempt.ameriaOrderId),
      amount: amount.toNumber(),
      locale: order.locale,
      description: `ATHLON order ${order.reference}`,
    });
  }

  /**
   * Ask the bank for the payment state and apply it. A browser returning to the
   * site proves nothing: only GetPaymentDetails that matches this exact order,
   * amount, currency and reference can mark it paid.
   */
  async verifyAndApplyStatus(
    orderReference: string,
  ): Promise<VerifiedPaymentStatus> {
    if (!this.isEnabled) {
      throw new ServiceUnavailableException("Card payments are unavailable");
    }
    const order =
      await this.persistence.findCardOrderForVerification(orderReference);
    const attempt = order?.paymentAttempts[0];
    if (!order || order.paymentMethod !== "CARD" || !attempt) {
      throw new NotFoundException("Order not found");
    }
    const result = (
      paymentStatus: CardPaymentStatus,
      newlyPaidOrderId?: string,
      retryAllowed = false,
    ): VerifiedPaymentStatus => ({
      orderReference: order.reference,
      paymentStatus,
      locale: order.locale,
      ...(newlyPaidOrderId ? { newlyPaidOrderId } : {}),
      ...(retryAllowed ? { retryAllowed: true } : {}),
    });

    if (!attempt.providerPaymentId) return result(attempt.status);

    let details: Record<string, unknown>;
    try {
      details = await this.client.getPaymentDetails(attempt.providerPaymentId);
    } catch {
      // Bank unreachable: report what we already know, never guess.
      return result(attempt.status);
    }

    const verdict = interpretPaymentDetails(details, {
      reference: order.reference,
      ameriaOrderId: attempt.ameriaOrderId,
      expectedAmount: attempt.expectedAmount.toString(),
      createdAt: attempt.createdAt,
      now: new Date(),
    });
    if (verdict.status === "PENDING") return result(attempt.status);

    const { changed } = await this.persistence.applyVerifiedPaymentStatus({
      orderId: order.id,
      paymentAttemptId: attempt.id,
      status: verdict.status,
      providerStatus: verdict.providerStatus,
    });
    if (changed) {
      this.logger.log(
        `Card payment ${order.reference} verified as ${verdict.status}`,
      );
    }
    // EXPIRED may be a local timeout, and a refund means the order was paid.
    // Only a fresh, matching decline or void without a deposit permits retry.
    if (
      ((verdict.status === "FAILED" &&
        verdict.providerStatus === "payment_declined") ||
        (verdict.status === "CANCELLED" &&
          verdict.providerStatus === "payment_void")) &&
      details.PaymentState === verdict.providerStatus &&
      attempt.status !== "PAID" &&
      (details.DepositedAmount == null ||
        amountEquals(details.DepositedAmount, "0"))
    ) {
      // The PAID transition records payment-confirmation intents atomically.
      // A later void must not hide a deposit that won a concurrent update.
      const retryAllowed = await this.persistence.hasVerifiedUnpaidAttempt({
        orderId: order.id,
        paymentAttemptId: attempt.id,
        status: verdict.status,
        providerStatus: verdict.providerStatus,
      });
      if (retryAllowed) return result(verdict.status, undefined, true);
      if (!changed) {
        const latest = (
          await this.persistence.findCardOrderForVerification(orderReference)
        )?.paymentAttempts[0];
        if (latest?.id === attempt.id) return result(latest.status);
      }
    }
    const current = changed ? verdict.status : attempt.status;
    return result(
      current,
      changed && verdict.status === "PAID" ? order.id : undefined,
    );
  }
}

/**
 * Map a GetPaymentDetails body to a status, failing safe to PENDING whenever
 * anything does not match the attempt exactly.
 *
 * vPOS 3.1 OrderStatus: 0 started, 1 approved (pre-auth), 2 deposited,
 * 3 void, 4 refunded, 5 auto-authorized, 6 declined. ATHLON uses single-stage
 * payments, so only 2 with the full deposited amount counts as PAID.
 */
export function interpretPaymentDetails(
  details: Record<string, unknown>,
  attempt: {
    reference: string;
    ameriaOrderId: string;
    expectedAmount: string;
    createdAt: Date;
    now: Date;
  },
): BankVerdict {
  const expired =
    attempt.now.getTime() - attempt.createdAt.getTime() >
    PAYMENT_EXPIRES_AFTER_MS;
  const sameOrder =
    details.Currency === AMERIA_CURRENCY_AMD &&
    String(details.OrderID) === attempt.ameriaOrderId &&
    details.Opaque === attempt.reference &&
    amountEquals(details.Amount, attempt.expectedAmount);
  const orderStatus = String(details.OrderStatus);

  // A declined card (wrong CVV, insufficient funds, ...) is reported with
  // OrderStatus 6 and the decline reason as ResponseCode, never "00". It moves
  // no money, so it can fail the attempt without a success response code.
  if (sameOrder && orderStatus === "6") {
    return { status: "FAILED", providerStatus: "payment_declined" };
  }
  if (!sameOrder || details.ResponseCode !== "00") {
    return expired
      ? { status: "EXPIRED", providerStatus: "NOT_CONFIRMED_BEFORE_TIMEOUT" }
      : { status: "PENDING" };
  }

  switch (orderStatus) {
    case "2":
      return amountEquals(details.DepositedAmount, attempt.expectedAmount) &&
        details.PaymentState === "payment_deposited"
        ? { status: "PAID", providerStatus: "payment_deposited" }
        : { status: "PENDING" };
    case "3":
      return { status: "CANCELLED", providerStatus: "payment_void" };
    case "4":
      return { status: "CANCELLED", providerStatus: "payment_refunded" };
    case "0":
      return expired
        ? { status: "EXPIRED", providerStatus: "payment_started_timeout" }
        : { status: "PENDING" };
    default:
      // 1 (pre-auth) and 5 (auto-authorized) are not money in the account for
      // a single-stage merchant; keep waiting and let the operator decide.
      return { status: "PENDING" };
  }
}

function amountEquals(value: unknown, expected: string): boolean {
  if (typeof value !== "number" && typeof value !== "string") return false;
  if (typeof value === "string" && !/^\d+(\.\d+)?$/.test(value.trim())) {
    return false;
  }
  try {
    return new Prisma.Decimal(value).eq(expected);
  } catch {
    return false;
  }
}
