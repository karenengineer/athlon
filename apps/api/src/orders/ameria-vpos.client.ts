import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** vPOS 3.1 currency code for Armenian dram. */
export const AMERIA_CURRENCY_AMD = "051";
/** Seconds the bank keeps the hosted payment page open (manual maximum: 1200). */
export const AMERIA_PAYMENT_TIMEOUT_SECONDS = 1200;

const PAYMENT_ID_PATTERN = /^[a-zA-Z0-9-]{1,100}$/;
const MAX_RESPONSE_BYTES = 32_768;
const REQUEST_TIMEOUT_MS = 10_000;

type VposMethod =
  | "InitPayment"
  | "GetPaymentDetails"
  | "CancelPayment"
  | "RefundPayment";

export interface AmeriaInitializePaymentInput {
  reference: string;
  ameriaOrderId: number;
  amount: number;
  locale: "HY" | "RU" | "EN";
  description: string;
}

/** True only when card payments are switched on and every live setting exists. */
export function ameriaLiveConfigured(config: ConfigService): boolean {
  const origin = config.get<string>("AMERIA_RETURN_ORIGIN");
  return (
    config.get<boolean>("AMERIA_PAYMENTS_ENABLED") === true &&
    !!config.get<string>("AMERIA_API_BASE_URL") &&
    !!config.get<string>("AMERIA_CHECKOUT_BASE_URL") &&
    !!config.get<string>("AMERIA_MERCHANT_ID") &&
    !!config.get<string>("AMERIA_USERNAME") &&
    !!config.get<string>("AMERIA_PASSWORD") &&
    (origin === "https://athlon.am" || origin === "https://www.athlon.am")
  );
}

/**
 * Live Ameriabank vPOS 3.1 REST client.
 *
 * Every host comes from server-only configuration, credentials never leave the
 * request body, responses are size- and time-bounded, and any transport or
 * parse problem surfaces as one generic error so bank payloads are not logged.
 */
@Injectable()
export class AmeriaVposClient {
  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return ameriaLiveConfigured(this.config);
  }

  isTrustedCheckoutUrl(checkoutUrl: string): boolean {
    const configuredBase = this.config.get<string>("AMERIA_CHECKOUT_BASE_URL");
    if (!configuredBase) return false;
    try {
      const candidate = new URL(checkoutUrl);
      const base = new URL(configuredBase);
      const pathPrefix = base.pathname.endsWith("/")
        ? base.pathname
        : `${base.pathname}/`;
      return (
        candidate.protocol === "https:" &&
        !candidate.username &&
        !candidate.password &&
        candidate.origin === base.origin &&
        (candidate.pathname === base.pathname ||
          candidate.pathname.startsWith(pathPrefix))
      );
    } catch {
      return false;
    }
  }

  /** Storefront page the bank redirects the shopper to. Not proof of payment. */
  returnUrl(locale: "HY" | "RU" | "EN", reference: string): string {
    const origin = this.returnOrigin();
    if (!origin) {
      throw new ServiceUnavailableException("Card payments are unavailable");
    }
    return `${origin}/${locale.toLowerCase()}/payment/${encodeURIComponent(reference)}`;
  }

  async initializePayment(
    input: AmeriaInitializePaymentInput,
  ): Promise<{ providerPaymentId: string; checkoutUrl: string }> {
    this.assertConfigured();
    if (
      !Number.isSafeInteger(input.ameriaOrderId) ||
      input.ameriaOrderId <= 0 ||
      input.ameriaOrderId > 2_147_483_647 ||
      !Number.isFinite(input.amount) ||
      input.amount <= 0
    ) {
      throw new ServiceUnavailableException(
        "Card payment could not be started",
      );
    }
    const response = await this.post("InitPayment", {
      ...this.credentials(),
      ClientID: this.config.getOrThrow<string>("AMERIA_MERCHANT_ID"),
      Description: input.description.slice(0, 120),
      OrderID: input.ameriaOrderId,
      Amount: input.amount,
      Currency: AMERIA_CURRENCY_AMD,
      BackURL: this.returnUrl(input.locale, input.reference),
      Opaque: input.reference,
      Timeout: AMERIA_PAYMENT_TIMEOUT_SECONDS,
    });
    if (
      response.ResponseCode !== 1 ||
      typeof response.PaymentID !== "string" ||
      !PAYMENT_ID_PATTERN.test(response.PaymentID)
    ) {
      throw new ServiceUnavailableException(
        "Card payment initialization was not confirmed",
      );
    }
    const lang = input.locale === "HY" ? "am" : input.locale.toLowerCase();
    const checkoutBase = this.config
      .getOrThrow<string>("AMERIA_CHECKOUT_BASE_URL")
      .replace(/\/+$/, "");
    return {
      providerPaymentId: response.PaymentID,
      checkoutUrl: `${checkoutBase}/Payments/Pay?id=${encodeURIComponent(response.PaymentID)}&lang=${lang}`,
    };
  }

  /** Raw GetPaymentDetails body. Callers must validate every field they rely on. */
  async getPaymentDetails(paymentId: string): Promise<Record<string, unknown>> {
    this.assertConfigured();
    this.assertPaymentId(paymentId);
    return this.post("GetPaymentDetails", {
      ...this.credentials(),
      PaymentID: paymentId,
    });
  }

  /** Void a same-day payment. Used only by the operator during the pilot. */
  async cancelPayment(paymentId: string): Promise<void> {
    this.assertConfigured();
    this.assertPaymentId(paymentId);
    const response = await this.post("CancelPayment", {
      ...this.credentials(),
      PaymentID: paymentId,
    });
    if (response.ResponseCode !== "00") {
      throw new ServiceUnavailableException(
        "Card payment cancellation was not acknowledged",
      );
    }
  }

  /** Refund a deposited payment. Used only by the operator during the pilot. */
  async refundPayment(paymentId: string, amount: number): Promise<void> {
    this.assertConfigured();
    this.assertPaymentId(paymentId);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ServiceUnavailableException("Invalid refund amount");
    }
    const response = await this.post("RefundPayment", {
      ...this.credentials(),
      PaymentID: paymentId,
      Amount: amount,
    });
    if (response.ResponseCode !== "00") {
      throw new ServiceUnavailableException(
        "Card payment refund was not acknowledged",
      );
    }
  }

  private returnOrigin(): string | undefined {
    const origin = this.config.get<string>("AMERIA_RETURN_ORIGIN");
    return origin === "https://athlon.am" || origin === "https://www.athlon.am"
      ? origin
      : undefined;
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException("Card payments are unavailable");
    }
  }

  private assertPaymentId(paymentId: string): void {
    if (!PAYMENT_ID_PATTERN.test(paymentId)) {
      throw new ServiceUnavailableException("Invalid bank payment reference");
    }
  }

  private credentials() {
    return {
      Username: this.config.getOrThrow<string>("AMERIA_USERNAME"),
      Password: this.config.getOrThrow<string>("AMERIA_PASSWORD"),
    };
  }

  private async post(
    method: VposMethod,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const base = this.config
      .getOrThrow<string>("AMERIA_API_BASE_URL")
      .replace(/\/+$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${base}/api/VPOS/${method}`, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok || !response.body) throw new Error();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            throw new Error();
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      const parsed: unknown = JSON.parse(
        Buffer.concat(chunks).toString("utf8"),
      );
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error();
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException("Bank request failed");
    } finally {
      clearTimeout(timer);
    }
  }
}
