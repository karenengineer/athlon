import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../generated/prisma/client";
import { Locale } from "../generated/prisma/enums";
import { parseLocale, selectTranslation } from "../common/localization/locale";
import { PrismaService } from "../database/prisma.service";
import { AmeriaSandboxClient } from "./ameria-sandbox.client";

export type MockOutcome = "SUCCESS" | "DECLINED" | "CANCELLED" | "TIMEOUT";
export type MockStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type CardPaymentTestMode = "MOCK" | "AMERIA_SANDBOX";

export interface CardPaymentTestSession {
  reference: string;
  mode: CardPaymentTestMode;
  /** Ameriabank sandbox card page; null in mock mode. */
  checkoutUrl: string | null;
  status: MockStatus;
  locale: Locale;
  currency: "AMD";
  total: string;
  items: Array<{
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  expiresAt: string;
}

export interface CreateCardPaymentTestSessionInput {
  locale: string;
  items: Array<{
    productId: string;
    quantity: number;
    expectedUnitPrice: string | null;
  }>;
}

type StoredSession = CardPaymentTestSession & {
  expiresAtMs: number;
  paymentId?: string | undefined;
  orderId?: number | undefined;
  amount?: string | undefined;
};

const SESSION_TTL_MS = 15 * 60 * 1000;
const ORDER_ID_ALLOCATION_ATTEMPTS = 5;
const MAX_SESSIONS = 500;

@Injectable()
export class CardPaymentTestService {
  private readonly sessions = new Map<string, StoredSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sandbox: AmeriaSandboxClient,
  ) {}

  mode(): CardPaymentTestMode {
    return this.config.get<string>("CARD_PAYMENT_TEST_MODE", "MOCK") ===
      "AMERIA_SANDBOX"
      ? "AMERIA_SANDBOX"
      : "MOCK";
  }

  isEnabled(): boolean {
    return (
      this.config.get<boolean>("CARD_PAYMENT_TEST_FLOW_ENABLED", false) === true
    );
  }

  async createSession(
    input: CreateCardPaymentTestSessionInput,
  ): Promise<CardPaymentTestSession> {
    this.assertEnabled();
    if (
      !Array.isArray(input.items) ||
      input.items.length < 1 ||
      input.items.length > 30
    ) {
      throw new ConflictException("A session requires 1 to 30 unique products");
    }
    if (
      input.items.some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 20,
      )
    ) {
      throw new ConflictException("Quantity must be an integer from 1 to 20");
    }
    const ids = input.items.map((item) => item.productId);
    if (new Set(ids).size !== ids.length) {
      throw new ConflictException("Duplicate products are not allowed");
    }

