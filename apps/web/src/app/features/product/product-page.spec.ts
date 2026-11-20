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
  afterEach(() => localStorage.clear());

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

  describe("gallery swipe", () => {
    const pictures = [0, 1, 2].map((index) => ({
      id: `image-${index}`,
      alt: `Image ${index}`,
      primary: index === 0,
      thumbnailUrl: `/thumb-${index}.webp`,
      detailUrl: `/detail-${index}.webp`,
    })) as unknown as Product["images"];

    function setup() {
      const fixture = TestBed.createComponent(ProductPage);
      const page = fixture.componentInstance;
      page.product.set({ ...product, images: pictures });
      page.state.set("ready");
      fixture.detectChanges();
      const area = fixture.nativeElement.querySelector(
        ".main-image",
      ) as HTMLElement;
      const swipe = (fromX: number, toX: number, fromY = 100, toY = 100) => {
        area.dispatchEvent(
          new MouseEvent("pointerdown", {
            clientX: fromX,
            clientY: fromY,
            bubbles: true,
          }),
        );
        area.dispatchEvent(
          new MouseEvent("pointerup", {
            clientX: toX,
            clientY: toY,
            bubbles: true,
          }),
        );
        fixture.detectChanges();
      };
      return { page, swipe };
    }

    it("shows the next image after a left swipe and the previous after a right swipe", () => {
      const { page, swipe } = setup();
      swipe(250, 150);
      expect(page.selectedImage()).toBe(1);
      swipe(250, 150);
      expect(page.selectedImage()).toBe(2);
      swipe(150, 250);
      expect(page.selectedImage()).toBe(1);
    });

    it("stays on the first and last image at the ends", () => {
      const { page, swipe } = setup();
      swipe(150, 250);
      expect(page.selectedImage()).toBe(0);
      page.selectedImage.set(2);
      swipe(250, 150);
      expect(page.selectedImage()).toBe(2);
    });

    it("ignores taps, short moves and mostly vertical scrolls", () => {
      const { page, swipe } = setup();
      swipe(200, 200);
      swipe(200, 170);
      swipe(200, 150, 100, 220);
      expect(page.selectedImage()).toBe(0);
    });

    it("ignores a cancelled gesture", () => {
      const { page } = setup();
      page.onSwipeStart({ clientX: 250, clientY: 100 } as PointerEvent);
      page.onSwipeCancel();
      page.onSwipeEnd({ clientX: 100, clientY: 100 } as PointerEvent);
      expect(page.selectedImage()).toBe(0);
    });
  });

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
