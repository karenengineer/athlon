import { ConfigService } from "@nestjs/config";
import { OrderTelegramService } from "./order-telegram.service";
import { OrderEmailMessage } from "./orders.types";

const botToken = "123456:test-token";
const chatId = "-1001234567890";
const message: OrderEmailMessage = {
  orderReference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
  locale: "en",
  customer: {
    name: "Sample <customer>",
    email: "customer@example.test",
    phone: "+374 91 123456",
    address: "Sample address",
  },
  items: [
    {
      sku: "SKU1",
      name: "Whey & Creatine",
      quantity: 2,
      unitPrice: "24000.25",
      lineTotal: "48000.50",
    },
  ],
  total: "48000.50",
};

describe("OrderTelegramService", () => {
  const fetchSpy = jest.spyOn(global, "fetch");
  const service = new OrderTelegramService(
    new ConfigService({
      ORDER_TELEGRAM_BOT_TOKEN: botToken,
      ORDER_TELEGRAM_CHAT_ID: chatId,
    }),
  );

  beforeEach(() => {
    fetchSpy
      .mockReset()
      .mockImplementation(() => Promise.resolve(Response.json({ ok: true })));
  });

  afterAll(() => fetchSpy.mockRestore());

  function requestBody() {
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    return {
      url,
      init,
      payload: JSON.parse(init.body as string) as {
        chat_id: string;
        text: string;
        parse_mode?: string;
        link_preview_options?: { is_disabled: boolean };
      },
    };
  }

  it("posts localized plain text to the configured chat over HTTPS", async () => {
    expect(service.isEnabled).toBe(true);
    await service.send(message);

    const { url, init, payload } = requestBody();
    expect(url).toBe(`https://api.telegram.org/bot${botToken}/sendMessage`);
    expect(init).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
    });
    expect(payload.chat_id).toBe(chatId);
    expect(payload.parse_mode).toBeUndefined();
    expect(payload.link_preview_options).toEqual({ is_disabled: true });
    for (const field of [
      message.orderReference,
      message.customer.name,
      message.customer.phone,
      message.customer.address,
      "Whey & Creatine",
      "× 2",
      "24000.25 AMD",
      "48000.50 AMD",
      "Total: 48000.50 AMD",
    ]) {
      expect(payload.text).toContain(field);
    }
    expect(payload.text).not.toContain(message.customer.email);
  });

  it.each([
    ["", ""],
    [botToken, ""],
    ["", chatId],
  ])(
    "skips delivery when either order setting is empty",
    async (token, chat) => {
      const disabled = new OrderTelegramService(
        new ConfigService({
          ORDER_TELEGRAM_BOT_TOKEN: token,
          ORDER_TELEGRAM_CHAT_ID: chat,
          TELEGRAM_BOT_TOKEN: botToken,
          TELEGRAM_CHAT_ID: chatId,
        }),
      );

      expect(disabled.isEnabled).toBe(false);
      await disabled.send(message);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["HTTP rejection", () => Response.json({ ok: true }, { status: 500 })],
    [
      "API rejection",
      () => Response.json({ ok: false, description: botToken }),
    ],
    ["invalid success payload", () => Response.json(null)],
    ["invalid JSON", () => new Response(botToken)],
  ] as const)("sanitizes %s", async (_description, response) => {
    fetchSpy.mockResolvedValueOnce(response());

    const delivery = service.send(message);
    await expect(delivery).rejects.toThrow(
      "Order Telegram service unavailable",
    );
    await expect(delivery).rejects.not.toHaveProperty("cause");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("aborts requests within a bounded deadline and sanitizes timeout errors", async () => {
    const controller = new AbortController();
    const timeout = jest
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);
    try {
      fetchSpy.mockImplementationOnce(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new Error(botToken)),
            );
          }),
      );
      const delivery = service.send(message);
      const deadline = timeout.mock.calls[0]?.[0];
      expect(deadline).toBeGreaterThan(0);
      expect(deadline).toBeLessThanOrEqual(5_000);
      expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
      controller.abort();
      await expect(delivery).rejects.toThrow(
        "Order Telegram service unavailable",
      );
    } finally {
      timeout.mockRestore();
    }
  });

  it("fits a long Armenian basket into one message with every price and quantity", async () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      sku: `SKU${index}`,
      name: `Ապրանք ${index + 1} ${"🛒".repeat(200)}`,
      quantity: 20,
      unitPrice: `${1000000000 + index}.25`,
      lineTotal: `${20000000000 + index * 20}.00`,
    }));
    const address = "📍".repeat(300);
    const name = "Ա".repeat(120);
    await service.send({
      ...message,
      locale: "hy",
      customer: { ...message.customer, name, address },
      items,
      total: "600000008700.00",
    });

    const { text } = requestBody().payload;
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text).not.toMatch(/[\uD800-\uDFFF]/u);
    expect(text).toContain(name);
    expect(text).toContain(address);
    expect(text).toContain("Ընդամենը: 600000008700.00 AMD");
    for (const [index, item] of items.entries()) {
      const line = text
        .split("\n")
        .find((line) => line.startsWith(`${index + 1}. `));
      expect(line).toContain(`Ապրանք ${index + 1} `);
      expect(line).toContain("× 20");
      expect(line).toContain(`${item.unitPrice} AMD`);
      expect(line).toContain(`${item.lineTotal} AMD`);
    }
  });

  it("localizes missing prices and totals in Russian", async () => {
    await service.send({
      ...message,
      locale: "ru",
      items: [{ ...message.items[0]!, unitPrice: null, lineTotal: null }],
      total: null,
    });

    const { text } = requestBody().payload;
    expect(text).toContain("Товары");
    expect(text).toContain("Итого: Уточнить цену");
    expect(text.match(/Уточнить цену/g)).toHaveLength(3);
  });
});