    const locale = parseLocale(input.locale);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, published: true },
      include: { translations: true },
    });
    if (products.length !== ids.length) {
      throw new ConflictException("One or more products cannot be ordered");
    }

    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );
    let total = new Prisma.Decimal(0);
    const items = input.items.map((requested) => {
      const product = productsById.get(requested.productId)!;
      if (!product.published || product.availability === "OUT_OF_STOCK") {
        throw new ConflictException("One or more products are out of stock");
      }
      if (product.currency !== "AMD") {
        throw new ConflictException("Only AMD products are supported");
      }
      if (product.price === null) {
        throw new ConflictException("All products must have a listed price");
      }

      const unitPrice = product.price.toString();
      if (
        requested.expectedUnitPrice == null ||
        !new Prisma.Decimal(requested.expectedUnitPrice).eq(unitPrice)
      ) {
        throw new ConflictException("Basket prices changed. Review the basket");
      }

      const lineTotal = new Prisma.Decimal(unitPrice).mul(requested.quantity);
      total = total.add(lineTotal);
      const translation = selectTranslation(product.translations, locale);
      return {
        productId: product.id,
        sku: product.sku,
        name: translation?.name?.trim() || product.sku,
        quantity: requested.quantity,
        unitPrice,
        lineTotal: lineTotal.toString(),
      };
    });

    this.pruneExpired();
    if (this.sessions.size >= MAX_SESSIONS) {
      throw new ServiceUnavailableException("Too many active mock sessions");
    }

    const now = Date.now();
    const mode = this.mode();
    const reference = crypto.randomUUID();
    const sandboxPayment =
      mode === "AMERIA_SANDBOX"
        ? await this.startSandboxPayment(reference, locale)
        : null;
    const session: StoredSession = {
      reference,
      mode,
      checkoutUrl: sandboxPayment?.checkoutUrl ?? null,
      paymentId: sandboxPayment?.paymentId,
      orderId: sandboxPayment?.orderId,
      amount: sandboxPayment?.amount,
      status: "PENDING",
      locale,
      currency: "AMD",
      total: total.toString(),
      items,
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
      expiresAtMs: now + SESSION_TTL_MS,
    };
    this.sessions.set(session.reference, session);
    return this.toPublicSession(session);
  }

  getSession(reference: string): CardPaymentTestSession {
    this.assertEnabled();
    return this.toPublicSession(this.findSession(reference));
  }

  /**
   * Sandbox mode only: asks the bank for the payment state. A browser redirect
   * is never treated as proof of payment.
   */
  async verifySession(reference: string): Promise<CardPaymentTestSession> {
    this.assertEnabled();
    const session = this.findSession(reference);
    if (session.mode !== "AMERIA_SANDBOX" || !session.paymentId) {
      throw new ConflictException("Session is not an Ameriabank sandbox one");
    }
    if (session.status !== "PENDING") return this.toPublicSession(session);

    const details = await this.sandbox.getPaymentDetails(session.paymentId);
    if (
      details.orderId !== String(session.orderId) ||
      (details.amount !== "" &&
        !new Prisma.Decimal(details.amount).eq(session.amount ?? "0"))
    ) {
      throw new ConflictException("Bank payment does not match this session");
    }
    session.status = this.statusForBank(details.orderStatus);
    return this.toPublicSession(session);
  }

  completeSession(
    reference: string,
    outcome: MockOutcome,
  ): CardPaymentTestSession {
    this.assertEnabled();
    const session = this.findSession(reference);
    if (session.mode !== "MOCK") {
      throw new ConflictException("Outcomes are chosen on the bank's page");
    }
    const finalStatus = this.statusFor(outcome);
    if (session.status !== "PENDING") {
      if (session.status === finalStatus) return this.toPublicSession(session);
      throw new ConflictException(
        "Mock session already has a different outcome",
      );
    }
    session.status = finalStatus;
    return this.toPublicSession(session);
  }

  private findSession(reference: string) {
    const session = this.sessions.get(reference);
    if (!session) throw new NotFoundException("Mock session not found");
    if (session.expiresAtMs <= Date.now()) {
      this.sessions.delete(reference);
      throw new GoneException("Mock session expired");
    }
    return session;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [reference, session] of this.sessions) {
      if (session.expiresAtMs <= now) this.sessions.delete(reference);
    }
  }

  private async startSandboxPayment(
    reference: string,
    locale: Locale,
  ): Promise<{
    paymentId: string;
    orderId: number;
    amount: string;
    checkoutUrl: string;
  }> {
    const backUrlBase = this.config.get<string>("AMERIA_TEST_BACK_URL_BASE");
    if (!backUrlBase) {
      throw new ServiceUnavailableException(
        "Ameriabank sandbox return URL is not configured",
      );
    }
    const lang = locale.toLowerCase() as "hy" | "ru" | "en";
    const amount = String(this.config.get<number>("AMERIA_TEST_AMOUNT", 10));
    const orderId = await this.allocateOrderId(reference);
    const { paymentId } = await this.sandbox.initPayment({
      orderId,
      amount,
      description: `ATHLON card payment test ${orderId}`,
      backUrl: `${backUrlBase.replace(/\/+$/, "")}/card-payment-test/${lang}`,
      opaque: reference,
    });
    return {
      paymentId,
      orderId,
      amount,
      checkoutUrl: this.sandbox.checkoutUrl(paymentId, lang),
    };
  }

  /** The bank refuses reused OrderIDs, so allocation is persisted. */
  private async allocateOrderId(reference: string): Promise<number> {
    const min = this.config.get<number>("AMERIA_TEST_ORDER_ID_MIN", 30543001);
    const max = this.config.get<number>("AMERIA_TEST_ORDER_ID_MAX", 30544000);
    for (let attempt = 0; attempt < ORDER_ID_ALLOCATION_ATTEMPTS; attempt++) {
      const last = await this.prisma.cardPaymentTestOrderId.aggregate({
        _max: { orderId: true },
        where: { orderId: { gte: min, lte: max } },
      });
      const next = (last._max.orderId ?? min - 1) + 1;
      if (next > max) {
        throw new ServiceUnavailableException(
          "The Ameriabank test OrderID range is exhausted",
        );
      }
      try {
        await this.prisma.cardPaymentTestOrderId.create({
          data: { orderId: next, reference },
        });
        return next;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== "P2002") throw error;
      }
    }
    throw new ConflictException("Could not allocate a test OrderID, retry");
  }

  private statusForBank(orderStatus: string): MockStatus {
    switch (orderStatus) {
      case "0":
        return "PENDING";
      case "1":
      case "2":
        return "SUCCEEDED";
      case "3":
        return "CANCELLED";
      default:
        return "FAILED";
    }
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new NotFoundException("Mock payment test flow is disabled");
    }
  }

  private statusFor(outcome: MockOutcome): MockStatus {
    switch (outcome) {
      case "SUCCESS":
        return "SUCCEEDED";
      case "DECLINED":
        return "FAILED";
      case "CANCELLED":
        return "CANCELLED";
      case "TIMEOUT":
        return "EXPIRED";
    }
  }

  private toPublicSession(
    session: CardPaymentTestSession & { expiresAtMs?: number },
  ): CardPaymentTestSession {
    return {
      reference: session.reference,
      mode: session.mode,
      checkoutUrl: session.checkoutUrl,
      status: session.status,
      locale: session.locale,
      currency: session.currency,
      total: session.total,
      items: session.items,
      expiresAt: session.expiresAt,
    };
  }
}
