import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AmeriaSandboxClient {
  constructor(private readonly config: ConfigService) {}
  async initialize(input: {
    reference: string;
    orderId: number;
    locale: string;
    timeoutSeconds?: number;
  }): Promise<{ paymentId: string; checkoutUrl: string }> {
    if (
      this.config.get<string>("AMERIA_SANDBOX_RETURN_ORIGIN") !==
      "https://athlon.am"
    )
      throw new ServiceUnavailableException(
        "Sandbox return origin is not configured",
      );
    const response = await this.post("InitPayment", {
      ...this.credentials(),
      ClientID: this.config.getOrThrow<string>("AMERIA_SANDBOX_CLIENT_ID"),
      Description: "ATHLON sandbox payment test",
      Currency: "051",
      OrderID: input.orderId,
      Amount: 10,
      BackURL: `https://athlon.am/card-payment-test/${input.locale.toLowerCase()}?session=${encodeURIComponent(input.reference)}`,
      Opaque: input.reference,
      Timeout: Math.min(900, input.timeoutSeconds ?? 900),
    });
    if (
      response.ResponseCode !== 1 ||
      typeof response.PaymentID !== "string" ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(response.PaymentID)
    )
      throw new ServiceUnavailableException(
        "Sandbox initialization was not confirmed",
      );
    const lang = input.locale === "HY" ? "am" : input.locale.toLowerCase();
    return {
      paymentId: response.PaymentID,
      checkoutUrl: `https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=${encodeURIComponent(response.PaymentID)}&lang=${lang}`,
    };
  }
  details(paymentId: string): Promise<Record<string, unknown>> {
    return this.post("GetPaymentDetails", {
      ...this.credentials(),
      PaymentID: paymentId,
    });
  }
  private credentials() {
    return {
      Username: this.config.getOrThrow<string>("AMERIA_SANDBOX_USERNAME"),
      Password: this.config.getOrThrow<string>("AMERIA_SANDBOX_PASSWORD"),
    };
  }
  private async post(
    method: "InitPayment" | "GetPaymentDetails",
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(
        `https://servicestest.ameriabank.am/VPOS/api/VPOS/${method}`,
        {
          method: "POST",
          redirect: "error",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok || !response.body) throw new Error();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 32_768) {
            await reader.cancel();
            throw new Error();
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      const parsed: unknown = JSON.parse(
        Buffer.concat(chunks).toString("utf8"),
      );
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error();
      return parsed as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException("Sandbox bank request failed");
    } finally {
      clearTimeout(timer);
    }
  }
}
