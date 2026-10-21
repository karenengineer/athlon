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
import { PaymentSuccessPage } from "../admin/card-payment-test/payment-success-page";

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
      imports: [BasketPage, PaymentSuccessPage],
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
  const legacyKey = "11111111-1111-4111-8111-111111111111";
  function seedAttempt(reference?: string, key = legacyKey) {
    const record = JSON.stringify({
      key,
      fingerprint: JSON.stringify({
        locale: "en",
        items: [
          { productId: "product-id", quantity: 1, expectedUnitPrice: "24000" },
        ],
      }),
      ...(reference ? { reference } : {}),
    });
    sessionStorage.setItem("athlon_sandbox_request_v1", record);
    return record;
  }
  it.each(["FAILED", "CANCELLED", "EXPIRED"])(
    "permits safe same-key recovery after an unbound legacy %s GET return",
    (status) => {
      const retained = seedAttempt();
      const fixture = create(false, true);
      http
        .expectOne(`${endpoint}/sessions/owner-ref`)
        .flush({ ...session, status });
      fixture.detectChanges();
      expect(sessionStorage.getItem("athlon_sandbox_request_v1")).toBe(
        retained,
      );
      expect(
        fixture.nativeElement.querySelector(".order-button").disabled,
      ).toBe(false);
      const replay = submit(fixture);
      expect(replay.request.body.idempotencyKey).toBe(legacyKey);
      replay.flush({ ...session, status });
      fixture.detectChanges();
      expect(sessionStorage.getItem("athlon_sandbox_request_v1")).toBeNull();
      expect(TestBed.inject(BasketService).totalQuantity()).toBe(1);
      expect(fixture.componentInstance.customer.name).toBe("Tester");
      expect(fixture.componentInstance.customer.email).toBe(
        "test@example.test",
      );
      const next = submit(fixture);
      expect(next.request.body.idempotencyKey).not.toBe(legacyKey);
      next.flush({}, { status: 503, statusText: "Unavailable" });
    },
  );
  it.each(["FAILED", "CANCELLED", "EXPIRED"])(
    "recovers a legacy %s replay from the base route and permits a new explicit attempt",
    (status) => {
      seedAttempt();
      const fixture = create();
      const redirect = vi
        .spyOn(fixture.componentInstance, "redirectToCheckout")
        .mockImplementation(() => {});
      const replay = submit(fixture);
      expect(replay.request.body.idempotencyKey).toBe(legacyKey);
      replay.flush({ ...session, status });
      fixture.detectChanges();
      expect(sessionStorage.getItem("athlon_sandbox_request_v1")).toBeNull();
      expect(
        fixture.nativeElement.querySelector(".order-button").disabled,
      ).toBe(false);
      expect(TestBed.inject(BasketService).totalQuantity()).toBe(1);
      expect(redirect).not.toHaveBeenCalled();
      const next = submit(fixture);
      expect(next.request.body.idempotencyKey).not.toBe(legacyKey);
      next.flush({}, { status: 503, statusText: "Unavailable" });
    },
  );
  it.each(["FAILED", "CANCELLED", "EXPIRED"])(
    "preserves a newer bound attempt on an old %s return",
    (status) => {
      const retained = seedAttempt(
        "new-pending-ref",
        "22222222-2222-4222-8222-222222222222",
      );
      const fixture = create(false, true);
      http
        .expectOne(`${endpoint}/sessions/owner-ref`)
        .flush({ ...session, status });
      fixture.detectChanges();
      expect(sessionStorage.getItem("athlon_sandbox_request_v1")).toBe(
        retained,
      );
      expect(TestBed.inject(BasketService).totalQuantity()).toBe(1);
    },
  );
  it.each([
    { currency: "USD" },
    { basketTotal: "1" },
    { items: [] },
    { reference: "" },
    { status: "UNKNOWN" },
  ])("retains an unverified terminal replay key: %j", (change) => {
    const retained = seedAttempt();
    const fixture = create();
    submit(fixture).flush({ ...session, status: "FAILED", ...change });
    expect(sessionStorage.getItem("athlon_sandbox_request_v1")).toBe(retained);
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(1);
  });
  it("does not bind an older in-flight terminal response to a newer request", () => {
    seedAttempt();
    const fixture = create();
    const replay = submit(fixture);
    const newer = seedAttempt(
      "new-pending-ref",
      "22222222-2222-4222-8222-222222222222",
    );
    replay.flush({ ...session, status: "FAILED" });
    expect(sessionStorage.getItem("athlon_sandbox_request_v1")).toBe(newer);
  });
  it("retains a terminal replay key on cleanup storage failure and recovers through the same key after recreation", () => {
    seedAttempt();
    let fixture = create();
    const replay = submit(fixture);
    const remove = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    try {
      replay.flush({ ...session, status: "FAILED" });
    } finally {
      remove.mockRestore();
    }
    fixture.detectChanges();
    expect(fixture.componentInstance.sandboxStorageBlocked()).toBe(true);
    expect(
      JSON.parse(sessionStorage.getItem("athlon_sandbox_request_v1")!).key,
    ).toBe(legacyKey);
    fixture.destroy();
    fixture = create();
    const retry = submit(fixture);
    expect(retry.request.body.idempotencyKey).toBe(legacyKey);
    retry.flush({ ...session, status: "FAILED" });
    expect(sessionStorage.getItem("athlon_sandbox_request_v1")).toBeNull();
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(1);
  });
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
  it("starts a fresh attempt for an identical basket after verified success cleanup and reload", () => {
    const fixture = create();
    vi.spyOn(
      fixture.componentInstance,
      "redirectToCheckout",
    ).mockImplementation(() => {});
    const first = submit(fixture);
    const oldKey = first.request.body.idempotencyKey;
    first.flush(session);
    expect(
      JSON.parse(sessionStorage.getItem("athlon_sandbox_request_v1")!)
        .reference,
    ).toBe("owner-ref");
    fixture.destroy();
    route["paramMap"] = new BehaviorSubject(
      convertToParamMap({ reference: "owner-ref" }),
    );
    const success = TestBed.createComponent(PaymentSuccessPage);
    success.detectChanges();
    http.expectOne(`${endpoint}/config`).flush({
      enabled: true,
      mode: "AMERIA_SANDBOX",
      csrfToken: "sandbox-csrf",
      accessRequired: false,
    });
    http
      .expectOne(`${endpoint}/sessions/owner-ref`)
      .flush({ ...session, status: "SUCCEEDED" });
    success.detectChanges();
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(0);
    expect(sessionStorage.getItem("athlon_sandbox_request_v1")).toBeNull();
    success.destroy();
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
    const nextFixture = create();
    const next = submit(nextFixture);
    expect(next.request.body.idempotencyKey).not.toBe(oldKey);
    next.flush({}, { status: 503, statusText: "Unavailable" });
  });
  it("keeps a pending attempt key and reference across recreation", () => {
    let fixture = create();
    vi.spyOn(
      fixture.componentInstance,
      "redirectToCheckout",
    ).mockImplementation(() => {});
    const first = submit(fixture);
    const key = first.request.body.idempotencyKey;
    first.flush(session);
    expect(
      JSON.parse(sessionStorage.getItem("athlon_sandbox_request_v1")!)
        .reference,
    ).toBe("owner-ref");
    fixture.destroy();
    fixture = create();
    const retry = submit(fixture);
    expect(retry.request.body.idempotencyKey).toBe(key);
    retry.flush({}, { status: 503, statusText: "Unavailable" });
  });
  it("blocks bank handoff if the session reference cannot be persisted and retains the request key", () => {
    const fixture = create();
    const redirect = vi
      .spyOn(fixture.componentInstance, "redirectToCheckout")
      .mockImplementation(() => {});
    const first = submit(fixture);
    const key = first.request.body.idempotencyKey;
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    try {
      first.flush(session);
      fixture.detectChanges();
      expect(redirect).not.toHaveBeenCalled();
      expect(fixture.componentInstance.sandboxStorageBlocked()).toBe(true);
      expect(
        JSON.parse(sessionStorage.getItem("athlon_sandbox_request_v1")!).key,
      ).toBe(key);
    } finally {
      write.mockRestore();
    }
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
  it.each(["PENDING", "FAILED", "CANCELLED", "EXPIRED"])(
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
      if (status === "PENDING") {
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
  it.each(["return", "replay"])(
    "opens verified sandbox success after %s without settling on the basket page",
    (source) => {
      const fixture = create(false, source === "return");
      const navigate = vi
        .spyOn(TestBed.inject(Router), "navigate")
        .mockResolvedValue(true);
      const request =
        source === "return"
          ? http.expectOne(`${endpoint}/sessions/owner-ref`)
          : submit(fixture);
      request.flush({ ...session, status: "SUCCEEDED" });
      if (source === "replay")
        expect(
          JSON.parse(sessionStorage.getItem("athlon_sandbox_request_v1")!)
            .reference,
        ).toBe("owner-ref");
      expect(navigate).toHaveBeenCalledWith(
        ["/card-payment-test", "en", "success", "owner-ref"],
        { replaceUrl: true },
      );
      expect(TestBed.inject(BasketService).totalQuantity()).toBe(1);
    },
  );
  it.each([
    { reference: "different-ref" },
    { mode: "MOCK" },
    { currency: "USD" },
    { total: "24000" },
    { basketTotal: "1" },
    { items: [] },
    { items: [{ ...session.items[0], quantity: -1 }] },
  ])("does not redirect malformed successful return %j", (change) => {
    create(false, true);
    const navigate = vi
      .spyOn(TestBed.inject(Router), "navigate")
      .mockResolvedValue(true);
    http
      .expectOne(`${endpoint}/sessions/owner-ref`)
      .flush({ ...session, status: "SUCCEEDED", ...change });
    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(1);
  });
});
