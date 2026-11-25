import { PaymentStatusResponse } from "../api/catalog.models";
import { BasketService } from "./basket.service";

export const CHECKOUT_IDEMPOTENCY_KEY = "athlon_checkout_idempotency_v1";
export const CHECKOUT_PAYMENT_METHOD_KEY = "athlon_checkout_payment_method_v1";
const liveCheckoutKey = "athlon_live_card_checkout_v1";
const keyPattern = /^[A-Za-z0-9._:-]{8,120}$/;
export const cardOrderReferencePattern = /^ATH-[A-F0-9]{32}$/;

export interface LiveCardCheckout {
  key: string;
  reference: string | null;
  items: Array<{ productId: string; quantity: number }>;
  phase: "pending" | "ready";
}

export function readLiveCardCheckout(): LiveCardCheckout | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.sessionStorage;
    const stored = storage.getItem(liveCheckoutKey);
    if (stored) {
      const checkout = JSON.parse(stored) as Partial<LiveCardCheckout>;
      if (
        checkout &&
        typeof checkout.key === "string" &&
        keyPattern.test(checkout.key) &&
        (checkout.reference === null ||
          (typeof checkout.reference === "string" &&
            cardOrderReferencePattern.test(checkout.reference))) &&
        (checkout.phase === "pending" || checkout.phase === "ready") &&
        Array.isArray(checkout.items) &&
        checkout.items.every(
          (item) =>
            item &&
            typeof item.productId === "string" &&
            item.productId.length > 0 &&
            Number.isSafeInteger(item.quantity) &&
            item.quantity > 0,
        )
      ) {
        return checkout as LiveCardCheckout;
      }
    }
    const key = storage.getItem(CHECKOUT_IDEMPOTENCY_KEY) ?? "";
    if (
      storage.getItem(CHECKOUT_PAYMENT_METHOD_KEY) === "CARD" &&
      keyPattern.test(key)
    ) {
      return { key, reference: null, items: [], phase: "pending" };
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return null;
}

export function saveLiveCardCheckout(checkout: LiveCardCheckout): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(liveCheckoutKey, JSON.stringify(checkout));
    return true;
  } catch {
    return false;
  }
}

export function settleLiveCardCheckout(
  basket: BasketService,
  checkout: LiveCardCheckout,
  reference: string,
): boolean {
  const current = readLiveCardCheckout();
  if (
    current?.key !== checkout.key ||
    current.phase !== "pending" ||
    !cardOrderReferencePattern.test(reference) ||
    (current.reference !== null && current.reference !== reference)
  ) {
    return false;
  }
  if (current.items.length && !basket.settlePayment(reference, current.items)) {
    return false;
  }
  try {
    // Remove the legacy recovery pointer first so it can't revive a settled order.
    if (
      window.sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_KEY) === current.key
    ) {
      window.sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_KEY);
    }
    window.sessionStorage.removeItem(liveCheckoutKey);
    return true;
  } catch {
    return false;
  }
}

/** Forget the tracked card checkout once its payment is confirmed elsewhere. */
export function clearPaidLiveCardCheckout(reference: string): void {
  const current = readLiveCardCheckout();
  if (!current || current.reference !== reference) return;
  try {
    if (
      window.sessionStorage.getItem(CHECKOUT_IDEMPOTENCY_KEY) === current.key
    ) {
      window.sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_KEY);
    }
    window.sessionStorage.removeItem(liveCheckoutKey);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

/**
 * Forget an unfinished card checkout so the next card order starts a fresh
 * bank payment with a new checkout key. The old attempt simply expires.
 */
export function abandonLiveCardCheckout(checkout: LiveCardCheckout): void {
  try {
    const storage = window.sessionStorage;
    if (storage.getItem(CHECKOUT_IDEMPOTENCY_KEY) === checkout.key) {
      storage.removeItem(CHECKOUT_IDEMPOTENCY_KEY);
    }
    storage.removeItem(liveCheckoutKey);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function canRetryCardPayment(response: PaymentStatusResponse): boolean {
  return (
    response.retryAllowed === true &&
    ["FAILED", "CANCELLED", "EXPIRED"].includes(response.paymentStatus)
  );
}

export async function nextCardCheckoutKey(
  checkout: LiveCardCheckout,
): Promise<string> {
  // Tabs cloned from the same checkout must reuse the same successor key.
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${checkout.key}:${checkout.reference}`),
  );
  return `card-retry-${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}
