import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { BasketService } from "../../core/basket/basket.service";
import { BasketPage } from "./basket-page";

const endpoint = "/api/v1/public/card-payment-test";
const checkoutUrl =
  "https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=bank-payment-id&lang=en";
const session = {
  reference: "owner-ref",
  mode: "AMERIA_SANDBOX",
  status: "PENDING",
  locale: "EN",
  currency: "AMD",
  total: "10",
  basketTotal: "24000",
  items: [],
  expiresAt: "2026-10-16T12:00:00Z",
  checkoutUrl,
};

describe("BasketPage Ameriabank sandbox", () => {
  let http: HttpTestingController;
  let route: Record<string, unknown>;
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    route = {
      snapshot: {
        data: { cardPaymentTestMode: true },
        queryParamMap: convertToParamMap({}),
        paramMap: convertToParamMap({}),
      },
      parent: {
        snapshot: { paramMap: convertToParamMap({ locale: "en" }) },
        paramMap: new BehaviorSubject(convertToParamMap({ locale: "en" })),
      },
    };
    await TestBed.configureTestingModule({
      imports: [BasketPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(BasketService).add({
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
    });
  });
  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });
  function create(accessRequired = false, callback = false) {
    if (callback)
      (route["snapshot"] as { queryParamMap: unknown }).queryParamMap =
        convertToParamMap({
          session: "owner-ref",
          responseCode: "00",
          paymentID: "forged-id",
        });
    const fixture = TestBed.createComponent(BasketPage);
    fixture.detectChanges();
    for (const request of http.match(`${endpoint}/config`))
      request.flush({
        enabled: true,
        mode: "AMERIA_SANDBOX",
        csrfToken: "sandbox-csrf",
        accessRequired,
      });
    fixture.detectChanges();
    return fixture;
  }
  function submit(fixture: ReturnType<typeof create>) {
    fixture.componentInstance.customer.name = "Tester";
    fixture.componentInstance.customer.email = "test@example.test";
    fixture.componentInstance.customer.phone = "123";
    fixture.componentInstance.customer.address = "Test";
    fixture.nativeElement
      .querySelector(".order-form")
      .dispatchEvent(new Event("submit", { cancelable: true }));
    return http.expectOne(`${endpoint}/sessions`);
  }
  it("keeps test submission disabled until valid configuration is available", () => {
    const fixture = TestBed.createComponent(BasketPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".order-button").disabled).toBe(
      true,
    );
    http
      .expectOne(`${endpoint}/config`)
      .flush({}, { status: 503, statusText: "Unavailable" });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector(".order-button").disabled).toBe(
      true,
    );
    expect(
      fixture.nativeElement.querySelector('[role="alert"]'),
    ).not.toBeNull();
  });
  it("requires a separate access code, clears it after unlock and shows the fixed AMD 10 sandbox amount", () => {
    const fixture = create(true);
    const input = fixture.nativeElement.querySelector(
      'input[name="sandboxAccess"]',
    ) as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(fixture.nativeElement.textContent).toContain("AMD 10");
    expect(fixture.nativeElement.textContent).toContain("24,000");
    expect(fixture.nativeElement.querySelector(".order-button").disabled).toBe(
      true,
    );
    input.value = "private-test-access";
    input.dispatchEvent(new Event("input"));
    fixture.nativeElement
      .querySelector(".sandbox-access")
      .dispatchEvent(new Event("submit", { cancelable: true }));
    const request = http.expectOne(`${endpoint}/access`);
    expect(request.request.body).toEqual({
      accessToken: "private-test-access",
    });
    expect(request.request.headers.get("x-card-payment-test-csrf")).toBe(
      "sandbox-csrf",
    );
    request.flush({ unlocked: true });
    http.expectOne(`${endpoint}/config`).flush({
      enabled: true,
      mode: "AMERIA_SANDBOX",
      csrfToken: "sandbox-csrf",
      accessRequired: false,
    });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('input[name="sandboxAccess"]'),
    ).toBeNull();
    expect(JSON.stringify(Object.values(sessionStorage))).not.toContain(
      "private-test-access",
    );
  });
  it("creates an idempotent sandbox session and opens only the bank's hosted page, preserving the basket", () => {
    const fixture = create();
    const redirect = vi
      .spyOn(fixture.componentInstance, "redirectToCheckout")
      .mockImplementation(() => {});
    const request = submit(fixture);
    expect(request.request.body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    const key = request.request.body.idempotencyKey;
    request.flush({}, { status: 503, statusText: "Unavailable" });
    const retry = submit(fixture);
    expect(retry.request.body.idempotencyKey).toBe(key);
    retry.flush(session);
    expect(redirect).toHaveBeenCalledWith(checkoutUrl);
    expect(TestBed.inject(BasketService).items()).toHaveLength(1);
  });
  it.each(["customer edit", "component recreation"])(
    "reuses the persisted uncertain sandbox request after %s",
    (change) => {
      let fixture = create();
      const first = submit(fixture);
      const key = first.request.body.idempotencyKey;
      first.flush({}, { status: 503, statusText: "Unavailable" });
      if (change === "customer edit")
        fixture.componentInstance.updateCustomerField("name", "Changed tester");
      else {
        fixture.destroy();
        fixture = create();
      }
      const retry = submit(fixture);
      expect(retry.request.body.idempotencyKey).toBe(key);
      retry.flush({}, { status: 503, statusText: "Unavailable" });
      expect(
        JSON.parse(sessionStorage.getItem("athlon_sandbox_request_v1")!).key,
      ).toBe(key);
    },
  );
  it.each(["corrupt", "unavailable", "unwritable"])(
    "fails closed without another bank request when sandbox session storage is %s",
    (failure) => {
      const fixture = create();
      if (failure === "corrupt")
        sessionStorage.setItem("athlon_sandbox_request_v1", "corrupt-record");
      const spy =
        failure === "unavailable"
          ? vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
              throw new Error("unavailable");
            })
          : failure === "unwritable"
            ? vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw new Error("unwritable");
              })
            : null;
      try {
        fixture.componentInstance.customer.name = "Tester";
        fixture.componentInstance.customer.email = "test@example.test";
        fixture.componentInstance.customer.phone = "123";
        fixture.componentInstance.customer.address = "Test";
        fixture.nativeElement
          .querySelector(".order-form")
          .dispatchEvent(new Event("submit", { cancelable: true }));
        fixture.detectChanges();
        http.expectNone(`${endpoint}/sessions`);
        expect(
          fixture.nativeElement.querySelector(".order-button").disabled,
        ).toBe(true);
        expect(fixture.nativeElement.textContent).toContain(
          "safely retain the payment attempt",
        );
      } finally {
        spy?.mockRestore();
      }
    },
  );
  it("uses a new sandbox request only after the basket changes", () => {
    const fixture = create();
    const first = submit(fixture);
    const key = first.request.body.idempotencyKey;
    first.flush({}, { status: 503, statusText: "Unavailable" });
    fixture.componentInstance.update("product-id", "2");
    const changed = submit(fixture);
    expect(changed.request.body.idempotencyKey).not.toBe(key);
    changed.flush({}, { status: 503, statusText: "Unavailable" });
  });
  it.each([
    "https://evil.test/VPOS/Payments/Pay?id=x&lang=en",
    "https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=x&lang=en&next=evil",
    "https://user@servicestest.ameriabank.am/VPOS/Payments/Pay?id=x&lang=en",
    "https://servicestest.ameriabank.am:8443/VPOS/Payments/Pay?id=x&lang=en",
    "https://servicestest.ameriabank.am:443/VPOS/Payments/Pay?id=x&lang=en",
    "https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=x&id=y&lang=en",
    "https://servicestest.ameriabank.am/VPOS/Payments/Pay?id=x&lang=en#fragment",
  ])("rejects unsafe bank redirect %s", (url) => {
    const fixture = create();
    const redirect = vi.spyOn(fixture.componentInstance, "redirectToCheckout");
    submit(fixture).flush({ ...session, checkoutUrl: url });
    fixture.detectChanges();
    expect(redirect).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]'),
    ).not.toBeNull();
  });
  it("clears a failed access code, preserves the basket and permits a retry", () => {
    const fixture = create(true);
    const input = fixture.nativeElement.querySelector(
      'input[name="sandboxAccess"]',
    ) as HTMLInputElement;
    input.value = "incorrect-access";
    input.dispatchEvent(new Event("input"));
    fixture.nativeElement
      .querySelector(".sandbox-access")
      .dispatchEvent(new Event("submit", { cancelable: true }));
    http
      .expectOne(`${endpoint}/access`)
      .flush({}, { status: 403, statusText: "Forbidden" });
    fixture.detectChanges();
    expect(input.value).toBe("");
    expect(fixture.nativeElement.textContent).toContain(
      "Could not unlock access",
    );
    expect(fixture.nativeElement.querySelector(".order-button").disabled).toBe(
      true,
    );
    expect(TestBed.inject(BasketService).items()).toHaveLength(1);
  });
  it.each([
    ["hy", "Թեստի մուտքի կոդ", "Բացել վճարման թեստը"],
    ["ru", "Код доступа к тесту", "Открыть тест оплаты"],
    ["en", "Test access code", "Unlock payment test"],
  ])("localizes sandbox access and amount for %s", (locale, label, action) => {
    const parent = route["parent"] as {
      paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
    };
    parent.paramMap.next(convertToParamMap({ locale }));
    const fixture = create(true);
    expect(fixture.nativeElement.textContent).toContain(label);
    expect(fixture.nativeElement.textContent).toContain(action);
    expect(fixture.nativeElement.textContent).toContain("AMD 10");
  });
  it.each(["PENDING", "FAILED", "SUCCEEDED", "CANCELLED", "EXPIRED"])(
    "ignores forged callback data and shows only server status %s without clearing the basket",
    (status) => {
      const fixture = create(false, true);
      const navigate = vi.spyOn(TestBed.inject(Router), "navigate");
      expect(fixture.nativeElement.textContent).not.toContain(
        "Payment confirmed by Ameriabank",
      );
      http
        .expectOne(`${endpoint}/sessions/owner-ref`)
        .flush({ ...session, status });
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain(
        status === "PENDING"
          ? "not confirmed yet"
          : status === "SUCCEEDED"
            ? "Payment confirmed by Ameriabank"
            : status === "FAILED"
              ? "Payment failed"
              : status === "CANCELLED"
                ? "Payment was cancelled"
                : "expired",
      );
      expect(TestBed.inject(BasketService).items()).toHaveLength(1);
      expect(text).not.toContain("Your order has been registered");
      if (status === "PENDING" || status === "SUCCEEDED") {
        expect(
          fixture.nativeElement.querySelector(".order-button").disabled,
        ).toBe(true);
      }
      if (status === "PENDING") {
        fixture.nativeElement.querySelector(".sandbox-recheck").click();
        http.expectOne(`${endpoint}/sessions/owner-ref`).flush(session);
      }
      expect(navigate).not.toHaveBeenCalled();
    },
  );
});
