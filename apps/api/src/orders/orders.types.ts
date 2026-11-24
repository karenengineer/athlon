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
  /** True only after the bank has confirmed the card payment server-side. */
  paidByCard?: boolean;
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
  verifyAndApplyStatus(orderReference: string): Promise<VerifiedPaymentStatus>;
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

export type CardPaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export interface VerifiedPaymentStatus {
  orderReference: string;
  paymentStatus: CardPaymentStatus;
  locale: "HY" | "RU" | "EN";
  /** Set only on the call that moved the order to PAID. Never sent to clients. */
  newlyPaidOrderId?: string;
}
