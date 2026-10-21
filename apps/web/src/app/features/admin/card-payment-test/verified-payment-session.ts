import {
  CardPaymentTestConfig,
  MockPaymentSession,
} from "./card-payment-test-api.service";

// The owner-scoped server read is authoritative. These checks prevent malformed
// or mismatched responses from being rendered or used to settle basket items.
export function isVerifiedPaymentSuccess(
  session: MockPaymentSession,
  reference: string,
  config: CardPaymentTestConfig | null,
): boolean {
  if (
    !config ||
    config.enabled !== true ||
    !config.csrfToken?.trim() ||
    !["MOCK", "AMERIA_SANDBOX"].includes(config.mode) ||
    !session ||
    typeof reference !== "string" ||
    !reference.trim() ||
    session.reference !== reference ||
    session.mode !== config.mode ||
    session.status !== "SUCCEEDED" ||
    session.currency !== "AMD" ||
    !Array.isArray(session.items) ||
    session.items.length === 0
  )
    return false;
  const total = money(session.total);
  if (total === null || total <= 0) return false;
  let sum = 0;
  const ids = new Set<string>();
  for (const item of session.items) {
    if (
      !item ||
      typeof item.productId !== "string" ||
      !item.productId.trim() ||
      ids.has(item.productId) ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    )
      return false;
    ids.add(item.productId);
    const unit = money(item.unitPrice);
    const line = money(item.lineTotal);
    if (
      unit === null ||
      unit <= 0 ||
      line === null ||
      !Number.isSafeInteger(unit * item.quantity) ||
      line !== unit * item.quantity
    )
      return false;
    sum += line;
    if (!Number.isSafeInteger(sum)) return false;
  }
  return session.mode === "AMERIA_SANDBOX"
    ? total === 1000 && money(session.basketTotal) === sum
    : total === sum;
}

function money(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value))
    return null;
  const [whole, decimal = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
