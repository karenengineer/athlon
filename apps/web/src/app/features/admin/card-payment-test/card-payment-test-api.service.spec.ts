import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { provideHttpClient } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";
import {
  CardPaymentTestApiService,
  MockPaymentSession,
} from "./card-payment-test-api.service";

const endpoint = "/api/v1/public/card-payment-test";
const session: MockPaymentSession = {
  reference: "reference/1",
  mode: "MOCK",
  status: "PENDING",
  locale: "HY",
  currency: "AMD",
  total: "24000",
  items: [
    {
      productId: "product-id",
      sku: "SKU1",
      name: "Test Product",
      quantity: 2,
      unitPrice: "12000",
      lineTotal: "24000",
    },
  ],
  expiresAt: "2026-10-14T12:15:00.000Z",
};

describe("CardPaymentTestApiService guest sessions", () => {
  let http: HttpTestingController;
  let api: CardPaymentTestApiService;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(CardPaymentTestApiService);
  });
  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  function authorize(token = "guest-csrf") {
    const request = http.expectOne(`${endpoint}/config`);
    expect(request.request.withCredentials).toBe(true);
    request.flush({ enabled: true, mode: "MOCK", csrfToken: token });
  }

  it("gets guest capability with the owner cookie and retains the CSRF token only in memory", async () => {
    const result = firstValueFrom(api.config());
    authorize();
    await expect(result).resolves.toEqual({
      enabled: true,
      mode: "MOCK",
      csrfToken: "guest-csrf",
    });
    expect(JSON.stringify(Object.values(sessionStorage))).not.toContain(
      "guest-csrf",
    );
    expect(JSON.stringify(Object.values(localStorage))).not.toContain(
      "guest-csrf",
    );
  });

  it("posts basket data with the guest CSRF token and cookie, without customer fields", async () => {
    const input = {
      locale: "hy" as const,
      items: [
        { productId: "product-id", quantity: 2, expectedUnitPrice: "12000" },
      ],
    };
    const result = firstValueFrom(api.createSession(input));
    authorize();
    const request = http.expectOne(`${endpoint}/sessions`);
    expect(request.request.method).toBe("POST");
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get("x-card-payment-test-csrf")).toBe(
      "guest-csrf",
    );
    expect(request.request.headers.has("x-csrf-token")).toBe(false);
    expect(request.request.body).toEqual(input);
    request.flush(session);
    await expect(result).resolves.toEqual(session);
  });

  it("acquires config after reload before reading a guest session and uses its token for outcomes", async () => {
    const read = firstValueFrom(api.getSession("reference/1"));
    authorize("reloaded-token");
    const request = http.expectOne(`${endpoint}/sessions/reference%2F1`);
    expect(request.request.withCredentials).toBe(true);
    request.flush(session);
    await expect(read).resolves.toEqual(session);
    const complete = firstValueFrom(
      api.completeSession("reference/1", "SUCCESS"),
    );
    const outcome = http.expectOne(
      `${endpoint}/sessions/reference%2F1/outcome`,
    );
    expect(outcome.request.withCredentials).toBe(true);
    expect(outcome.request.headers.get("x-card-payment-test-csrf")).toBe(
      "reloaded-token",
    );
    expect(outcome.request.body).toEqual({ outcome: "SUCCESS" });
    outcome.flush({ ...session, status: "SUCCEEDED" });
    await expect(complete).resolves.toMatchObject({ status: "SUCCEEDED" });
  });

  it.each([
    { enabled: false, mode: "MOCK", csrfToken: null },
    { enabled: true, mode: "AMERIA", csrfToken: "guest-csrf" },
    { enabled: true, mode: "MOCK", csrfToken: "" },
  ])(
    "does not create sessions when guest capability is invalid: %s",
    async (config) => {
      const result = firstValueFrom(
        api.createSession({ locale: "hy", items: [] }),
      ).catch(() => "blocked");
      http.expectOne(`${endpoint}/config`).flush(config);
      await expect(result).resolves.toBe("blocked");
      http.expectNone(`${endpoint}/sessions`);
    },
  );

  it("discards a prior CSRF token when a later config request fails", async () => {
    const first = firstValueFrom(api.config());
    authorize();
    await first;
    const failed = firstValueFrom(api.config()).catch(
      (error: { status: number }) => error.status,
    );
    http
      .expectOne(`${endpoint}/config`)
      .flush({}, { status: 403, statusText: "Forbidden" });
    await expect(failed).resolves.toBe(403);
    const read = firstValueFrom(api.getSession("reference/1"));
    authorize("fresh-token");
    http.expectOne(`${endpoint}/sessions/reference%2F1`).flush(session);
    await read;
  });
});
