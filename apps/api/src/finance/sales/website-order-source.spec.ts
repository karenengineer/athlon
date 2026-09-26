import { shouldCountWebsiteOrder } from "./website-order-source";

describe("future website order source contract", () => {
  it.each(["CANCELLED", "FAILED", "PENDING"] as const)(
    "does not create a finance sale for %s",
    (status) => expect(shouldCountWebsiteOrder(status)).toBe(false),
  );

  it.each(["PAID", "FULFILLED"] as const)(
    "counts a %s order once its payment is final",
    (status) => expect(shouldCountWebsiteOrder(status)).toBe(true),
  );
});
