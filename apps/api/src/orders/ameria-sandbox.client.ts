import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface AmeriaSandboxPaymentDetails {
  responseCode: string;
  paymentState: string;
  orderStatus: string;
  orderId: string;
  amount: string;
  opaque: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Admin test-flow client for the Ameriabank vPOS 3.1 sandbox. It only talks to
 * the configured sandbox host and is never used by the public checkout.
 */
@Injectable()
export class AmeriaSandboxClient {
  constructor(private readonly config: ConfigService) {}

  get baseUrl(): string {
    return (
      this.config.get<string>(
        "AMERIA_TEST_API_BASE_URL",
        "https://servicestest.ameriabank.am/VPOS",
      ) ?? ""
    ).replace(/\/+$/, "");
  }

  async initPayment(input: {
    orderId: number;
    amount: string;
    description: string;
    backUrl: string;
    opaque: string;
  }): Promise<{ paymentId: string; checkoutBase: string }> {
    const body = await this.post<{
      PaymentID?: string;
      ResponseCode?: number | string;
      ResponseMessage?: string;
    }>("api/VPOS/InitPayment", {
      ClientID: this.credential("AMERIA_TEST_CLIENT_ID"),
      Username: this.credential("AMERIA_TEST_USERNAME"),
      Password: this.credential("AMERIA_TEST_PASSWORD"),
      Currency: "051",
      Description: input.description,
      OrderID: input.orderId,
      Amount: Number(input.amount),
      BackURL: input.backUrl,
      Opaque: input.opaque,
    });
    if (Number(body.ResponseCode) !== 1 || !body.PaymentID) {
      throw new BadGatewayException(
        `Ameriabank sandbox rejected InitPayment (code ${String(body.ResponseCode)}: ${body.ResponseMessage ?? "no message"})`,
      );
    }
    return { paymentId: body.PaymentID, checkoutBase: this.baseUrl };
  }

  checkoutUrl(paymentId: string, locale: "hy" | "ru" | "en"): string {
    const lang = locale === "hy" ? "am" : locale;
    return `${this.baseUrl}/Payments/Pay?id=${encodeURIComponent(paymentId)}&lang=${lang}`;
  }

  async getPaymentDetails(
    paymentId: string,
  ): Promise<AmeriaSandboxPaymentDetails> {
    const body = await this.post<Record<string, unknown>>(
      "api/VPOS/GetPaymentDetails",
      {
        PaymentID: paymentId,
        Username: this.credential("AMERIA_TEST_USERNAME"),
        Password: this.credential("AMERIA_TEST_PASSWORD"),
      },
    );
    const text = (key: string) => {
      const value = body[key];
      return typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
    };
    return {
      responseCode: text("ResponseCode"),
      paymentState: text("PaymentState"),
      orderStatus: text("OrderStatus"),
      orderId: text("OrderID"),
      amount: text("Amount"),
      opaque: text("Opaque"),
    };
  }

  private credential(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new ServiceUnavailableException(
        "Ameriabank sandbox credentials are not configured",
      );
    }
    return value;
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new BadGatewayException("Ameriabank sandbox is unreachable");
    }
    if (!response.ok) {
      throw new BadGatewayException(
        `Ameriabank sandbox returned HTTP ${response.status}`,
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new BadGatewayException(
        "Ameriabank sandbox returned an unreadable response",
      );
    }
  }
}
