import { HttpClient } from "@angular/common/http";
import { inject, Injectable, signal } from "@angular/core";
import { defer, Observable, of, switchMap, tap, throwError } from "rxjs";
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
  status: MockPaymentStatus;
  locale: Uppercase<Locale>;
  currency: "AMD";
  total: string;
  basketTotal?: string;
  checkoutUrl?: string;
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
  csrfToken: string | null;
  accessRequired?: boolean;
}

export interface CreateMockPaymentSessionInput {
  idempotencyKey?: string;
  locale: Locale;
  items: Array<{
    productId: string;
    quantity: number;
    expectedUnitPrice: string | null;
  }>;
}

@Injectable({ providedIn: "root" })
export class CardPaymentTestApiService {
  readonly configuration = signal<CardPaymentTestConfig | null>(null);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly endpoint = `${this.baseUrl}/public/card-payment-test`;
  private csrfToken: string | null = null;

  config(): Observable<CardPaymentTestConfig> {
    return defer(() => {
      this.csrfToken = null;
      this.configuration.set(null);
      return this.http
        .get<CardPaymentTestConfig>(`${this.endpoint}/config`, {
          withCredentials: true,
        })
        .pipe(
          tap((config) => {
            this.configuration.set(config);
            if (
              config.enabled === true &&
              (config.mode === "MOCK" || config.mode === "AMERIA_SANDBOX") &&
              typeof config.csrfToken === "string" &&
              config.csrfToken.trim()
            ) {
              this.csrfToken = config.csrfToken;
            }
          }),
        );
    });
  }

  unlockAccess(accessToken: string): Observable<{ unlocked: true }> {
    return this.withGuestSession((token) =>
      this.http.post<{ unlocked: true }>(
        `${this.endpoint}/access`,
        { accessToken },
        {
          withCredentials: true,
          headers: { "x-card-payment-test-csrf": token },
        },
      ),
    );
  }

  createSession(
    input: CreateMockPaymentSessionInput,
  ): Observable<MockPaymentSession> {
    return this.withGuestSession((token) =>
      this.http.post<MockPaymentSession>(`${this.endpoint}/sessions`, input, {
        withCredentials: true,
        headers: { "x-card-payment-test-csrf": token },
      }),
    );
  }

  getSession(reference: string): Observable<MockPaymentSession> {
    return this.withGuestSession(() =>
      this.http.get<MockPaymentSession>(
        `${this.endpoint}/sessions/${encodeURIComponent(reference)}`,
        { withCredentials: true },
      ),
    );
  }

  completeSession(
    reference: string,
    outcome: MockPaymentOutcome,
  ): Observable<MockPaymentSession> {
    return this.withGuestSession((token) =>
      this.http.post<MockPaymentSession>(
        `${this.endpoint}/sessions/${encodeURIComponent(reference)}/outcome`,
        { outcome },
        {
          withCredentials: true,
          headers: { "x-card-payment-test-csrf": token },
        },
      ),
    );
  }

  private withGuestSession<T>(
    request: (token: string) => Observable<T>,
  ): Observable<T> {
    return defer(() => (this.csrfToken ? of(null) : this.config())).pipe(
      switchMap(() =>
        this.csrfToken
          ? request(this.csrfToken)
          : throwError(() => new Error("Guest mock checkout is unavailable")),
      ),
    );
  }
}
