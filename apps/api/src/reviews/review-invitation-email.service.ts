import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface ReviewInvitationEmail {
  to: string;
  locale: "hy" | "ru" | "en";
  customerName: string;
  orderReference: string;
  productNames: string[];
  reviewUrl: string;
}

const copy = {
  hy: {
    subject: "Ինչպե՞ս եք գնահատում ձեր գնումը — ATHLON",
    greeting: (name: string) => `Բարև ${name},`,
    intro:
      "Շնորհակալություն ATHLON-ից գնումների համար։ Կիսվեք ձեր կարծիքով ձեր գնած ապրանքների մասին․ դա կօգնի այլ հաճախորդներին։",
    order: "Պատվեր",
    action: "Թողնել կարծիք",
    note: "Հղումն անձնական է և վավեր է 60 օր։ Կարծիք կարող են թողնել միայն ապրանքը գնած հաճախորդները։",
  },
  ru: {
    subject: "Как вам покупка? Оставьте отзыв — ATHLON",
    greeting: (name: string) => `Здравствуйте, ${name}!`,
    intro:
      "Спасибо за покупку в ATHLON. Расскажите, как вам товары, — ваш отзыв поможет другим покупателям.",
    order: "Заказ",
    action: "Оставить отзыв",
    note: "Ссылка персональная и действует 60 дней. Отзывы могут оставлять только покупатели товара.",
  },
  en: {
    subject: "How was your order? Leave a review — ATHLON",
    greeting: (name: string) => `Hi ${name},`,
    intro:
      "Thank you for shopping at ATHLON. Tell other customers what you think of the products you bought.",
    order: "Order",
    action: "Leave a review",
    note: "This link is personal and valid for 60 days. Only customers who bought a product can review it.",
  },
} as const;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

@Injectable()
export class ReviewInvitationEmailService {
  constructor(private readonly config: ConfigService) {}

  async send(
    message: ReviewInvitationEmail,
    idempotencyKey: string,
  ): Promise<void> {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    const from = this.config.get<string>("ORDER_FROM_EMAIL");
    if (!apiKey || !from) {
      throw new ServiceUnavailableException("Email service unavailable");
    }
    const text = copy[message.locale];
    const plain = [
      text.greeting(message.customerName),
      "",
      text.intro,
      "",
      `${text.order}: ${message.orderReference}`,
      ...message.productNames.map((name) => `• ${name}`),
      "",
      `${text.action}: ${message.reviewUrl}`,
      "",
      text.note,
    ].join("\n");
    const html = [
      `<p>${escapeHtml(text.greeting(message.customerName))}</p>`,
      `<p>${escapeHtml(text.intro)}</p>`,
      `<p><strong>${escapeHtml(text.order)}:</strong> ${escapeHtml(message.orderReference)}</p>`,
      `<ul>${message.productNames.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>`,
      `<p><a href="${escapeHtml(message.reviewUrl)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#171719;color:#ffffff;font-weight:700;text-decoration:none">${escapeHtml(text.action)}</a></p>`,
      `<p style="color:#66666b;font-size:13px">${escapeHtml(text.note)}</p>`,
    ].join("");
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          to: [message.to],
          from,
          subject: text.subject,
          text: plain,
          html,
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error("Email provider rejected message");
    } catch {
      throw new ServiceUnavailableException("Email service unavailable");
    }
  }
}
