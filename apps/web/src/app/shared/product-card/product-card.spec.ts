import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { Product } from "../../core/api/catalog.models";
import { ProductCard } from "./product-card";
import { BasketService } from "../../core/basket/basket.service";

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
  isNew: true,
  category: { slug: "protein", name: "Protein" },
  brand: { slug: "trec", name: "Trec" },
  images: [],
};

describe("ProductCard basket controls", () => {
  beforeEach(() => localStorage.clear());

  it("shows a compact cart button before adding and quantity controls after adding", async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCard],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput("product", product);
    fixture.detectChanges();

    const compactButton = fixture.nativeElement.querySelector(
      "[data-testid='product-card-add-basket']",
    ) as HTMLButtonElement;
    expect(compactButton).not.toBeNull();
    expect(
      compactButton.querySelector("[data-testid='product-card-cart-icon']"),
    ).not.toBeNull();

    compactButton.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        "[data-testid='product-card-quantity']",
      ),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        "[data-testid='product-card-quantity-value']",
      ).textContent,
    ).toContain("1");
    expect(
      fixture.nativeElement.querySelector(
        "[data-testid='product-card-add-basket']",
      ),
    ).toBeNull();
  });

  it("keeps long product names accessible while the card layout can clamp them", async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCard],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput("product", {
      ...product,
      name: "Very long product name that should be visually clamped with ellipsis inside the card",
    });
    fixture.detectChanges();

    const cardCopy = fixture.nativeElement.querySelector(".card-copy");
    const titleLink = fixture.nativeElement.querySelector("h3 a");

    expect(getComputedStyle(cardCopy).display).toBe("flex");
    expect(titleLink.getAttribute("title")).toBe(
      "Very long product name that should be visually clamped with ellipsis inside the card",
    );
  });

  it("renders the whey flavor separately so the shared product prefix cannot hide it", async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCard],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput("product", {
      ...product,
      name: "Trec Whey 100 New Formula — Կրկնակի շոկոլադ",
    });
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector("h3 a");
    expect(title.querySelector(".product-base")?.textContent).toBe(
      "Trec Whey 100 New Formula",
    );
    expect(title.querySelector(".product-variant")?.textContent).toBe(
      "Կրկնակի շոկոլադ",
    );
    expect(title.getAttribute("title")).toBe(
      "Trec Whey 100 New Formula — Կրկնակի շոկոլադ",
    );
  });

  it("prevents an out-of-stock product from being added to the basket", async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCard],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput("product", {
      ...product,
      availability: "OUT_OF_STOCK",
    });
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector(
      "[data-testid='product-card-add-basket']",
    );
    expect(addButton).toBeNull();
    fixture.componentInstance.addToBasket();
    expect(TestBed.inject(BasketService).items()).toHaveLength(0);
  });

  it.each(["OUT_OF_STOCK", "PREORDER", "ON_REQUEST"] as const)(
    "hides add and increment for %s while allowing removal",
    async (availability) => {
      await TestBed.configureTestingModule({
        imports: [ProductCard],
        providers: [provideRouter([])],
      }).compileComponents();
      const fixture = TestBed.createComponent(ProductCard);
      const basket = TestBed.inject(BasketService);
      fixture.componentRef.setInput("product", { ...product, availability });
      fixture.detectChanges();

      const add = fixture.nativeElement.querySelector(
        "[data-testid='product-card-add-basket']",
      );
      expect(add).toBeNull();
      expect(
        fixture.nativeElement.querySelector(".detail-link"),
      ).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector(".card-bottom strong").textContent,
      ).toContain("15,000");
      fixture.componentInstance.addToBasket();
      expect(basket.items()).toEqual([]);

      basket.add(product);
      fixture.detectChanges();
      const increment = fixture.nativeElement.querySelector(
        "[data-testid='product-card-increment']",
      );
      expect(increment).toBeNull();
      expect(
        fixture.nativeElement.querySelector(
          "[data-testid='product-card-quantity-value']",
        ).textContent,
      ).toContain("1");
      fixture.componentInstance.incrementBasket();
      expect(basket.totalQuantity()).toBe(1);
      const decrement = fixture.nativeElement.querySelector(
        "[data-testid='product-card-decrement']",
      ) as HTMLButtonElement;
      expect(decrement.disabled).toBe(false);
      decrement.click();
      expect(basket.items()).toEqual([]);
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector(
          "[data-testid='product-card-add-basket']",
        ),
      ).toBeNull();
      expect(
        fixture.nativeElement.querySelector(
          "[data-testid='product-card-increment']",
        ),
      ).toBeNull();
    },
  );

  it("increments an in-stock product using the enabled plus control", async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCard],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductCard);
    const basket = TestBed.inject(BasketService);
    basket.add(product);
    fixture.componentRef.setInput("product", product);
    fixture.detectChanges();
    const increment = fixture.nativeElement.querySelector(
      "[data-testid='product-card-increment']",
    ) as HTMLButtonElement;
    expect(increment.disabled).toBe(false);
    increment.click();
    expect(basket.totalQuantity()).toBe(2);
  });
});
