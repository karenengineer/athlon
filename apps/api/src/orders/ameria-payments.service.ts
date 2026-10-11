import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { AmeriaVposClient } from "./ameria-vpos.client";
import { CardPaymentInitializer } from "./orders.types";

@Injectable()
export class AmeriaPaymentsService implements CardPaymentInitializer {
  constructor(private readonly client: AmeriaVposClient) {}

  /** Deliberately false until the verified provider contract is implemented. */
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
    if (!this.isEnabled || order.currency !== "AMD" || order.total === null) {
      throw new ServiceUnavailableException(
        "Ameriabank merchant integration is not verified",
      );
    }
    return this.client.initializePayment({
      reference: order.reference,
      total: order.total.toString(),
    });
  }

  verifyAndApplyStatus(orderReference: string): Promise<{
    orderReference: string;
    paymentStatus: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED";
    locale: "HY" | "RU" | "EN";
  }> {
    // The merchant-specific success codes, reference format, and any confirm step are unknown.
    void orderReference;
    return Promise.reject(
      new ServiceUnavailableException(
        "Ameriabank payment verification is not configured",
      ),
    );
  }
}
