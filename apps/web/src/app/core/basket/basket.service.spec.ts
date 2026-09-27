import { TestBed } from "@angular/core/testing";
import { Product } from "../api/catalog.models";
import { BasketService } from "./basket.service";

const product: Product = {
  id: "product-1",
  sku: "TRGAIN",
  slug: "trec-mass-xxl-gainer",
  name: "Trec Mass XXL Gainer",
  shortDescription: "Gainer",
  price: "30000",
  currency: "AMD",
  availability: "IN_STOCK",
  featured: true,
  isNew: false,
  category: { slug: "sports-nutrition", name: "Sports nutrition" },
  brand: { slug: "trec", name: "TREC" },
  images: [],
};

describe("BasketService", () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it("stores product quantities and restores them from localStorage", () => {
    const basket = TestBed.inject(BasketService);

    basket.add(product);
    basket.add(product);

    expect(basket.totalQuantity()).toBe(2);
    expect(basket.items()[0]).toMatchObject({
      id: "product-1",
      name: "Trec Mass XXL Gainer",
      quantity: 2,
      price: "30000",
    });

    const restored = new BasketService();
    expect(restored.totalQuantity()).toBe(2);
  });

  it("formats a copy-ready Instagram order text with names and counts", () => {
    const basket = TestBed.inject(BasketService);
    basket.add(product, 2);

    expect(basket.orderText("en")).toContain("Hello ATHLON");
    expect(basket.orderText("en")).toContain("1. Trec Mass XXL Gainer × 2");
    expect(basket.orderText("en")).toContain("Total:");
    expect(basket.orderText("en")).toContain("60");
    expect(basket.orderText("en")).toContain("000");
    expect(basket.orderText("en")).toContain("Please confirm availability.");
  });
});
