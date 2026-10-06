import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { BasketService } from "../../core/basket/basket.service";
import { BasketPage } from "./basket-page";

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

function createBasketFixture() {
  const basket = TestBed.inject(BasketService);
  addBasketProduct(basket);
  const fixture = TestBed.createComponent(BasketPage);
  fixture.detectChanges();
  return { fixture, basket };
}

function fillOrderForm(
  form: HTMLFormElement,
  fields: {
    customerName: string;
    customerPhone: string;
    deliveryAddress: string;
  },
): void {
  for (const [name, value] of Object.entries(fields)) {
    const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

describe("BasketPage", () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [BasketPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

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

    const controls = fixture.nativeElement.querySelector(
      ".basket-item-actions",
    );

    expect(controls).not.toBeNull();
    expect(getComputedStyle(controls).display).toBe("flex");
    expect(controls.querySelector("label")).not.toBeNull();
    expect(controls.querySelector("button")).not.toBeNull();
  });

  it("shows continue shopping as a centered white button", () => {
    const fixture = TestBed.createComponent(BasketPage);
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

  it("requires name, phone, and delivery address before placing an order", () => {
    const { fixture } = createBasketFixture();
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;

    expect(
      form.querySelector<HTMLInputElement>('[name="customerName"]')?.required,
    ).toBe(true);
    expect(
      form.querySelector<HTMLInputElement>('[name="customerPhone"]')?.required,
    ).toBe(true);
    expect(
      form.querySelector<HTMLInputElement>('[name="deliveryAddress"]')
        ?.required,
    ).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
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
    ).toContain("Լրացրեք անունը, հեռախոսահամարը և առաքման հասցեն։");
  });

  it("sends the basket and customer details, then clears the basket on acceptance", () => {
    const { fixture, basket } = createBasketFixture();
    const component = fixture.componentInstance;
    component.i18n.setLocale("en");
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
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
      customer: {
        name: "Ani",
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
    expect(fixture.nativeElement.querySelector(".order-button").disabled).toBe(
      true,
    );
    expect(
      fixture.nativeElement.querySelector('[type="number"]').disabled,
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector(".basket-item-actions button")
        .disabled,
    ).toBe(true);
    expect(fixture.nativeElement.querySelector(".clear-button").disabled).toBe(
      true,
    );
    expect(
      fixture.nativeElement.querySelector('[name="customerName"]').disabled,
    ).toBe(true);
    req.flush({ accepted: true, orderReference: "ATH-1234ABCD" });
    fixture.detectChanges();

    expect(basket.items()).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelector('[role="status"]').textContent,
    ).toContain("Your order has been registered.");
  });

  it("keeps the basket and checkout values when order submission fails", () => {
    const { fixture, basket } = createBasketFixture();
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
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
    expect(fixture.nativeElement.querySelector(".order-button").disabled).toBe(
      false,
    );
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain("Չհաջողվեց ուղարկել պատվերը։ Խնդրում ենք կրկին փորձել։");
  });

  it("asks customers to review basket details after a price or stock conflict", () => {
    const { fixture, basket } = createBasketFixture();
    const form = fixture.nativeElement.querySelector("form") as HTMLFormElement;
    fillOrderForm(form, {
      customerName: "Ani",
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
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]').textContent,
    ).toContain("Չհաջողվեց ուղարկել պատվերը։ Խնդրում ենք կրկին փորձել։");
  });

  it.each([
    [
      "hy",
      "Վճարումը՝ պատվերը ստանալիս․ կանխիկ կամ քարտով։",
      "Ձեր պատվերը գրանցված է",
    ],
    [
      "ru",
      "Оплата при получении заказа — наличными или картой.",
      "Ваш заказ зарегистрирован.",
    ],
    [
      "en",
      "Pay the courier on delivery by cash or card.",
      "Your order has been registered.",
    ],
  ] as const)(
    "shows localized payment terms and success for %s",
    (locale, note, success) => {
      const { fixture } = createBasketFixture();
      const component = fixture.componentInstance;
      component.i18n.setLocale(locale);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(note);

      const form = fixture.nativeElement.querySelector(
        "form",
      ) as HTMLFormElement;
      fillOrderForm(form, {
        customerName: "Անի",
        customerPhone: "+374 91 123456",
        deliveryAddress: "Երևան",
      });
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      http
        .expectOne((request) => request.url.endsWith("/public/orders"))
        .flush({ accepted: true, orderReference: "ATH-1234ABCD" });
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[role="status"]').textContent,
      ).toContain(success);
    },
  );
});
