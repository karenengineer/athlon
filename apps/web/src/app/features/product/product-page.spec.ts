import { provideHttpClient } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { EMPTY } from "rxjs";
import { Product } from "../../core/api/catalog.models";
import { BasketService } from "../../core/basket/basket.service";
import { ProductPage } from "./product-page";

const product: Product = {
  id: "product-1",
  sku: "SKU1",
  slug: "test-product",
  name: "Test Product",
  shortDescription: "Short",
  price: "15000",
  currency: "AMD",
  availability: "IN_STOCK",
  featured: false,
  isNew: false,
  category: { slug: "protein", name: "Protein" },
  brand: null,
  images: [],
};

describe("ProductPage basket availability", () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProductPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: EMPTY, parent: { paramMap: EMPTY } },
        },
      ],
    }).compileComponents();
  });

  for (const [locale, unavailable, preorder, onRequest, contact] of [
    ["hy", "Առկա չէ", "Նախնական պատվեր", "Պատվերով", "Ճշտել առկայությունը"],
    ["ru", "Нет в наличии", "Предзаказ", "Под заказ", "Уточнить наличие"],
    ["en", "Out of stock", "Preorder", "On request", "Check availability"],
  ]) {
    it.each([
      ["OUT_OF_STOCK", unavailable],
      ["PREORDER", preorder],
      ["ON_REQUEST", onRequest],
    ] as const)(
      "hides the basket action for %s and keeps its localized status in " +
        locale,
      (availability, label) => {
        const fixture = TestBed.createComponent(ProductPage);
        const page = fixture.componentInstance;
        const basket = TestBed.inject(BasketService);
        page.i18n.setLocale(locale);
        page.product.set({ ...product, availability } as Product);
        page.state.set("ready");
        page.settings.set({ email: "shop@example.test" });
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector(".basket-cta")).toBeNull();
        expect(
          fixture.nativeElement
            .querySelector(".price span")
            .textContent?.trim(),
        ).toBe(label);
        expect(
          fixture.nativeElement.querySelector(".availability-cta").textContent,
        ).toContain(contact);
        page.addToBasket();
        expect(basket.items()).toEqual([]);

        basket.add(product);
        page.addToBasket();
        fixture.detectChanges();
        expect(basket.totalQuantity()).toBe(1);
        expect(fixture.nativeElement.querySelector(".basket-cta")).toBeNull();
        expect(
          fixture.nativeElement
            .querySelector(".price span")
            .textContent?.trim(),
        ).toBe(label);
      },
    );
  }

  it("adds and increments an in-stock product using the enabled action", () => {
    const fixture = TestBed.createComponent(ProductPage);
    const page = fixture.componentInstance;
    page.product.set(product);
    page.state.set("ready");
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      ".basket-cta",
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    button.click();
    button.click();
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(2);
  });
});
