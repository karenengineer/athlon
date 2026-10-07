import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const AMERIA_PAYMENT_FLOW_READY = false;

@Injectable()
export class AmeriaVposClient {
  constructor(private readonly config: ConfigService) {}

  get configured(): boolean {
    return (
      AMERIA_PAYMENT_FLOW_READY &&
      this.config.get<boolean>("AMERIA_PAYMENTS_ENABLED") === true
    );
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

  initializePayment(order: {
    reference: string;
    total: string;
  }): Promise<{ providerPaymentId: string; checkoutUrl: string }> {
    void order;
    return Promise.reject(
      new ServiceUnavailableException(
        "Ameriabank merchant integration is not verified",
      ),
    );
  }

  getPaymentDetails(paymentId: string): Promise<never> {
    void paymentId;
    return Promise.reject(
      new ServiceUnavailableException(
        "Ameriabank merchant integration is not verified",
      ),
    );
  }
}
