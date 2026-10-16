import { TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import {
  ActivatedRouteSnapshot,
  Router,
  convertToParamMap,
  provideRouter,
  UrlTree,
} from "@angular/router";
import { firstValueFrom, isObservable } from "rxjs";
import { CardPaymentTestApiService } from "./card-payment-test-api.service";
import { cardPaymentTestGuard } from "./card-payment-test.guard";
import { adminHttpInterceptor } from "../auth/admin-http.interceptor";

describe("cardPaymentTestGuard guest HTTP integration", () => {
  let http: HttpTestingController;
  const configUrl = "/api/v1/public/card-payment-test/config";
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([adminHttpInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    try {
      http.expectNone((request) => request.url.includes("/admin/"));
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  async function runGuard(locale: string): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      cardPaymentTestGuard(
        { paramMap: convertToParamMap({ locale }) } as ActivatedRouteSnapshot,
        { url: `/card-payment-test/${locale}/payment/mock-ref` } as never,
      ),
    );
    return isObservable(result)
      ? (firstValueFrom(result) as Promise<boolean | UrlTree>)
      : (result as boolean | UrlTree);
  }

  it.each(["hy", "ru", "en"])(
    "allows guest MOCK checkout in %s without any admin HTTP calls",
    async (locale) => {
      const result = runGuard(locale);
      const config = http.expectOne(configUrl);
      expect(config.request.withCredentials).toBe(true);
      config.flush({ enabled: true, mode: "MOCK", csrfToken: "guest-token" });
      expect(await result).toBe(true);
      const created = firstValueFrom(
        TestBed.inject(CardPaymentTestApiService).createSession({
          locale: locale as "hy" | "ru" | "en",
          items: [],
        }),
      );
      const request = http.expectOne(
        "/api/v1/public/card-payment-test/sessions",
      );
      expect(request.request.headers.get("x-card-payment-test-csrf")).toBe(
        "guest-token",
      );
      expect(request.request.withCredentials).toBe(true);
      request.flush({
        reference: "mock-ref",
        mode: "MOCK",
        status: "PENDING",
        locale: locale.toUpperCase(),
        currency: "AMD",
        total: "0",
        items: [],
        expiresAt: "2026-10-14T12:15:00.000Z",
      });
      await created;
    },
  );

  it.each(["hy", "ru", "en"])(
    "returns disabled checkout to the regular %s home",
    async (locale) => {
      const result = runGuard(locale);
      http
        .expectOne(configUrl)
        .flush({ enabled: false, mode: "MOCK", csrfToken: null });
      expect(
        TestBed.inject(Router).serializeUrl((await result) as UrlTree),
      ).toBe(`/${locale}`);
    },
  );

  it.each([
    { enabled: true, mode: "AMERIA", csrfToken: "guest-token" },
    { enabled: true, mode: "MOCK", csrfToken: null },
    { enabled: true, mode: "MOCK", csrfToken: "" },
    { enabled: true, mode: "MOCK", csrfToken: "   " },
    { enabled: "true", mode: "MOCK", csrfToken: "guest-token" },
  ])("fails closed to locale home for invalid config: %s", async (response) => {
    const result = runGuard("ru");
    http.expectOne(configUrl).flush(response);
    expect(TestBed.inject(Router).serializeUrl((await result) as UrlTree)).toBe(
      "/ru",
    );
  });

  it.each([401, 403, 503])(
    "returns %s config failures to locale home without an admin refresh or login",
    async (status) => {
      const result = runGuard("en");
      http
        .expectOne(configUrl)
        .flush({}, { status, statusText: "Unavailable" });
      expect(
        TestBed.inject(Router).serializeUrl((await result) as UrlTree),
      ).toBe("/en");
    },
  );

  it("returns unsupported locale to Armenian home before requesting capability", async () => {
    expect(
      TestBed.inject(Router).serializeUrl((await runGuard("fr")) as UrlTree),
    ).toBe("/hy");
    http.expectNone(configUrl);
  });
});
