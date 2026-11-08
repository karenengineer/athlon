import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { AmeriaSandboxClient } from "./ameria-sandbox.client";
import { bankAmountIs, sameBankPayment } from "./card-payment-sandbox.service";
import type { CardPaymentTestSession } from "./card-payment-test.service";

const pageSize = 25;
const firstSandboxOrderId = 30_543_001;
const lastSandboxOrderId = 30_544_000;
const maxPages = Math.ceil(
  (lastSandboxOrderId - firstSandboxOrderId + 1) / pageSize,
);

const paymentFields = {
  reference: true,
  ameriaOrderId: true,
  createdAt: true,
  status: true,
  initialization: true,
  providerPaymentId: true,
  cancellationAttemptedAt: true,
  refundAttemptedAt: true,
  refundedAt: true,
} satisfies Prisma.CardPaymentSandboxSessionSelect;
type SandboxPayment = Prisma.CardPaymentSandboxSessionGetPayload<{
  select: typeof paymentFields;
}>;

export interface AdminSandboxPayment {
  reference: string;
  ameriaOrderId: number;
  createdAt: string;
  status:
    | CardPaymentTestSession["status"]
    | "REFUNDED"
    | "REFUND_UNCONFIRMED"
    | "CANCELLATION_UNCONFIRMED";
  canRefund: boolean;
  canCancel: boolean;
}

function isReadyPayment(
  row: SandboxPayment,
): row is SandboxPayment & { providerPaymentId: string } {
  return (
    row.initialization === "READY" &&
    !!row.providerPaymentId &&
    /^[a-zA-Z0-9-]{1,100}$/.test(row.providerPaymentId) &&
    row.ameriaOrderId >= firstSandboxOrderId &&
    row.ameriaOrderId <= lastSandboxOrderId
  );
}

function isCaptured(
  row: SandboxPayment,
): row is SandboxPayment & { providerPaymentId: string } {
  return (
    isReadyPayment(row) &&
    row.status === "SUCCEEDED" &&
    !row.cancellationAttemptedAt
  );
}

function isCancellationCandidate(
  row: SandboxPayment,
): row is SandboxPayment & { providerPaymentId: string } {
  const age = Date.now() - row.createdAt.getTime();
  return (
    isReadyPayment(row) &&
    (row.status === "PENDING" || row.status === "SUCCEEDED") &&
    !row.cancellationAttemptedAt &&
    !row.refundAttemptedAt &&
    !row.refundedAt &&
    age >= 0 &&
    age < 72 * 60 * 60_000
  );
}

function matchesBankStatus(
  row: SandboxPayment,
  details: Record<string, unknown>,
  orderStatus: 1 | 2 | 3 | 4,
  paymentState:
    | "payment_approved"
    | "payment_deposited"
    | "payment_void"
    | "payment_refunded",
): boolean {
  return (
    sameBankPayment(row, details) &&
    details.ResponseCode === "00" &&
    (details.OrderStatus === orderStatus ||
      details.OrderStatus === String(orderStatus)) &&
    details.PaymentState === paymentState
  );
}

function isFullBankRefund(
  row: SandboxPayment,
  details: Record<string, unknown>,
): boolean {
  return (
    matchesBankStatus(row, details, 4, "payment_refunded") &&
    bankAmountIs(details.RefundedAmount, 10)
  );
}

function isBankCancellationCandidate(
  row: SandboxPayment,
  details: Record<string, unknown>,
): boolean {
  if (!bankAmountIs(details.RefundedAmount, 0)) return false;
  return (
    (matchesBankStatus(row, details, 1, "payment_approved") &&
      bankAmountIs(details.ApprovedAmount, 10) &&
      bankAmountIs(details.DepositedAmount, 0)) ||
    (matchesBankStatus(row, details, 2, "payment_deposited") &&
      bankAmountIs(details.DepositedAmount, 10))
  );
}

function isBankCancellation(
  row: SandboxPayment,
  details: Record<string, unknown>,
): boolean {
  return (
    matchesBankStatus(row, details, 3, "payment_void") &&
    bankAmountIs(details.RefundedAmount, 0) &&
    (bankAmountIs(details.DepositedAmount, 0) ||
      bankAmountIs(details.DepositedAmount, 10))
  );
}

