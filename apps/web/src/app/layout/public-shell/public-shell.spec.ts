import { of } from "rxjs";
import { TestBed } from "@angular/core/testing";
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from "@angular/router";
import { PublicShell } from "./public-shell";
import { BasketService } from "../../core/basket/basket.service";

describe("PublicShell floating basket", () => {
  beforeEach(() => localStorage.clear());

  it("keeps a fixed basket action visible with the current item count", async () => {
    await TestBed.configureTestingModule({
      imports: [PublicShell],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ locale: "hy" })) },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PublicShell);
    const basket = TestBed.inject(BasketService);
    basket.add({
      id: "p1",
      sku: "SKU",
      slug: "test-product",
      name: "Test Product",
      shortDescription: null,
      price: "1000",
      currency: "AMD",
      availability: "IN_STOCK",
      featured: false,
      isNew: false,
      category: { slug: "protein", name: "Protein" },
      brand: null,
      images: [],
    });
    basket.add({
      id: "p2",
      sku: "SKU2",
      slug: "test-product-2",
      name: "Test Product 2",
      shortDescription: null,
      price: "1000",
      currency: "AMD",
      availability: "IN_STOCK",
      featured: false,
      isNew: false,
      category: { slug: "protein", name: "Protein" },
      brand: null,
      images: [],
    });
    fixture.detectChanges();

    const floatingBasket = fixture.nativeElement.querySelector(
      "[data-testid='floating-basket-link']",
    ) as HTMLAnchorElement;
    const badge = fixture.nativeElement.querySelector(
      "[data-testid='floating-basket-count']",
    ) as HTMLElement;

    expect(floatingBasket).not.toBeNull();
    expect(getComputedStyle(floatingBasket).position).toBe("fixed");
    expect(floatingBasket.getAttribute("href")).toBe("/hy/basket");
    expect(badge.textContent?.trim()).toBe("2");
  });
});
