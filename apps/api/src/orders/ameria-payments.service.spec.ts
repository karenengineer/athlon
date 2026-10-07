import { ServiceUnavailableException } from "@nestjs/common";
import { AmeriaPaymentsService } from "./ameria-payments.service";

describe("AmeriaPaymentsService", () => {
  const initializePayment = jest.fn();
  const getPaymentDetails = jest.fn();
  const client = {
    configured: false,
    initializePayment,
    getPaymentDetails,
    isTrustedCheckoutUrl: jest.fn(() => false),
  };
  const service = new AmeriaPaymentsService(client as never);

  beforeEach(() => {
    initializePayment.mockReset();
    getPaymentDetails.mockReset();
  });

  it("is disabled until the merchant integration contract is verified", async () => {
    expect(service.isEnabled).toBe(false);
    await expect(
      service.initialize({
        id: "order-id",
        reference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
        locale: "HY",
        currency: "AMD",
        total: { toString: () => "48000" },
        paymentAttempts: [{ id: "attempt-id", ameriaOrderId: "1760000000001" }],
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(initializePayment).not.toHaveBeenCalled();
  });

  it("does not apply payment status before the official status contract is known", async () => {
    await expect(
      service.verifyAndApplyStatus("ATH-1234ABCD1234ABCD1234ABCD1234ABCD"),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(getPaymentDetails).not.toHaveBeenCalled();
  });
});
