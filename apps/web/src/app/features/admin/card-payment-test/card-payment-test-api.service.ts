import { HttpClient } from "@angular/common/http";
import { inject, Injectable, signal } from "@angular/core";
import { Observable, tap } from "rxjs";
import { API_BASE_URL } from "../../../core/api/api-base-url";
import { Locale } from "../../../core/i18n/i18n.service";

export type MockPaymentOutcome =
  | "SUCCESS"
  | "DECLINED"
  | "CANCELLED"
  | "TIMEOUT";
export type MockPaymentStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export interface MockPaymentSession {
  reference: string;
  mode: "MOCK" | "AMERIA_SANDBOX";
  /** Ameriabank sandbox card page; null in mock mode. */
  checkoutUrl: string | null;
  status: MockPaymentStatus;
  locale: Uppercase<Locale>;
  currency: "AMD";
  total: string;
  items: Array<{
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  expiresAt: string;
}

export interface CardPaymentTestConfig {
  enabled: boolean;
  mode: "MOCK" | "AMERIA_SANDBOX";
}

export interface CreateMockPaymentSessionInput {
  locale: Locale;
  items: Array<{
    productId: string;
    quantity: number;
    expectedUnitPrice: string | null;
  }>;
}

@Injectable({ providedIn: "root" })
export class CardPaymentTestApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly endpoint = `${this.baseUrl}/admin/card-payment-test`;

  /** Mode reported by the last capability lookup (the route guard makes it). */
  readonly mode = signal<CardPaymentTestConfig["mode"]>("MOCK");

  config(): Observable<CardPaymentTestConfig> {
    return this.http
      .get<CardPaymentTestConfig>(`${this.endpoint}/config`)
      .pipe(tap((config) => this.mode.set(config.mode)));
  }

  createSession(
    input: CreateMockPaymentSessionInput,
  ): Observable<MockPaymentSession> {
    return this.http.post<MockPaymentSession>(
      `${this.endpoint}/sessions`,
      input,
    );
  }

  getSession(reference: string): Observable<MockPaymentSession> {
    return this.http.get<MockPaymentSession>(
      `${this.endpoint}/sessions/${encodeURIComponent(reference)}`,
    );
  }

  verifySession(reference: string): Observable<MockPaymentSession> {
    return this.http.post<MockPaymentSession>(
      `${this.endpoint}/sessions/${encodeURIComponent(reference)}/verify`,
      {},
    );
  }

  completeSession(
    reference: string,
    outcome: MockPaymentOutcome,
  ): Observable<MockPaymentSession> {
    return this.http.post<MockPaymentSession>(
      `${this.endpoint}/sessions/${encodeURIComponent(reference)}/outcome`,
      { outcome },
    );
  }
}
