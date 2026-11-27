import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { Component, input, output } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from "@angular/router";
import { vi } from "vitest";
import { BehaviorSubject } from "rxjs";
import { Product } from "../../core/api/catalog.models";
import { BasketService } from "../../core/basket/basket.service";
import { BasketPage } from "./basket-page";
import { BasketSuggestions } from "./basket-suggestions";

@Component({ selector: "app-basket-suggestions", template: "" })
class BasketSuggestionsStub {
  readonly disabled = input(false);
  readonly addProduct = output<Product>();
}

function addBasketProduct(basket: BasketService): void {
  basket.add({
    id: "4ebeb944-3503-47a2-9843-d37f1eb34768",
    sku: "SKU1",
    slug: "test-product",
    name: "Test Product",
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
}

const basketRouteStub = {
  snapshot: {
    data: {} as Record<string, unknown>,
    paramMap: convertToParamMap({ locale: "hy" }),
    queryParamMap: convertToParamMap({}),
  },
  parent: {
    snapshot: { paramMap: convertToParamMap({ locale: "hy" }) },
    paramMap: new BehaviorSubject(convertToParamMap({ locale: "hy" })),
  },
};

function useCardPaymentTestRoute(session?: string): void {
  basketRouteStub.snapshot.data = { cardPaymentTestMode: true };
  basketRouteStub.snapshot.paramMap = convertToParamMap({ locale: "en" });
  basketRouteStub.snapshot.queryParamMap = convertToParamMap(
    session ? { session } : {},
  );
  basketRouteStub.parent.snapshot.paramMap = convertToParamMap({
    locale: "en",
  });
  basketRouteStub.parent.paramMap.next(convertToParamMap({ locale: "en" }));
}

function createBasketFixture(cardPaymentsEnabled = true, testSession?: string) {
  const testMode = arguments.length > 1;
  if (testMode) useCardPaymentTestRoute(testSession);
  const basket = TestBed.inject(BasketService);
  addBasketProduct(basket);
  const fixture = TestBed.createComponent(BasketPage);
  fixture.detectChanges();
  if (!testMode) flushSettings(cardPaymentsEnabled);
  else if (!testSession)
    TestBed.inject(HttpTestingController)
      .expectOne("/api/v1/public/card-payment-test/config")
      .flush({ enabled: true, mode: "MOCK", csrfToken: "guest-token" });
  fixture.detectChanges();
  return { fixture, basket };
}

function flushSettings(cardPaymentsEnabled: boolean): void {
  httpSettings().flush({ cardPaymentsEnabled });
}

function httpSettings() {
  return TestBed.inject(HttpTestingController).expectOne((request) =>
    request.url.endsWith("/public/settings"),
  );
}

function fillOrderForm(
  form: HTMLFormElement,
  fields: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    deliveryAddress: string;
  },
): void {
  for (const [name, value] of Object.entries(fields)) {
    const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  acceptPrivacy(form);
}

function acceptPrivacy(form: HTMLFormElement, accepted = true): void {
  const consent = form.querySelector<HTMLInputElement>("#order-privacy")!;
  consent.checked = accepted;
  consent.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("BasketPage", () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    basketRouteStub.snapshot.data = {};
    basketRouteStub.snapshot.paramMap = convertToParamMap({ locale: "hy" });
    basketRouteStub.snapshot.queryParamMap = convertToParamMap({});
    basketRouteStub.parent.snapshot.paramMap = convertToParamMap({
      locale: "hy",
    });
    basketRouteStub.parent.paramMap.next(convertToParamMap({ locale: "hy" }));
    TestBed.overrideComponent(BasketPage, {
      remove: { imports: [BasketSuggestions] },
      add: { imports: [BasketSuggestionsStub] },
    });
    await TestBed.configureTestingModule({
      imports: [BasketPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: basketRouteStub },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      localStorage.clear();
      sessionStorage.clear();
    }
  });

  it("keeps quantity and remove controls on one row", () => {
    const basket = TestBed.inject(BasketService);
    basket.add({
      id: "product-1",
      sku: "SKU1",
      slug: "test-product",
      name: "Test Product",
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

    const fixture = TestBed.createComponent(BasketPage);
    fixture.detectChanges();
    flushSettings(false);
    fixture.detectChanges();

    const controls = fixture.nativeElement.querySelector(
      ".basket-item-actions",
    );

    expect(controls).not.toBeNull();
    expect(getComputedStyle(controls).display).toBe("flex");
    expect(controls.querySelector(".quantity-field")).not.toBeNull();
    expect(controls.querySelector(".stepper-input")).not.toBeNull();
  });

  it("changes quantity with the − and + stepper and keeps it at least 1", () => {
    const basket = TestBed.inject(BasketService);
    basket.add({
      id: "product-1",
      sku: "SKU1",
      slug: "test-product",
      name: "Test Product",
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
    const fixture = TestBed.createComponent(BasketPage);
    fixture.detectChanges();
    flushSettings(false);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const minus = () =>
      el.querySelector<HTMLButtonElement>('[data-testid="basket-decrement"]')!;
    const plus = () =>
      el.querySelector<HTMLButtonElement>('[data-testid="basket-increment"]')!;
    const input = () => el.querySelector<HTMLInputElement>(".stepper-input")!;

    expect(minus().disabled).toBe(true);
    plus().click();
    fixture.detectChanges();
    expect(basket.items()[0]!.quantity).toBe(2);
    expect(input().value).toBe("2");

    input().value = "7";
    input().dispatchEvent(new Event("change"));
    fixture.detectChanges();
    expect(basket.items()[0]!.quantity).toBe(7);

    input().value = "0";
    input().dispatchEvent(new Event("change"));
    fixture.detectChanges();
    expect(basket.items()[0]!.quantity).toBe(7);
    expect(input().value).toBe("7");

    minus().click();
    fixture.detectChanges();
    expect(basket.items()[0]!.quantity).toBe(6);
  });

  it("shows continue shopping as a centered white button", () => {
    const fixture = TestBed.createComponent(BasketPage);
    fixture.detectChanges();
    flushSettings(false);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(".continue-shopping");
    const style = getComputedStyle(link);

    expect(link).not.toBeNull();
    expect(style.display).toBe("inline-flex");
    expect(style.alignItems).toBe("center");
    expect(style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(style.color).toBe("rgb(23, 23, 25)");
  });

  it("shows the checkout form instead of the former Instagram order handoff", () => {
    const { fixture } = createBasketFixture();
    expect(fixture.nativeElement.querySelector("form")).not.toBeNull();
  });

  it("shows an isolated mock banner and a card-only option without public settings", () => {
    const { fixture } = createBasketFixture(false, undefined);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("TEST / MOCK");
    expect(fixture.nativeElement.textContent).toContain("no card is charged");
    expect(
      fixture.nativeElement.querySelector("[data-testid=card-only-payment]"),
    ).toBeNull();
    http.expectNone((request) => request.url.endsWith("/public/settings"));
  });

  it.each(["PENDING", "SUCCEEDED"])(
    "opens the correct mock destination for a created %s session without customer data",
    (status) => {
      const { fixture, basket } = createBasketFixture(false, undefined);
      const form = fixture.nativeElement.querySelector(
        "form",
      ) as HTMLFormElement;
      fillOrderForm(form, {
        customerName: "Ani Private",
        customerEmail: "ani@example.com",
        customerPhone: "+374 91 123456",
        deliveryAddress: "Private address",
      });
      const navigate = vi.spyOn(TestBed.inject(Router), "navigate");

      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      const request = http.expectOne(
        "/api/v1/public/card-payment-test/sessions",
      );
      expect(request.request.body).toEqual({
        locale: "en",
        items: [
          {
            productId: "4ebeb944-3503-47a2-9843-d37f1eb34768",
            quantity: 1,
            expectedUnitPrice: "24000",
          },
        ],
      });
      expect(JSON.stringify(request.request.body)).not.toContain(
        "ani@example.com",
      );
      expect(JSON.stringify(request.request.body)).not.toContain(
        "Private address",
      );
      request.flush({
        reference: "mock-ref",
        mode: "MOCK",
        status,
        locale: "EN",
        currency: "AMD",
        total: "24000",
        items: [
          {
            productId: "4ebeb944-3503-47a2-9843-d37f1eb34768",
            sku: "SKU1",
            name: "Test Product",
            quantity: 1,
            unitPrice: "24000",
            lineTotal: "24000",
          },
        ],
        expiresAt: "2020-01-01T00:00:00Z",
      });

      if (status === "SUCCEEDED")
        expect(navigate).toHaveBeenCalledWith(
          ["/card-payment-test", "en", "success", "mock-ref"],
          { replaceUrl: true },
        );
      else
        expect(navigate).toHaveBeenCalledWith([
          "/card-payment-test",
          "en",
          "payment",
          "mock-ref",
        ]);
      expect(basket.items()).toHaveLength(1);
      expect(sessionStorage.getItem("athlon_checkout_customer_v1")).toBeNull();
    },
  );

  it("keeps mock customer input in memory without reading or changing ordinary checkout drafts", () => {
    const draft = JSON.stringify({
      name: "Ordinary Buyer",
      email: "buyer@example.test",
      phone: "+37400000000",
      address: "Ordinary delivery",
    });
    sessionStorage.setItem("athlon_checkout_customer_v1", draft);
    sessionStorage.setItem(
      "athlon_checkout_idempotency_v1",
      "existing-order-key",
    );
    sessionStorage.setItem(
      "athlon_checkout_payment_method_v1",
      "CASH_ON_DELIVERY",
    );
    const read = vi.spyOn(Storage.prototype, "getItem");
    const { fixture } = createBasketFixture(false, undefined);
    expect(fixture.componentInstance.customer).toEqual({
      name: "",
      email: "",
      phone: "",
      address: "",
    });
    expect(read.mock.calls.map(([key]) => key)).not.toContain(
      "athlon_checkout_customer_v1",
    );
    expect(read.mock.calls.map(([key]) => key)).not.toContain(
      "athlon_checkout_idempotency_v1",
    );
    expect(read.mock.calls.map(([key]) => key)).not.toContain(
      "athlon_checkout_payment_method_v1",
    );
    read.mockRestore();
    fixture.componentInstance.updateCustomerField("email", "mock@example.test");
    fixture.componentInstance.update(
      "4ebeb944-3503-47a2-9843-d37f1eb34768",
      "2",
    );
    expect(fixture.componentInstance.customer.email).toBe("mock@example.test");
    expect(sessionStorage.getItem("athlon_checkout_customer_v1")).toBe(draft);
    expect(sessionStorage.getItem("athlon_checkout_idempotency_v1")).toBe(
      "existing-order-key",
    );
    expect(sessionStorage.getItem("athlon_checkout_payment_method_v1")).toBe(
      "CASH_ON_DELIVERY",
    );
  });

  it.each([
    [
      "SUCCEEDED",
      "Payment simulation succeeded. No order was placed; the basket is preserved.",
    ],
    [
      "FAILED",
      "Decline simulated. No order was placed; the basket is preserved.",
    ],
    [
      "CANCELLED",
      "Cancellation simulated. No order was placed; the basket is preserved.",
    ],
    [
      "EXPIRED",
      "Timeout simulated. No order was placed; the basket is preserved.",
    ],
  ] as const)(
    "verifies returned %s status from the server and preserves checkout state",
    (status, message) => {
      sessionStorage.setItem(
        "athlon_checkout_customer_v1",
        JSON.stringify({
          name: "Ani Private",
          email: "ani@example.com",
          phone: "+374 91 123456",
          address: "Private address",
        }),
      );
      const { fixture, basket } = createBasketFixture(false, "mock-ref");
      const navigate = vi.spyOn(TestBed.inject(Router), "navigate");
      http
        .expectOne("/api/v1/public/card-payment-test/config")
        .flush({ enabled: true, mode: "MOCK", csrfToken: "guest-token" });
      const resultRequest = http.expectOne(
        "/api/v1/public/card-payment-test/sessions/mock-ref",
      );
      resultRequest.flush({
        reference: "mock-ref",
        mode: "MOCK",
        status,
        locale: "EN",
        currency: "AMD",
        total: "24000",
        items: [
          {
            productId: "4ebeb944-3503-47a2-9843-d37f1eb34768",
            sku: "SKU1",
            name: "Test Product",
            quantity: 1,
            unitPrice: "24000",
            lineTotal: "24000",
          },
        ],
        expiresAt: "2026-10-11T12:15:00.000Z",
      });
      fixture.detectChanges();

      if (status !== "SUCCEEDED")
        expect(fixture.nativeElement.textContent).toContain(message);
      expect(basket.items()).toHaveLength(1);
      expect(sessionStorage.getItem("athlon_checkout_customer_v1")).toContain(
        "ani@example.com",
      );
      if (status !== "SUCCEEDED")
        expect(
          fixture.nativeElement.querySelector('[role="status"]'),
        ).not.toBeNull();
      if (status === "SUCCEEDED")
        expect(navigate).toHaveBeenCalledWith(
          ["/card-payment-test", "en", "success", "mock-ref"],
          { replaceUrl: true },
        );
      else
        expect(navigate).toHaveBeenCalledWith([], {
          relativeTo: TestBed.inject(ActivatedRoute),
          queryParams: { session: null },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
    },
  );

  it("blocks ordering while offline and keeps the basket", () => {
    const { fixture, basket } = createBasketFixture();
    const component = fixture.componentInstance;
    component.i18n.setLocale("en");
    component.online.set(false);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const form = element.querySelector("form") as HTMLFormElement;

    expect(
      element.querySelector("[data-testid=order-offline]")?.textContent,
    ).toContain("You're offline");
    expect(
      element.querySelector<HTMLButtonElement>(".order-button")?.disabled,
    ).toBe(true);
    fillOrderForm(form, {
      customerName: "Ani",
      customerEmail: "ani@example.com",
      customerPhone: "+374 91 123456",
      deliveryAddress: "Yerevan",
    });
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    http.expectNone((request) => request.url.endsWith("/public/orders"));
    expect(basket.items()).toHaveLength(1);

    component.online.set(true);
    fixture.detectChanges();
    expect(element.querySelector("[data-testid=order-offline]")).toBeNull();
  });

  it("offers only online card payment, with no pay-on-delivery choice", () => {
    const { fixture } = createBasketFixture();
    fixture.componentInstance.i18n.setLocale("en");
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(
      element.querySelectorAll('input[name="paymentMethod"]'),
    ).toHaveLength(0);
    expect(element.querySelector("[data-testid=card-only-payment]")).toBeNull();
    expect(element.textContent).toContain("on the bank's secure page");
    const alternatives = element.querySelector(
      "[data-testid=order-alternatives]",
    )!;
    expect(alternatives.textContent?.replace(/\s+/g, " ")).toContain(
      "You can also order by calling 041 44 88 55 or by messaging us on Instagram.",
    );
    expect(
      alternatives.querySelector('a[href="tel:+37441448855"]'),
    ).not.toBeNull();
    expect(
      alternatives
        .querySelector('a[href*="instagram.com"]')
        ?.getAttribute("rel"),
    ).toContain("noopener");
    expect(element.textContent).not.toMatch(/on delivery|courier/i);
  });

  it("blocks online ordering and explains alternatives while card payments are off", () => {
    const { fixture } = createBasketFixture(false);
    fixture.componentInstance.i18n.setLocale("en");
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const form = element.querySelector("form") as HTMLFormElement;

    expect(
      element.querySelector(".payment-unavailable")?.textContent,
    ).toContain("Online payment is temporarily unavailable");
    expect(
      element.querySelector<HTMLButtonElement>(".order-button")?.disabled,
    ).toBe(true);
    fillOrderForm(form, {
      customerName: "Ani",
      customerEmail: "ani@example.com",
      customerPhone: "+374 91 123456",
      deliveryAddress: "Yerevan",
    });
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    http.expectNone((request) => request.url.endsWith("/public/orders"));
  });

  it("requires name, email, phone, and delivery address before placing an order", () => {
    const { fixture } = createBasketFixture();
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;

    expect(
      form.querySelector<HTMLInputElement>('[name="customerName"]')?.required,
    ).toBe(true);
    expect(
      form.querySelector<HTMLInputElement>('[name="customerEmail"]')?.required,
    ).toBe(true);
    expect(
      form.querySelector<HTMLInputElement>('[name="customerPhone"]')?.required,
    ).toBe(true);
    expect(
      form.querySelector<HTMLInputElement>('[name="deliveryAddress"]')
        ?.required,
    ).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    const nameInput = form.querySelector<HTMLInputElement>("#order-name")!;
    expect(nameInput.getAttribute("aria-describedby")).toBeNull();

    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    expect(nameInput.getAttribute("aria-describedby")).toBe("order-name-error");
    expect(form.querySelector("#order-name-error")).not.toBeNull();
    expect(
      form
        .querySelector<HTMLInputElement>("#order-email")
        ?.getAttribute("aria-describedby"),
    ).toBe("order-email-error");
  });

  it("redirects only for a pending card response and preserves the basket", () => {
    const { fixture, basket } = createBasketFixture(true);
    const component = fixture.componentInstance;
    component.i18n.setLocale("en");
    const redirect = vi.spyOn(component, "redirectToCheckout");
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
      customerEmail: "ani@example.com",
      customerPhone: "+374 91 123456",
      deliveryAddress: "Yerevan",
    });
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );

    const req = http.expectOne((request) =>
      request.url.endsWith("/public/orders"),
    );
    expect(req.request.body.paymentMethod).toBe("CARD");
    expect(sessionStorage.getItem("athlon_live_card_checkout_v1")).toContain(
      req.request.headers.get("Idempotency-Key"),
    );
    req.flush({
      kind: "CARD_PAYMENT_PENDING",
      accepted: true,
      orderReference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
      paymentStatus: "PENDING",
      checkoutUrl: "https://bank.example.test/checkout/1",
    });
    fixture.detectChanges();

    expect(redirect).toHaveBeenCalledWith(
      "https://bank.example.test/checkout/1",
    );
    expect(basket.items()).toHaveLength(1);
    expect(sessionStorage.getItem("athlon_live_card_checkout_v1")).toContain(
      "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
    );
  });

  it("drops an unfinished card payment on Back and unlocks checkout with a new key", () => {
    sessionStorage.setItem("athlon_checkout_payment_method_v1", "CARD");
    sessionStorage.setItem(
      "athlon_checkout_idempotency_v1",
      "ab00beef-0000-4000-8a00-ab00beef0000",
    );
    const { fixture, basket } = createBasketFixture(true);
    const navigate = vi.spyOn(TestBed.inject(Router), "navigate");
    fixture.componentInstance.i18n.setLocale("en");
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector("#live-payment-check")).toBeNull();
    expect(
      page.querySelector<HTMLButtonElement>(".order-button")!.disabled,
    ).toBe(false);
    expect(sessionStorage.getItem("athlon_checkout_idempotency_v1")).toBeNull();
    expect(sessionStorage.getItem("athlon_live_card_checkout_v1")).toBeNull();
    expect(basket.items()).toHaveLength(1);

    // A quiet background check only matters if that attempt was in fact paid.
    const lookup = http.expectOne("/api/v1/public/orders/checkout-status");
    expect(lookup.request.headers.get("Idempotency-Key")).toBe(
      "ab00beef-0000-4000-8a00-ab00beef0000",
    );
    lookup.flush({
      orderReference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
      paymentStatus: "PENDING",
      locale: "EN",
    });
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
    expect(page.querySelector("#live-payment-check")).toBeNull();

    const form = page.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
      customerEmail: "ani@example.com",
      customerPhone: "+374 91 123456",
      deliveryAddress: "Yerevan",
    });
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    const order = http.expectOne((request) =>
      request.url.endsWith("/public/orders"),
    );
    expect(order.request.body.paymentMethod).toBe("CARD");
    expect(order.request.headers.get("Idempotency-Key")).not.toBe(
      "ab00beef-0000-4000-8a00-ab00beef0000",
    );
    order.flush({}, { status: 503, statusText: "Unavailable" });
  });

  it("shows the success page when the dropped attempt was in fact paid", () => {
    const reference = "ATH-1234ABCD1234ABCD1234ABCD1234ABCD";
    sessionStorage.setItem(
      "athlon_live_card_checkout_v1",
      JSON.stringify({
        key: "ab00beef-0000-4000-8a00-ab00beef0000",
        reference,
        items: [],
        phase: "pending",
      }),
    );
    const { fixture } = createBasketFixture(true);
    const navigate = vi
      .spyOn(TestBed.inject(Router), "navigate")
      .mockResolvedValue(true);
    fixture.componentInstance.i18n.setLocale("en");
    fixture.detectChanges();

    http.expectOne(`/api/v1/public/orders/${reference}/payment-status`).flush({
      orderReference: reference,
      paymentStatus: "PAID",
      locale: "EN",
    });
    expect(navigate).toHaveBeenCalledWith(["/", "en", "payment", reference]);
  });

  it("does not submit a form with blank required fields", () => {
    const { fixture } = createBasketFixture();
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;

    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    expect(
      http.match((request) => request.url.endsWith("/public/orders")),
    ).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain("ճիշտ էլ. փոստը");
    expect(
      form.querySelector('[name="customerName"]')?.getAttribute("aria-invalid"),
    ).toBe("true");
    expect(form.querySelector("#order-name-error")?.textContent).toContain(
      "Մուտքագրեք անունն ու ազգանունը",
    );
    expect(document.activeElement).toBe(form.querySelector("#order-name"));
  });

  it("shows an unchecked privacy consent that links to the policy in a new tab", () => {
    const { fixture } = createBasketFixture();
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    const consent = form.querySelector<HTMLInputElement>("#order-privacy")!;
    const link = form.querySelector<HTMLAnchorElement>(".privacy-consent a")!;

    expect(consent.type).toBe("checkbox");
    expect(consent.checked).toBe(false);
    expect(consent.required).toBe(true);
    expect(link.getAttribute("href")).toBe("/hy/privacy");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
  });

  it("blocks card payment until the privacy policy is accepted", () => {
    const { fixture } = createBasketFixture(true);
    const component = fixture.componentInstance;
    component.i18n.setLocale("en");
    const redirect = vi.spyOn(component, "redirectToCheckout");
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
      customerEmail: "ani@example.com",
      customerPhone: "+374 91 123456",
      deliveryAddress: "Yerevan",
    });
    acceptPrivacy(form, false);

    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    expect(
      http.match((request) => request.url.endsWith("/public/orders")),
    ).toHaveLength(0);
    expect(redirect).not.toHaveBeenCalled();
    const consent = form.querySelector<HTMLInputElement>("#order-privacy")!;
    expect(consent.getAttribute("aria-invalid")).toBe("true");
    expect(consent.getAttribute("aria-describedby")).toBe(
      "order-privacy-error",
    );
    expect(form.querySelector("#order-privacy-error")?.textContent).toContain(
      "Please accept the Privacy Policy",
    );
    expect(document.activeElement).toBe(consent);

    acceptPrivacy(form);
    fixture.detectChanges();
    expect(form.querySelector("#order-privacy-error")).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();

    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    const req = http.expectOne((request) =>
      request.url.endsWith("/public/orders"),
    );
    expect(req.request.body.paymentMethod).toBe("CARD");
    req.flush({
      kind: "CARD_PAYMENT_PENDING",
      accepted: true,
      orderReference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
      paymentStatus: "PENDING",
      checkoutUrl: "https://bank.example.test/checkout/1",
    });
    expect(redirect).toHaveBeenCalledWith(
      "https://bank.example.test/checkout/1",
    );
  });

  it("sends the basket and customer details as a card order and never treats a cash answer as success", () => {
    const { fixture, basket } = createBasketFixture();
    const component = fixture.componentInstance;
    component.i18n.setLocale("en");
    const redirect = vi.spyOn(component, "redirectToCheckout");
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
      customerEmail: "ani@example.com",
      customerPhone: "+374 91 123456",
      deliveryAddress: "Yerevan, Abovyan 1",
    });

    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();

    const req = http.expectOne((request) =>
      request.url.endsWith("/public/orders"),
    );
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({
      locale: "en",
      paymentMethod: "CARD",
      customer: {
        name: "Ani",
        email: "ani@example.com",
        phone: "+374 91 123456",
        address: "Yerevan, Abovyan 1",
      },
      items: [
        {
          productId: "4ebeb944-3503-47a2-9843-d37f1eb34768",
          quantity: 1,
          expectedUnitPrice: "24000",
        },
      ],
    });
    expect(req.request.headers.get("Idempotency-Key")).toMatch(
      /^[A-Za-z0-9._:-]{8,120}$/,
    );
    expect(fixture.nativeElement.querySelector(".order-button").disabled).toBe(
      true,
    );
    expect(
      fixture.nativeElement.querySelector('[name="customerName"]').disabled,
    ).toBe(true);
    req.flush({
      kind: "COD_ACCEPTED",
      accepted: true,
      orderReference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
    });
    fixture.detectChanges();

    expect(redirect).not.toHaveBeenCalled();
    expect(basket.items()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toMatch(
      /order has been registered|պատվերը գրանցված է/i,
    );
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain("Could not submit your order.");
  });

  it("keeps the basket and checkout values when order submission fails", () => {
    const { fixture, basket } = createBasketFixture();
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
      customerEmail: "ani@example.com",
      customerPhone: "+374 91 123456",
      deliveryAddress: "Yerevan",
    });

    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith("/public/orders"))
      .flush({}, { status: 503, statusText: "Service Unavailable" });
    fixture.detectChanges();

    expect(basket.items()).toHaveLength(1);
    expect(
      form.querySelector<HTMLInputElement>('[name="customerName"]')?.value,
    ).toBe("Ani");
    // The card attempt may exist at the bank, so the customer checks it first.
    expect(
      fixture.nativeElement.querySelector("#live-payment-check"),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain("Չհաջողվեց ուղարկել պատվերը։ Խնդրում ենք կրկին փորձել։");
  });

  it("restores checkout details when the basket page is recreated", () => {
    const { fixture } = createBasketFixture();
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
      customerEmail: "ani@example.com",
      customerPhone: "+374 91 123456",
      deliveryAddress: "Yerevan",
    });
    fixture.destroy();

    const restored = TestBed.createComponent(BasketPage);
    restored.detectChanges();
    flushSettings(false);
    restored.detectChanges();
    const restoredForm = restored.nativeElement.querySelector(
      "form",
    ) as HTMLFormElement;

    expect(
      restoredForm.querySelector<HTMLInputElement>('[name="customerName"]')
        ?.value,
    ).toBe("Ani");
    expect(
      restoredForm.querySelector<HTMLInputElement>('[name="customerEmail"]')
        ?.value,
    ).toBe("ani@example.com");
    expect(
      restoredForm.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("Yerevan");
  });

  it("starts a fresh card request key after page recreation", () => {
    const { fixture } = createBasketFixture(true);
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
      customerEmail: "ani@example.com",
      customerPhone: "+374 91 123456",
      deliveryAddress: "Yerevan",
    });
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    const first = http.expectOne((request) =>
      request.url.endsWith("/public/orders"),
    );
    const key = first.request.headers.get("Idempotency-Key");
    first.flush({}, { status: 503, statusText: "Unavailable" });
    fixture.destroy();

    const recreated = TestBed.createComponent(BasketPage);
    recreated.detectChanges();
    flushSettings(true);
    recreated.detectChanges();
    // The unfinished card checkout is dropped; a quiet lookup only redirects
    // if it was paid, and the next card order uses a new key.
    const lookup = http.expectOne("/api/v1/public/orders/checkout-status");
    expect(lookup.request.headers.get("Idempotency-Key")).toBe(key);
    lookup.flush({ paymentStatus: "NOT_FOUND" });
    recreated.detectChanges();
    const recreatedForm = recreated.nativeElement.querySelector(
      "form",
    ) as HTMLFormElement;
    acceptPrivacy(recreatedForm);
    recreatedForm.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    const retry = http.expectOne((request) =>
      request.url.endsWith("/public/orders"),
    );

    expect(retry.request.headers.get("Idempotency-Key")).not.toBe(key);
    expect(retry.request.body.paymentMethod).toBe("CARD");
    retry.flush({}, { status: 503, statusText: "Unavailable" });
  });

  it("asks customers to review basket details after a price or stock conflict", () => {
    const { fixture, basket } = createBasketFixture();
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
      customerEmail: "ani@example.com",
      customerPhone: "+374 91 123456",
      deliveryAddress: "Yerevan",
    });
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    http
      .expectOne((request) => request.url.endsWith("/public/orders"))
      .flush({}, { status: 409, statusText: "Conflict" });
    fixture.detectChanges();

    expect(basket.items()).toHaveLength(1);
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain(
      "Ապրանքի գինը կամ առկայությունը փոխվել է։ Ստուգեք զամբյուղը և կրկին փորձեք։",
    );
  });

  it("does not clear the basket unless the server explicitly accepts the order", () => {
    const { fixture, basket } = createBasketFixture();
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
      customerEmail: "ani@example.com",
      customerPhone: "+374 91 123456",
      deliveryAddress: "Yerevan",
    });
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    http
      .expectOne((request) => request.url.endsWith("/public/orders"))
      .flush({ accepted: false, orderReference: "" });
    fixture.detectChanges();

    expect(basket.items()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toMatch(
      /order has been registered|պատվերը գրանցված է/i,
    );
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain("Չհաջողվեց ուղարկել պատվերը։ Խնդրում ենք կրկին փորձել։");
  });

  it.each([
    ["hy", "Վճարումը կատարվում է պատվերը ձևակերպելիս՝ բանկի անվտանգ էջում։"],
    ["ru", "Оплата при оформлении заказа на защищённой странице банка."],
    ["en", "You pay while ordering, on the bank's secure page."],
  ] as const)("shows localized card payment terms for %s", (locale, note) => {
    const { fixture } = createBasketFixture();
    fixture.componentInstance.i18n.setLocale(locale);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(note);
  });
});
