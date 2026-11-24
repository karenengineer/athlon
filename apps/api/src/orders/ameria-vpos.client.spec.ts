import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AmeriaVposClient, ameriaLiveConfigured } from "./ameria-vpos.client";

const reference = "ATH-1234ABCD1234ABCD1234ABCD1234ABCD";
const liveSettings: Record<string, unknown> = {
  AMERIA_PAYMENTS_ENABLED: true,
  AMERIA_API_BASE_URL: "https://bank.example.test/VPOS/",
  AMERIA_CHECKOUT_BASE_URL: "https://bank.example.test/VPOS",
  AMERIA_MERCHANT_ID: "fixture-client-id",
  AMERIA_USERNAME: "fixture-user",
  AMERIA_PASSWORD: "fixture-secret",
  AMERIA_RETURN_ORIGIN: "https://athlon.am",
};

function configWith(overrides: Record<string, unknown> = {}): ConfigService {
  const values = { ...liveSettings, ...overrides };
  return {
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => {
      if (values[key] === undefined) throw new Error(`missing ${key}`);
      return values[key];
    }),
  } as unknown as ConfigService;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const initInput = {
  reference,
  ameriaOrderId: 410000001,
  amount: 13000,
  locale: "HY" as const,
  description: "ATHLON",
};

describe("AmeriaVposClient", () => {
  const fetchSpy = jest.spyOn(global, "fetch");

  beforeEach(() => fetchSpy.mockReset());
  afterAll(() => fetchSpy.mockRestore());

  it("stays disabled and makes no request until every live setting is present", async () => {
    for (const missing of [
      { AMERIA_PAYMENTS_ENABLED: false },
      { AMERIA_PASSWORD: "" },
      { AMERIA_RETURN_ORIGIN: "https://evil.example" },
    ]) {
      const config = configWith(missing);
      const client = new AmeriaVposClient(config);
      expect(ameriaLiveConfigured(config)).toBe(false);
      expect(client.configured).toBe(false);
      await expect(client.initializePayment(initInput)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(client.getPaymentDetails("payment-1")).rejects.toThrow(
        ServiceUnavailableException,
      );
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("initializes a live payment with the real amount, integer OrderID and return page", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ ResponseCode: 1, PaymentID: "abc-123" }),
    );
    const client = new AmeriaVposClient(configWith());

    const result = await client.initializePayment(initInput);

    expect(result).toEqual({
      providerPaymentId: "abc-123",
      checkoutUrl:
        "https://bank.example.test/VPOS/Payments/Pay?id=abc-123&lang=am",
    });
    expect(client.isTrustedCheckoutUrl(result.checkoutUrl)).toBe(true);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://bank.example.test/VPOS/api/VPOS/InitPayment");
    expect(init?.redirect).toBe("error");
    expect(JSON.parse(init?.body as string)).toEqual({
      ClientID: "fixture-client-id",
      Username: "fixture-user",
      Password: "fixture-secret",
      Description: "ATHLON",
      OrderID: 410000001,
      Amount: 13000,
      Currency: "051",
      BackURL: `https://athlon.am/hy/payment/${reference}`,
      Opaque: reference,
      Timeout: 1200,
    });
  });

  it("rejects an unconfirmed initialization or an unsafe payment id", async () => {
    const client = new AmeriaVposClient(configWith());
    for (const body of [
      { ResponseCode: 0, PaymentID: "abc" },
      { ResponseCode: "1", PaymentID: "abc" },
      { ResponseCode: 1, PaymentID: "abc/../../evil" },
      { ResponseCode: 1 },
    ]) {
      fetchSpy.mockResolvedValueOnce(jsonResponse(body));
      await expect(client.initializePayment(initInput)).rejects.toThrow(
        ServiceUnavailableException,
      );
    }
  });

  it("refuses OrderIDs the bank cannot accept and non-positive amounts", async () => {
    const client = new AmeriaVposClient(configWith());
    for (const bad of [
      { ameriaOrderId: 17_600_000_000_001 },
      { ameriaOrderId: 0 },
      { amount: 0 },
    ]) {
      await expect(
        client.initializePayment({ ...initInput, ...bad }),
      ).rejects.toThrow(ServiceUnavailableException);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed on HTTP errors, non-object bodies and oversized responses", async () => {
    const client = new AmeriaVposClient(configWith());
    fetchSpy.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(client.getPaymentDetails("payment-1")).rejects.toThrow(
      "Bank request failed",
    );
    fetchSpy.mockResolvedValueOnce(jsonResponse([1, 2]));
    await expect(client.getPaymentDetails("payment-1")).rejects.toThrow(
      "Bank request failed",
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ pad: "x".repeat(40_000) })),
    );
    await expect(client.getPaymentDetails("payment-1")).rejects.toThrow(
      "Bank request failed",
    );
  });

  it("requires the bank acknowledgement for cancel and refund", async () => {
    const client = new AmeriaVposClient(configWith());
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ResponseCode: "00" }));
    await expect(client.refundPayment("payment-1", 100)).resolves.toBe(
      undefined,
    );
    expect(
      JSON.parse(fetchSpy.mock.calls[0]![1]?.body as string),
    ).toMatchObject({
      PaymentID: "payment-1",
      Amount: 100,
    });
    fetchSpy.mockResolvedValueOnce(jsonResponse({ ResponseCode: "01" }));
    await expect(client.cancelPayment("payment-1")).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("trusts checkout URLs only on the configured HTTPS bank host and path", () => {
    const client = new AmeriaVposClient(
      configWith({
        AMERIA_CHECKOUT_BASE_URL: "https://bank.example.test/checkout",
      }),
    );
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
