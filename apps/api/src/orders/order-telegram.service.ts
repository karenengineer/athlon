import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrderEmailMessage } from "./orders.types";

const requestTimeoutMs = 3_000;
const messageLengthLimit = 4_096;

const telegramCopy = {
  hy: {
    heading: "Նոր պատվեր ATHLON-ից",
    reference: "Պատվերի համար",
    customer: "Հաճախորդ",
    phone: "Հեռախոս",
    address: "Առաքման հասցե",
    products: "Ապրանքներ",
    total: "Ընդամենը",
    askPrice: "Ճշտել գինը",
    paidByCard: "✅ Վճարված է քարտով",
  },
  ru: {
    heading: "Новый заказ ATHLON",
    reference: "Номер заказа",
    customer: "Клиент",
    phone: "Телефон",
    address: "Адрес доставки",
    products: "Товары",
    total: "Итого",
    askPrice: "Уточнить цену",
    paidByCard: "✅ Оплачено картой",
  },
  en: {
    heading: "New ATHLON order",
    reference: "Order reference",
    customer: "Customer",
    phone: "Phone",
    address: "Delivery address",
    products: "Products",
    total: "Total",
    askPrice: "Ask for price",
    paidByCard: "✅ Paid by card",
  },
} as const;

@Injectable()
export class OrderTelegramService {
  constructor(private readonly config: ConfigService) {}

  get isEnabled(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  async send(order: OrderEmailMessage): Promise<void> {
    const token = this.botToken;
    const chatId = this.chatId;
    if (!token || !chatId) return;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          redirect: "error",
          signal: AbortSignal.timeout(requestTimeoutMs),
          body: JSON.stringify({
            chat_id: chatId,
            text: formatOrder(order),
            link_preview_options: { is_disabled: true },
          }),
        },
      );
      if (response.ok) {
        const result = (await response.json()) as { ok?: boolean } | null;
        if (result?.ok === true) return;
      } else {
        await response.body?.cancel();
      }
    } catch {
      // The request URL and provider errors can contain the token or order data.
    }
    throw new ServiceUnavailableException("Order Telegram service unavailable");
  }

  private get botToken(): string | undefined {
    return this.config.get<string>("ORDER_TELEGRAM_BOT_TOKEN")?.trim();
  }

  private get chatId(): string | undefined {
    return this.config.get<string>("ORDER_TELEGRAM_CHAT_ID")?.trim();
  }
}

function formatOrder(order: OrderEmailMessage): string {
  const copy = telegramCopy[order.locale];
  const price = (value: string | null) =>
    value === null ? copy.askPrice : `${value} AMD`;
  const header = [
    copy.heading,
    `${copy.reference}: ${order.orderReference}`,
    `${copy.customer}: ${singleLine(order.customer.name)}`,
    `${copy.phone}: ${order.customer.phone}`,
    `${copy.address}: ${singleLine(order.customer.address)}`,
    "",
    copy.products,
  ].join("\n");
  const footer = `\n\n${copy.total}: ${price(order.total)}${
    order.paidByCard ? `\n${copy.paidByCard}` : ""
  }`;
  const lines = order.items.map((item, index) => ({
    prefix: `\n${index + 1}. `,
    name: singleLine(item.name) || item.sku,
    suffix: ` × ${item.quantity} × ${price(item.unitPrice)} = ${price(item.lineTotal)}`,
  }));

  // Checkout bounds the number of items and the customer fields. Reserve
  // space for them and all amounts before shortening any product names.
  const fixedLength = lines.reduce(
    (length, line) => length + line.prefix.length + line.suffix.length,
    header.length + footer.length,
  );
  const nameLength = lines.reduce(
    (length, line) => length + line.name.length,
    0,
  );
  const nameLimit =
    fixedLength + nameLength > messageLengthLimit
      ? Math.floor((messageLengthLimit - fixedLength) / lines.length)
      : Infinity;
  const products = lines
    .map(
      ({ prefix, name, suffix }) =>
        `${prefix}${shorten(name, nameLimit)}${suffix}`,
    )
    .join("");
  return header + products + footer;
}

function singleLine(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function shorten(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return value.slice(0, limit - 1).replace(/[\uD800-\uDBFF]$/u, "") + "…";
}
