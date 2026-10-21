import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { Title } from "@angular/platform-browser";
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { BasketService } from "../../../core/basket/basket.service";
import { CardPaymentTestApiService } from "./card-payment-test-api.service";
import { PaymentSuccessPage } from "./payment-success-page";

const endpoint = "/api/v1/public/card-payment-test";
const paid = {
  reference: "paid-ref",
  mode: "AMERIA_SANDBOX",
  status: "SUCCEEDED",
  locale: "EN",
  currency: "AMD",
  total: "10",
  basketTotal: "24000",
  items: [
    {
      productId: "product-id",
      sku: "SKU",
      name: "Product",
      quantity: 1,
      unitPrice: "24000",
      lineTotal: "24000",
    },
  ],
  expiresAt: "2020-01-01T00:00:00Z",
};

describe("PaymentSuccessPage", () => {
  let http: HttpTestingController;
  let route: {
    snapshot: {
      paramMap: ReturnType<typeof convertToParamMap>;
      queryParamMap: ReturnType<typeof convertToParamMap>;
    };
    parent: {
      snapshot: { paramMap: ReturnType<typeof convertToParamMap> };
      paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
    };
    paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  };
  beforeEach(async () => {
    localStorage.clear();
    route = {
      snapshot: {
        paramMap: convertToParamMap({ reference: "paid-ref" }),
        queryParamMap: convertToParamMap({
          status: "SUCCEEDED",
          responseCode: "00",
        }),
      },
      parent: {
        snapshot: { paramMap: convertToParamMap({ locale: "en" }) },
        paramMap: new BehaviorSubject(convertToParamMap({ locale: "en" })),
      },
      paramMap: new BehaviorSubject(
        convertToParamMap({ reference: "paid-ref" }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [PaymentSuccessPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(BasketService).add(
      {
        id: "product-id",
        sku: "SKU",
        slug: "product",
        name: "Product",
        price: "24000",
        currency: "AMD",
        availability: "IN_STOCK",
        featured: false,
        isNew: false,
        category: { slug: "protein", name: "Protein" },
        brand: null,
        images: [],
        shortDescription: null,
      },
      3,
    );
  });
  afterEach(() => {
    try {
      http.verify();
    } finally {
      vi.restoreAllMocks();
      TestBed.resetTestingModule();
    }
  });
  function create(mode = "AMERIA_SANDBOX") {
    const fixture = TestBed.createComponent(PaymentSuccessPage);
    fixture.detectChanges();
    http.expectOne(`${endpoint}/config`).flush({
      enabled: true,
      mode,
      csrfToken: "test-token",
      accessRequired: false,
    });
    return fixture;
  }
  it("requires independent reads before displaying bank success and settles once across page recreation", () => {
    let fixture = create();
    expect(fixture.nativeElement.querySelector(".ath-receipt")).toBeNull();
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(3);
    http.expectOne(`${endpoint}/sessions/paid-ref`).flush(paid);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("h1").textContent).toContain(
      "Test payment successful",
    );
    expect(
      fixture.nativeElement.querySelector('[role="status"]').textContent,
    ).toContain("bank-confirmed sandbox payment");
    expect(fixture.nativeElement.textContent).toContain(
      "No real order was created",
    );
    expect(
      fixture.nativeElement.querySelector(".ath-amount").textContent,
    ).toContain("10");
    expect(
      fixture.nativeElement.querySelector(".ath-basket b").textContent,
    ).toBe("2");
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(2);
    fixture.destroy();
    fixture = create();
    http.expectOne(`${endpoint}/sessions/paid-ref`).flush(paid);
    fixture.detectChanges();
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(2);
  });
  it("rechecks even a guard-cached configuration and never accepts URL flags", () => {
    TestBed.inject(CardPaymentTestApiService).configuration.set({
      enabled: true,
      mode: "MOCK",
      csrfToken: "old-token",
    });
    const fixture = create();
    http
      .expectOne(`${endpoint}/sessions/paid-ref`)
      .flush({}, { status: 403, statusText: "Forbidden" });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".ath-receipt")).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain("could not verify");
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(3);
  });
  it.each([
    { status: "PENDING" },
    { status: "FAILED" },
    { status: "CANCELLED" },
    { status: "EXPIRED" },
    { reference: "other-ref" },
    { mode: "MOCK" },
    { currency: "USD" },
    { total: "24000" },
    { total: "NaN" },
    { basketTotal: "24001" },
    { items: [] },
    { items: [{ ...paid.items[0], lineTotal: "1" }] },
    { items: [{ ...paid.items[0], quantity: 0 }] },
    { items: [paid.items[0], paid.items[0]] },
  ])("does not claim success or settle unverified session %j", (change) => {
    const fixture = create();
    http
      .expectOne(`${endpoint}/sessions/paid-ref`)
      .flush({ ...paid, ...change });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".ath-receipt")).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain(
      "Test payment successful",
    );
    expect(fixture.nativeElement.querySelector("button")).not.toBeNull();
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(3);
  });
  it("shows simulated mock success and its basket total without a bank-confirmed label", () => {
    const fixture = create("MOCK");
    http
      .expectOne(`${endpoint}/sessions/paid-ref`)
      .flush({ ...paid, mode: "MOCK", total: "24000", basketTotal: undefined });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("simulated");
    expect(fixture.nativeElement.textContent).not.toContain("bank-confirmed");
    expect(
      fixture.nativeElement.querySelector(".ath-amount").textContent,
    ).toContain("24,000");
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(2);
  });
  it("rejects a mock amount that does not equal its item total", () => {
    const fixture = create("MOCK");
    http
      .expectOne(`${endpoint}/sessions/paid-ref`)
      .flush({ ...paid, mode: "MOCK", total: "10" });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".ath-receipt")).toBeNull();
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(3);
  });
  it.each([false, "configuration error"])(
    "leaves payment unverified when configuration is %s",
    (failure) => {
      const fixture = TestBed.createComponent(PaymentSuccessPage);
      fixture.detectChanges();
      const config = http.expectOne(`${endpoint}/config`);
      if (failure === false)
        config.flush({ enabled: false, mode: "MOCK", csrfToken: null });
      else config.flush({}, { status: 503, statusText: "Unavailable" });
      fixture.detectChanges();
      http.expectNone(`${endpoint}/sessions/paid-ref`);
      expect(fixture.nativeElement.querySelector(".ath-receipt")).toBeNull();
      expect(
        fixture.nativeElement.querySelector('[role="alert"]'),
      ).not.toBeNull();
      expect(TestBed.inject(BasketService).totalQuantity()).toBe(3);
    },
  );
  it("cancels a delayed verification when the reused route changes reference and locale", () => {
    const fixture = create();
    const delayed = http.expectOne(`${endpoint}/sessions/paid-ref`);
    route.paramMap.next(convertToParamMap({ reference: "next-ref" }));
    expect(delayed.cancelled).toBe(true);
    const staleConfig = http.expectOne(`${endpoint}/config`);
    route.parent.paramMap.next(convertToParamMap({ locale: "ru" }));
    expect(staleConfig.cancelled).toBe(true);
    http.expectOne(`${endpoint}/config`).flush({
      enabled: true,
      mode: "AMERIA_SANDBOX",
      csrfToken: "test-token",
    });
    http
      .expectOne(`${endpoint}/sessions/next-ref`)
      .flush({ ...paid, reference: "next-ref", status: "PENDING" });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("main").lang).toBe("ru");
    expect(fixture.nativeElement.querySelector(".ath-receipt")).toBeNull();
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(3);
  });
  it("removes previous confirmation immediately on a reused reference change", () => {
    const fixture = create();
    http.expectOne(`${endpoint}/sessions/paid-ref`).flush(paid);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".ath-receipt")).not.toBeNull();
    route.paramMap.next(convertToParamMap({ reference: "unknown-ref" }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".ath-receipt")).toBeNull();
    http.expectOne(`${endpoint}/config`).flush({
      enabled: true,
      mode: "AMERIA_SANDBOX",
      csrfToken: "test-token",
    });
    http
      .expectOne(`${endpoint}/sessions/unknown-ref`)
      .flush({}, { status: 404, statusText: "Not Found" });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".ath-receipt")).toBeNull();
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(2);
  });
  it("keeps confirmed payment visible when basket storage fails and retries only verification/cleanup", () => {
    const fixture = create();
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    http.expectOne(`${endpoint}/sessions/paid-ref`).flush(paid);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("h1").textContent).toContain(
      "Test payment successful",
    );
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain("basket");
    expect(fixture.nativeElement.textContent).not.toContain("Payment failed");
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(3);
    write.mockRestore();
    fixture.nativeElement.querySelector("button").click();
    http
      .expectOne(`${endpoint}/config`)
      .flush({ enabled: true, mode: "AMERIA_SANDBOX", csrfToken: "new-token" });
    http.expectOne(`${endpoint}/sessions/paid-ref`).flush(paid);
    fixture.detectChanges();
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(2);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    http.expectNone((request) => request.method !== "GET");
  });
  it.each(["unavailable", "mismatched", "pending"])(
    "retains previous confirmation honestly after an unverified cleanup retry: %s",
    (result) => {
      const fixture = create();
      const write = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new Error("blocked");
        });
      http.expectOne(`${endpoint}/sessions/paid-ref`).flush(paid);
      fixture.detectChanges();
      write.mockRestore();
      fixture.nativeElement.querySelector("button").click();
      http
        .expectOne(`${endpoint}/config`)
        .flush({
          enabled: true,
          mode: "AMERIA_SANDBOX",
          csrfToken: "test-token",
        });
      const latest = http.expectOne(`${endpoint}/sessions/paid-ref`);
      if (result === "unavailable")
        latest.flush({}, { status: 503, statusText: "Unavailable" });
      else
        latest.flush({
          ...paid,
          ...(result === "mismatched"
            ? { reference: "other-ref" }
            : { status: "PENDING" }),
        });
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector(".ath-receipt"),
      ).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain(
        "previously confirmed",
      );
      expect(fixture.nativeElement.textContent).toContain("Do not pay again");
      expect(fixture.nativeElement.textContent).not.toContain("Payment failed");
      expect(TestBed.inject(BasketService).totalQuantity()).toBe(3);
    },
  );
  it.each([
    ["hy", "Թեստային վճարումը հաջողվեց", "Վերադառնալ գլխավոր"],
    ["ru", "Тестовая оплата прошла успешно", "На главную"],
    ["en", "Test payment successful", "Back to home"],
  ])(
    "localizes semantics, title and home action in %s",
    (locale, heading, action) => {
      route.parent.snapshot.paramMap = convertToParamMap({ locale });
      route.parent.paramMap.next(convertToParamMap({ locale }));
      const fixture = create();
      http
        .expectOne(`${endpoint}/sessions/paid-ref`)
        .flush({ ...paid, locale: locale.toUpperCase() });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector("main").lang).toBe(locale);
      expect(fixture.nativeElement.querySelector("h1").textContent).toBe(
        heading,
      );
      expect(TestBed.inject(Title).getTitle()).toBe(`${heading} | ATHLON`);
      expect(
        fixture.nativeElement.querySelector(".ath-home").getAttribute("href"),
      ).toBe(`/${locale}`);
      expect(
        fixture.nativeElement.querySelector(".ath-home").textContent,
      ).toContain(action);
      expect(fixture.nativeElement.querySelector("input")).toBeNull();
    },
  );
});
