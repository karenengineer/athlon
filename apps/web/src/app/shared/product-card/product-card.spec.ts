import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { Product } from "../../core/api/catalog.models";
import { ProductCard } from "./product-card";

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
});
