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

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    "OUT_OF_STOCK",
    "PREORDER",
    "ON_REQUEST",
    undefined,
    null,
    "UNKNOWN",
  ])(
    "rejects adding or incrementing availability %s without writing storage",
    (availability) => {
      const basket = TestBed.inject(BasketService);
      const unavailable = { ...product, availability } as Product;
      const write = vi.spyOn(Storage.prototype, "setItem");

      basket.add(unavailable);
      expect(basket.items()).toEqual([]);
      expect(write).not.toHaveBeenCalled();

      basket.add(product, 2);
      write.mockClear();
      basket.add(unavailable);
      expect(basket.totalQuantity()).toBe(2);
      expect(write).not.toHaveBeenCalled();
      expect(new BasketService().totalQuantity()).toBe(2);
    },
  );

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

  it("subtracts purchased quantities while keeping other basket items", () => {
    const basket = new BasketService();
    basket.add(product, 3);
    basket.add({ ...product, id: "product-2" });

    expect(
      basket.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    expect(basket.items()).toMatchObject([
      { id: "product-1", quantity: 1 },
      { id: "product-2", quantity: 1 },
    ]);
    expect(new BasketService().totalQuantity()).toBe(2);
  });

  it("settles a reference only once across service recreation and settles a new reference independently", () => {
    const basket = new BasketService();
    basket.add(product, 5);
    expect(
      basket.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);

    const restored = new BasketService();
    expect(
      restored.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    expect(restored.totalQuantity()).toBe(3);
    expect(
      restored.settlePayment("payment-2", [
        { productId: product.id, quantity: 1 },
      ]),
    ).toBe(true);
    expect(restored.totalQuantity()).toBe(2);
  });

  it.each(["add", "update", "remove", "clear"] as const)(
    "retains settled references after %s",
    (mutation) => {
      const basket = new BasketService();
      basket.add(product, 3);
      expect(
        basket.settlePayment("payment-1", [
          { productId: product.id, quantity: 2 },
        ]),
      ).toBe(true);
      if (mutation === "add") basket.add(product);
      if (mutation === "update") basket.update(product.id, 2);
      if (mutation === "remove") basket.remove(product.id);
      if (mutation === "clear") basket.clear();
      basket.add(product, 2);
      const before = basket.totalQuantity();

      const restored = new BasketService();
      expect(
        restored.settlePayment("payment-1", [
          { productId: product.id, quantity: 2 },
        ]),
      ).toBe(true);
      expect(restored.totalQuantity()).toBe(before);
    },
  );

  it("refreshes persisted basket state before reconciling", () => {
    const stale = new BasketService();
    const current = new BasketService();
    current.add(product, 3);
    current.add({ ...product, id: "product-2" });

    expect(
      stale.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    expect(stale.items()).toMatchObject([
      { id: "product-1", quantity: 1 },
      { id: "product-2", quantity: 1 },
    ]);
    expect(
      current.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    expect(current.totalQuantity()).toBe(2);
  });

  it("preserves references written by another service during ordinary mutations", () => {
    const stale = new BasketService();
    const current = new BasketService();
    current.add(product, 3);
    expect(
      current.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    stale.clear();
    stale.add(product, 3);

    const restored = new BasketService();
    expect(
      restored.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    expect(restored.totalQuantity()).toBe(3);
  });

  it("preserves unknown settlement history when an ordinary mutation cannot read storage", () => {
    const stale = new BasketService();
    const current = new BasketService();
    current.add(product, 3);
    expect(
      current.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    const saved = localStorage.getItem("athlon:basket:v1");
    const read = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });

    stale.clear();
    read.mockRestore();
    expect(localStorage.getItem("athlon:basket:v1")).toBe(saved);
    stale.add(product, 3);

    const restored = new BasketService();
    expect(
      restored.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    expect(restored.totalQuantity()).toBe(3);
  });

  it("does not overwrite settlement history when the stored item section is corrupt", () => {
    const stale = new BasketService();
    const current = new BasketService();
    current.add(product, 3);
    expect(
      current.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    const saved = localStorage.getItem("athlon:basket:v1")!;
    const corrupt = JSON.stringify({ ...JSON.parse(saved), items: [null] });
    localStorage.setItem("athlon:basket:v1", corrupt);

    stale.clear();
    expect(localStorage.getItem("athlon:basket:v1")).toBe(corrupt);
    // Simulate repair of the item data without losing the payment history.
    localStorage.setItem("athlon:basket:v1", saved);
    stale.add(product, 3);

    const restored = new BasketService();
    expect(
      restored.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    expect(restored.totalQuantity()).toBe(3);
  });

  it("migrates legacy array storage while retaining basket quantities", () => {
    const original = new BasketService();
    original.add(product, 3);
    localStorage.setItem("athlon:basket:v1", JSON.stringify(original.items()));

    const restored = new BasketService();
    expect(restored.totalQuantity()).toBe(3);
    expect(
      restored.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    const reloaded = new BasketService();
    expect(
      reloaded.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    expect(reloaded.totalQuantity()).toBe(1);
  });

  it("removes exhausted quantities without creating missing purchased products", () => {
    const basket = new BasketService();
    basket.add(product);

    expect(
      basket.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
        { productId: "missing", quantity: 1 },
      ]),
    ).toBe(true);
    expect(basket.items()).toEqual([]);
    basket.add(product);
    expect(
      basket.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    expect(basket.totalQuantity()).toBe(1);
  });

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])(
    "rejects invalid purchased quantity %s without changing the basket",
    (quantity) => {
      const basket = new BasketService();
      basket.add(product, 3);
      const saved = localStorage.getItem("athlon:basket:v1");

      expect(
        basket.settlePayment("payment-1", [
          { productId: product.id, quantity },
        ]),
      ).toBe(false);
      expect(basket.totalQuantity()).toBe(3);
      expect(localStorage.getItem("athlon:basket:v1")).toBe(saved);
    },
  );

  it.each([
    { reference: "", items: [{ productId: product.id, quantity: 1 }] },
    { reference: "   ", items: [{ productId: product.id, quantity: 1 }] },
    { reference: "payment-1", items: [] },
    { reference: "payment-1", items: [{ productId: " ", quantity: 1 }] },
    {
      reference: "payment-1",
      items: [
        { productId: product.id, quantity: 1 },
        { productId: product.id, quantity: 1 },
      ],
    },
  ])("rejects malformed settlement input %#", ({ reference, items }) => {
    const basket = new BasketService();
    basket.add(product, 3);

    expect(basket.settlePayment(reference, items)).toBe(false);
    expect(basket.totalQuantity()).toBe(3);
    expect(new BasketService().totalQuantity()).toBe(3);
  });

  it.each([
    "not-json",
    "null",
    '{"version":999,"items":[],"settledReferences":[]}',
    "[null]",
  ])("does not settle corrupt storage %s", (raw) => {
    const basket = new BasketService();
    basket.add(product, 3);
    localStorage.setItem("athlon:basket:v1", raw);

    expect(
      basket.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(false);
    expect(basket.totalQuantity()).toBe(3);
    expect(localStorage.getItem("athlon:basket:v1")).toBe(raw);
    expect(() => new BasketService()).not.toThrow();
  });

  it("does not remove items or mark the reference settled when a write fails", () => {
    const basket = new BasketService();
    basket.add(product, 3);
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });

    expect(
      basket.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(false);
    expect(basket.totalQuantity()).toBe(3);
    write.mockRestore();
    expect(new BasketService().totalQuantity()).toBe(3);
    expect(
      basket.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(true);
    expect(basket.totalQuantity()).toBe(1);
  });

  it("does not remove items when storage reads are denied", () => {
    const basket = new BasketService();
    basket.add(product, 3);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(
      basket.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(false);
    expect(basket.totalQuantity()).toBe(3);
    expect(() => new BasketService()).not.toThrow();
  });

  it("does not remove items without browser storage during SSR", () => {
    vi.stubGlobal("localStorage", undefined);
    const basket = new BasketService();
    basket.add(product, 3);

    expect(
      basket.settlePayment("payment-1", [
        { productId: product.id, quantity: 2 },
      ]),
    ).toBe(false);
    expect(basket.totalQuantity()).toBe(3);
  });
});