@Injectable()
export class AdminSandboxPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bank: AmeriaSandboxClient,
    private readonly config: ConfigService,
  ) {}

  async list(page: number) {
    if (!Number.isSafeInteger(page) || page < 1 || page > maxPages)
      throw new BadRequestException("Invalid sandbox payments page");

    const rows = await this.prisma.cardPaymentSandboxSession.findMany({
      select: paymentFields,
      orderBy: [{ createdAt: "desc" }, { ameriaOrderId: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });
    const refundsEnabled = this.refundsEnabled();
    return {
      items: rows
        .slice(0, pageSize)
        .map((row) => this.toAdminPayment(row, refundsEnabled)),
      hasNext: rows.length > pageSize,
      refundsEnabled,
    };
  }

  async refund(reference: string): Promise<AdminSandboxPayment> {
    this.assertRefundsEnabled();
    const row = await this.findPayment(reference);
    if (row.refundAttemptedAt || row.refundedAt)
      return this.toAdminPayment(row);
    if (!isCaptured(row)) this.ineligibleRefund();

    const details = await this.bank.details(row.providerPaymentId);
    this.assertRefundsEnabled();
    const unclaimed = {
      reference,
      status: "SUCCEEDED",
      initialization: "READY",
      providerPaymentId: row.providerPaymentId,
      cancellationAttemptedAt: null,
      refundAttemptedAt: null,
      refundedAt: null,
    };
    if (isFullBankRefund(row, details)) {
      // Reconcile a historical refund without recording an admin attempt.
      await this.prisma.cardPaymentSandboxSession.updateMany({
        where: unclaimed,
        data: { refundedAt: new Date() },
      });
      return this.toAdminPayment(await this.findPayment(reference));
    }
    if (
      !matchesBankStatus(row, details, 2, "payment_deposited") ||
      !bankAmountIs(details.DepositedAmount, 10) ||
      !bankAmountIs(details.RefundedAmount, 0)
    )
      this.ineligibleRefund();

    // A refund can be accepted by the bank even when the response is lost.
    const attemptedAt = new Date();
    const claim = await this.prisma.cardPaymentSandboxSession.updateMany({
      where: unclaimed,
      data: { refundAttemptedAt: attemptedAt },
    });
    if (!claim.count)
      return this.toAdminPayment(await this.findPayment(reference));

    try {
      await this.bank.refund(row.providerPaymentId);
    } catch {
      return this.toAdminPayment(await this.findPayment(reference));
    }

    await this.prisma.cardPaymentSandboxSession.updateMany({
      where: { reference, refundAttemptedAt: attemptedAt },
      data: { refundAcknowledgedAt: new Date() },
    });
    return this.reconcile(row, row.providerPaymentId, attemptedAt);
  }

  async cancel(reference: string): Promise<AdminSandboxPayment> {
    this.assertRefundsEnabled();
    const row = await this.findPayment(reference);
    if (row.cancellationAttemptedAt) return this.toAdminPayment(row);
    if (!isCancellationCandidate(row))
      throw new ConflictException(
        "Sandbox payment is not eligible for cancellation",
      );
    const details = await this.bank.details(row.providerPaymentId);
    this.assertRefundsEnabled();
    if (
      !isCancellationCandidate(row) ||
      !isBankCancellationCandidate(row, details)
    )
      throw new ConflictException(
        "Sandbox payment is not eligible for cancellation",
      );

    const attemptedAt = new Date();
    const claim = await this.prisma.cardPaymentSandboxSession.updateMany({
      where: {
        reference,
        status: row.status,
        initialization: "READY",
        providerPaymentId: row.providerPaymentId,
        cancellationAttemptedAt: null,
        refundAttemptedAt: null,
        refundedAt: null,
      },
      data: { cancellationAttemptedAt: attemptedAt, nextCheckAt: attemptedAt },
    });
    if (!claim.count)
      return this.toAdminPayment(await this.findPayment(reference));

    try {
      await this.bank.cancel(row.providerPaymentId);
    } catch {
      return this.toAdminPayment(await this.findPayment(reference));
    }
    await this.prisma.cardPaymentSandboxSession.updateMany({
      where: { reference, cancellationAttemptedAt: attemptedAt },
      data: { cancellationAcknowledgedAt: new Date() },
    });
    return this.reconcileCancellation(row, row.providerPaymentId, attemptedAt);
  }

  async recheck(reference: string): Promise<AdminSandboxPayment> {
    this.assertRefundsEnabled();
    const row = await this.findPayment(reference);
    if (row.cancellationAttemptedAt && isReadyPayment(row)) {
      if (row.status === "CANCELLED") return this.toAdminPayment(row);
      return this.reconcileCancellation(
        row,
        row.providerPaymentId,
        row.cancellationAttemptedAt,
      );
    }
    if (!row.refundAttemptedAt || !isCaptured(row))
      throw new ConflictException("There is no sandbox refund to recheck");
    if (row.refundedAt) return this.toAdminPayment(row);

    return this.reconcile(row, row.providerPaymentId, row.refundAttemptedAt);
  }

  private async reconcile(
    row: SandboxPayment,
    paymentId: string,
    attemptedAt: Date,
  ): Promise<AdminSandboxPayment> {
    const details = await this.bank.details(paymentId).catch(() => null);
    if (details && isFullBankRefund(row, details)) {
      await this.prisma.cardPaymentSandboxSession.updateMany({
        where: {
          reference: row.reference,
          providerPaymentId: paymentId,
          refundAttemptedAt: attemptedAt,
          refundedAt: null,
        },
        data: { refundedAt: new Date() },
      });
    }
    return this.toAdminPayment(await this.findPayment(row.reference));
  }

  private async reconcileCancellation(
    row: SandboxPayment,
    paymentId: string,
    attemptedAt: Date,
  ): Promise<AdminSandboxPayment> {
    const details = await this.bank.details(paymentId).catch(() => null);
    if (details && isBankCancellation(row, details)) {
      await this.prisma.cardPaymentSandboxSession.updateMany({
        where: {
          reference: row.reference,
          providerPaymentId: paymentId,
          status: row.status,
          cancellationAttemptedAt: attemptedAt,
          refundAttemptedAt: null,
          refundedAt: null,
        },
        data: { status: "CANCELLED" },
      });
    }
    return this.toAdminPayment(await this.findPayment(row.reference));
  }

  private async findPayment(reference: string) {
    const row = await this.prisma.cardPaymentSandboxSession.findUnique({
      where: { reference },
      select: paymentFields,
    });
    if (!row) throw new NotFoundException("Sandbox payment not found");
    return row;
  }

  private toAdminPayment(
    row: SandboxPayment,
    refundsEnabled = this.refundsEnabled(),
  ): AdminSandboxPayment {
    const status = row.refundedAt
      ? "REFUNDED"
      : row.cancellationAttemptedAt && row.status !== "CANCELLED"
        ? "CANCELLATION_UNCONFIRMED"
        : row.refundAttemptedAt
          ? "REFUND_UNCONFIRMED"
          : (row.status as CardPaymentTestSession["status"]);
    return {
      reference: row.reference,
      ameriaOrderId: row.ameriaOrderId,
      createdAt: row.createdAt.toISOString(),
      status,
      canRefund: refundsEnabled && status === "SUCCEEDED" && isCaptured(row),
      canCancel: refundsEnabled && isCancellationCandidate(row),
    };
  }

  private refundsEnabled(): boolean {
    return (
      this.config.get<boolean>("CARD_PAYMENT_TEST_FLOW_ENABLED") === true &&
      this.config.get<string>("CARD_PAYMENT_TEST_MODE") === "AMERIA_SANDBOX" &&
      this.config.get<boolean>("AMERIA_PAYMENTS_ENABLED", false) === false
    );
  }

  private assertRefundsEnabled(): void {
    if (!this.refundsEnabled())
      throw new ForbiddenException("Sandbox refunds are disabled");
  }

  private ineligibleRefund(): never {
    throw new ConflictException("Sandbox payment is not eligible for a refund");
  }
}
