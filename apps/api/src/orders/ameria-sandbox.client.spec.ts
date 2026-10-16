import { ConfigService } from "@nestjs/config";
import { AmeriaSandboxClient } from "./ameria-sandbox.client";

describe("AmeriaSandboxClient", () => {
  const config = new ConfigService({
    AMERIA_SANDBOX_CLIENT_ID: "fixture-client",
    AMERIA_SANDBOX_USERNAME: "fixture-user",
    AMERIA_SANDBOX_PASSWORD: "fixture-password",
    AMERIA_SANDBOX_RETURN_ORIGIN: "https://athlon.am",
  });
  afterEach(() => jest.restoreAllMocks());

  it("initializes exactly AMD 10 using only the fixed sandbox and canonical return URL", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ResponseCode: 1, PaymentID: "fixture-payment" }),
        ),
      );
    const result = await new AmeriaSandboxClient(config).initialize({
      reference: "reference",
      orderId: 30543001,
      locale: "HY",
    });
    expect(result.checkoutUrl).toBe(
      "https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=fixture-payment&lang=am",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://servicestest.ameriabank.am/VPOS/api/VPOS/InitPayment",
      expect.objectContaining({ redirect: "error", body: expect.any(String) }),
    );
    expect(
      JSON.parse(fetchMock.mock.calls[0]![1]!.body as string),
    ).toMatchObject({
      Amount: 10,
      Currency: "051",
      OrderID: 30543001,
      Opaque: "reference",
      BackURL: "https://athlon.am/card-payment-test/hy?session=reference",
      Timeout: 900,
    });
  });

  it("sanitizes transport failures", async () => {
    jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("secret bank details"));
    await expect(
      new AmeriaSandboxClient(config).details("stored-id"),
    ).rejects.toThrow("Sandbox bank request failed");
  });

  it.each([
    () => new Response("not-json"),
    () => new Response("[]"),
    () => new Response("null"),
    () => new Response("x".repeat(32_769)),
    () => new Response('{"Password":"do-not-expose-fixture"}', { status: 500 }),
    () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://untrusted.test" },
      }),
  ])(
    "rejects invalid bank responses without exposing content",
    async (response) => {
      jest.spyOn(global, "fetch").mockResolvedValue(response());
      await expect(
        new AmeriaSandboxClient(config).details("stored-id"),
      ).rejects.toThrow("Sandbox bank request failed");
    },
  );

  it.each([
    { ResponseCode: "1", PaymentID: "fixture-id" },
    { ResponseCode: 2, PaymentID: "fixture-id" },
    { ResponseCode: 1 },
    { ResponseCode: 1, PaymentID: "https://untrusted.test" },
  ])("refuses an unconfirmed initialization %j", async (response) => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(response)));
    await expect(
      new AmeriaSandboxClient(config).initialize({
        reference: "reference",
        orderId: 30543001,
        locale: "HY",
      }),
    ).rejects.toThrow("Sandbox initialization was not confirmed");
  });
});
