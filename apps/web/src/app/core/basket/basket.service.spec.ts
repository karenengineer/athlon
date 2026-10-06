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

  it("does not display a misleading partial total when a price is unavailable", () => {
    const basket = TestBed.inject(BasketService);
    basket.add(product);
    basket.add({ ...product, id: "unpriced-product", price: null });

    expect(basket.total()).toBeNull();
  });
});
