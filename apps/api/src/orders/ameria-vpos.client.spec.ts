import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AmeriaVposClient } from "./ameria-vpos.client";

describe("AmeriaVposClient", () => {
  const fetchSpy = jest.spyOn(global, "fetch");
  const config = {
    get: jest.fn((key: string) =>
      key === "AMERIA_PAYMENTS_ENABLED"
        ? false
        : key === "AMERIA_CHECKOUT_BASE_URL"
          ? "https://bank.example.test/checkout"
          : undefined,
    ),
  } as unknown as ConfigService;
  const client = new AmeriaVposClient(config);

  beforeEach(() => fetchSpy.mockReset());
  afterAll(() => fetchSpy.mockRestore());

  it("fails closed without a verified merchant manual and makes no network request", async () => {
    await expect(
      client.initializePayment({
        reference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
        total: "48000",
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not guess payment status or mark a return as paid", async () => {
    await expect(
      client.getPaymentDetails("provider-payment-id"),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("trusts checkout URLs only on the configured HTTPS bank host and path", () => {
    expect(
      client.isTrustedCheckoutUrl(
        "https://bank.example.test/checkout/session/123",
      ),
    ).toBe(true);
    expect(
      client.isTrustedCheckoutUrl("https://evil.example/checkout/session/123"),
    ).toBe(false);
    expect(
      client.isTrustedCheckoutUrl(
        "https://bank.example.test.evil/checkout/123",
      ),
    ).toBe(false);
    expect(
      client.isTrustedCheckoutUrl(
        "https://user@bank.example.test/checkout/123",
      ),
    ).toBe(false);
    expect(
      client.isTrustedCheckoutUrl("https://bank.example.test/elsewhere/123"),
    ).toBe(false);
  });
});
