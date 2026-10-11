export type OrderLocale = "hy" | "ru" | "en";
export type OrderPaymentChoice = "CARD" | "CASH_ON_DELIVERY";

export interface OrderEmailItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string | null;
  lineTotal: string | null;
}

export interface OrderEmailMessage {
  orderReference: string;
  locale: OrderLocale;
  customer: { name: string; email: string; phone: string; address: string };
  items: OrderEmailItem[];
  total: string | null;
}

export interface CardPaymentInitialization {
  providerPaymentId: string;
  checkoutUrl: string;
}

export interface CardPaymentInitializer {
  isEnabled: boolean;
  isTrustedCheckoutUrl(checkoutUrl: string): boolean;
  initialize(order: {
    id: string;
    reference: string;
    locale: "HY" | "RU" | "EN";
    currency: string;
    total: { toString(): string } | null;
    paymentAttempts: Array<{ id: string; ameriaOrderId: string }>;
  }): Promise<CardPaymentInitialization>;
  verifyAndApplyStatus(orderReference: string): Promise<{
    orderReference: string;
    paymentStatus: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED";
    locale: "HY" | "RU" | "EN";
  }>;
}

export type OrderSubmissionResult =
  | { kind: "COD_ACCEPTED"; accepted: true; orderReference: string }
  | {
      kind: "CARD_PAYMENT_PENDING";
      accepted: true;
      orderReference: string;
      paymentStatus: "PENDING";
      checkoutUrl: string;
    };
