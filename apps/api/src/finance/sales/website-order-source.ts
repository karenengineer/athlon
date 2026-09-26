// This boundary is intentionally independent of the current manual-sale flow.
// A future website-order adapter must call it before creating a finance sale.
export type WebsiteOrderStatus =
  | "PENDING"
  | "PAID"
  | "FULFILLED"
  | "CANCELLED"
  | "FAILED";

export function shouldCountWebsiteOrder(status: WebsiteOrderStatus): boolean {
  return status === "PAID" || status === "FULFILLED";
}
