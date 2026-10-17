import { ConfigService } from "@nestjs/config";
import { AmeriaSandboxClient } from "./ameria-sandbox.client";

const settings: Record<string, string> = {
  AMERIA_TEST_API_BASE_URL: "https://servicestest.ameriabank.am/VPOS/",
  AMERIA_TEST_CLIENT_ID: "client",
  AMERIA_TEST_USERNAME: "user",
  AMERIA_TEST_PASSWORD: "secret",
};

describe("AmeriaSandboxClient", () => {
  const fetchMock = jest.fn();
  let client: AmeriaSandboxClient;

  beforeEach(() => {
    fetchMock.mockReset();
    jest.spyOn(global, "fetch").mockImplementation(fetchMock);
    client = new AmeriaSandboxClient({
      get: (key: string, fallback?: string) => settings[key] ?? fallback,
    } as unknown as ConfigService);
  });

  afterEach(() => jest.restoreAllMocks());

  const respond = (body: unknown, ok = true, status = 200) =>
    fetchMock.mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    });

  it("posts InitPayment to the sandbox in AMD and returns the PaymentID", async () => {
    respond({ PaymentID: "pay-1", ResponseCode: 1, ResponseMessage: "OK" });

    const result = await client.initPayment({
      orderId: 30543001,
      amount: "10",
      description: "test",
      backUrl: "https://athlon.am/card-payment-test/hy",
      opaque: "ref",
    });

    expect(result.paymentId).toBe("pay-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://servicestest.ameriabank.am/VPOS/api/VPOS/InitPayment",
    );
    expect(JSON.parse(init.body)).toEqual({
      ClientID: "client",
      Username: "user",
      Password: "secret",
      Currency: "051",
      Description: "test",
      OrderID: 30543001,
      Amount: 10,
      BackURL: "https://athlon.am/card-payment-test/hy",
      Opaque: "ref",
    });
  });

  it("fails without leaking credentials when the bank rejects the request", async () => {
    respond({ ResponseCode: 20, ResponseMessage: "Incorrect Username" });

    const failure = client
      .initPayment({
        orderId: 1,
        amount: "10",
        description: "t",
        backUrl: "https://athlon.am/x",
        opaque: "r",
      })
      .catch((error: Error) => error);

    const error = await failure;
    expect(error).toMatchObject({ status: 502 });
    expect((error as Error).message).toContain("code 20");
    expect((error as Error).message).not.toContain("secret");
  });

  it("builds the card page link with the bank's language codes", () => {
    expect(client.checkoutUrl("pay 1", "hy")).toBe(
      "https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=pay%201&lang=am",
    );
    expect(client.checkoutUrl("p", "ru")).toContain("lang=ru");
  });

  it("reads payment details", async () => {
    respond({ OrderStatus: "2", OrderID: "30543001", Amount: 10, Opaque: "r" });
    await expect(client.getPaymentDetails("pay-1")).resolves.toMatchObject({
      orderStatus: "2",
      orderId: "30543001",
      amount: "10",
    });
  });

  it("reports an unreachable bank as 502", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    await expect(client.getPaymentDetails("p")).rejects.toMatchObject({
      status: 502,
    });
  });
});
