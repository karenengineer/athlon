import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OrderEmailMessage } from "./orders.types";

const recipient = "athlonsportgoods@gmail.com";

const emailCopy = {
  hy: {
    subject: "ATHLON-ից նոր պատվեր",
    customerSubject: "Ձեր պատվերը ստացվել է — ATHLON",
    reference: "Պատվերի համար",
    customer: "Հաճախորդ",
    phone: "Հեռախոս",
    address: "Հասցե",
    products: "Ապրանքներ",
    total: "Ընդամենը",
    payment: "Վճարումը՝ պատվերը ստանալիս․ կանխիկ կամ քարտով։",
    askPrice: "Ճշտել գինը",
  },
  ru: {
    subject: "Новый заказ ATHLON",
    customerSubject: "Ваш заказ принят — ATHLON",
    reference: "Номер заказа",
    customer: "Клиент",
    phone: "Телефон",
    address: "Адрес доставки",
    products: "Товары",
    total: "Итого",
    payment: "Оплата при получении заказа — наличными или картой.",
    askPrice: "Уточнить цену",
  },
  en: {
    subject: "New ATHLON order",
    customerSubject: "Your ATHLON order was received",
    reference: "Order reference",
    customer: "Customer",
    phone: "Phone",
    address: "Delivery address",
    products: "Products",
    total: "Total",
    payment: "Pay the courier on delivery by cash or card.",
    askPrice: "Ask for price",
  },
} as const;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const escapes: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return escapes[character] ?? character;
  });
}

function priceText(value: string | null, fallback: string): string {
  if (value === null) return fallback;
  const amount = Number(value);
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)} AMD`;
}

@Injectable()
export class OrderEmailService {
  constructor(private readonly config: ConfigService) {}

  async send(order: OrderEmailMessage, idempotencyKey: string): Promise<void> {
    return this.sendTo(order, recipient, false, idempotencyKey);
  }

  async sendCustomer(
    order: OrderEmailMessage,
    idempotencyKey: string,
  ): Promise<void> {
    return this.sendTo(order, order.customer.email, true, idempotencyKey);
  }

  private async sendTo(
    order: OrderEmailMessage,
    to: string,
    customerConfirmation: boolean,
    idempotencyKey: string,
  ): Promise<void> {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    const from = this.config.get<string>("ORDER_FROM_EMAIL");
    if (!apiKey || !from) {
      throw new ServiceUnavailableException("Order email service unavailable");
    }

    const copy = emailCopy[order.locale];
    const subject = `${customerConfirmation ? copy.customerSubject : copy.subject} · ${order.orderReference}`;
    const productLines = order.items.map(
      (item, index) =>
        `${index + 1}. ${item.name} (${item.sku}) × ${item.quantity} — ${priceText(item.lineTotal, copy.askPrice)}`,
    );
    const total = priceText(order.total, copy.askPrice);
    const text = [
      `${copy.reference}: ${order.orderReference}`,
      `${copy.customer}: ${order.customer.name}`,
      `${copy.phone}: ${order.customer.phone}`,
      `${copy.address}: ${order.customer.address}`,
      "",
      copy.products,
      ...productLines,
      `${copy.total}: ${total}`,
      copy.payment,
    ].join("\n");
    const html = [
      `<h2>${escapeHtml(copy.subject)}</h2>`,
      `<p><strong>${escapeHtml(copy.reference)}:</strong> ${escapeHtml(order.orderReference)}</p>`,
      `<p><strong>${escapeHtml(copy.customer)}:</strong> ${escapeHtml(order.customer.name)}</p>`,
      `<p><strong>${escapeHtml(copy.phone)}:</strong> ${escapeHtml(order.customer.phone)}</p>`,
      `<p><strong>${escapeHtml(copy.address)}:</strong> ${escapeHtml(order.customer.address)}</p>`,
      `<h3>${escapeHtml(copy.products)}</h3>`,
      `<ul>${order.items
        .map(
          (item) =>
            `<li>${escapeHtml(item.name)} (${escapeHtml(item.sku)}) × ${item.quantity} — ${escapeHtml(priceText(item.lineTotal, copy.askPrice))}</li>`,
        )
        .join("")}</ul>`,
      `<p><strong>${escapeHtml(copy.total)}:</strong> ${escapeHtml(total)}</p>`,
      `<p>${escapeHtml(copy.payment)}</p>`,
    ].join("");

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ to: [to], from, subject, text, html }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        throw new Error("Email provider rejected order");
      }
    } catch {
      throw new ServiceUnavailableException("Order email service unavailable");
    }
  }
}
