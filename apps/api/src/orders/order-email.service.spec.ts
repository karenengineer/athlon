import { ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrderEmailService } from "./order-email.service";
import { OrderEmailMessage } from "./orders.types";

describe("OrderEmailService", () => {
  const fetchSpy = jest.spyOn(global, "fetch");
  const configGet = jest.fn((key: string) =>
    key === "RESEND_API_KEY" ? "test-secret" : "orders@athlon.example",
  );
  const config = { get: configGet } as unknown as ConfigService;
  const service = new OrderEmailService(config);
  const message: OrderEmailMessage = {
    orderReference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
    locale: "en",
    customer: {
      name: "<img src=x onerror=alert(1)>",
      email: "customer@example.test",
      phone: "+374 91 123456",
      address: "Yerevan, Main St 1",
    },
    items: [
      {
        sku: "SKU1",
        name: "Whey <script>alert(1)</script>",
        quantity: 2,
        unitPrice: "24000",
        lineTotal: "48000",
      },
    ],
    total: "48000",
  };

  beforeEach(() => {
    fetchSpy
      .mockReset()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "email_test_1" }), { status: 200 }),
      );
    configGet.mockClear();
  });

  afterAll(() => fetchSpy.mockRestore());

  it("sends the order to the fixed recipient with escaped customer and product HTML", async () => {
    await service.send(message, "order-notification/notification-1");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toEqual({
      Authorization: "Bearer test-secret",
      "Content-Type": "application/json",
      "Idempotency-Key": "order-notification/notification-1",
    });
    const email = JSON.parse(init.body as string) as {
      to: string[];
      text: string;
      html: string;
    };
    expect(email.to).toEqual(["athlonsportgoods@gmail.com"]);
    expect(email.text).toContain(
      "Pay the courier on delivery by cash or card.",
    );
    expect(email.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(email.html).toContain("Whey &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).not.toContain("<script>");
  });

  it("sends a separate customer confirmation to the validated customer address", async () => {
    await service.sendCustomer(message, "order-notification/notification-2");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const email = JSON.parse(init.body as string) as {
      to: string[];
      subject: string;
    };
    expect(email.to).toEqual(["customer@example.test"]);
    expect(email.subject).toContain("Your ATHLON order was received");
  });

  it("hides provider error details when sending is rejected", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "provider secret detail" }), {
        status: 500,
      }),
    );

    await expect(
      service.send(message, "order-notification/rejected"),
    ).rejects.toMatchObject({
      constructor: ServiceUnavailableException,
      message: "Order email service unavailable",
    });
  });

  it.each([
    ["hy", "Ճշտել գինը"],
    ["ru", "Уточнить цену"],
    ["en", "Ask for price"],
  ] as const)(
    "uses the localized price fallback for %s orders",
    async (locale, fallback) => {
      await service.send(
        {
          ...message,
          locale,
          items: [
            {
              sku: "SKU1",
              name: "Item",
              quantity: 1,
              unitPrice: null,
              lineTotal: null,
            },
          ],
          total: null,
        },
        `order-notification/${locale}`,
      );

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const email = JSON.parse(init.body as string) as {
        text: string;
        html: string;
      };
      expect(email.text.match(new RegExp(fallback, "g"))).toHaveLength(2);
      expect(email.html.match(new RegExp(fallback, "g"))).toHaveLength(2);
    },
  );

  it("maps network and timeout errors to a sanitized unavailable response", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("socket and secret details"));

    await expect(
      service.send(message, "order-notification/network"),
    ).rejects.toMatchObject({
      constructor: ServiceUnavailableException,
      message: "Order email service unavailable",
    });
  });
});
