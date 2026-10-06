import { computed, Injectable, signal } from "@angular/core";
import { Product } from "../api/catalog.models";

export interface BasketItem {
  id: string;
  sku: string;
  slug: string;
  name: string;
  price: string | null;
  currency: "AMD";
  imageUrl: string;
  quantity: number;
}

const storageKey = "athlon:basket:v1";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function itemFromProduct(product: Product, quantity: number): BasketItem {
  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    price: product.price,
    currency: product.currency,
    imageUrl:
      product.images.find((image) => image.primary)?.thumbnailUrl ??
      product.images[0]?.thumbnailUrl ??
      "/placeholders/product-placeholder.svg",
    quantity,
  };
}

@Injectable({ providedIn: "root" })
export class BasketService {
  readonly items = signal<BasketItem[]>(this.read());
  readonly totalQuantity = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0),
  );
  readonly total = computed<number | null>(() => {
    const items = this.items();
    if (items.some((item) => item.price === null)) return null;
    return items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    );
  });

  add(product: Product, quantity = 1): void {
    const next = [...this.items()];
    const existing = next.find((item) => item.id === product.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      next.push(itemFromProduct(product, quantity));
    }
    this.setItems(next);
  }

  update(productId: string, quantity: number): void {
    const safeQuantity = Math.max(0, Math.floor(quantity));
    this.setItems(
      this.items()
        .map((item) =>
          item.id === productId ? { ...item, quantity: safeQuantity } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  remove(productId: string): void {
    this.setItems(this.items().filter((item) => item.id !== productId));
  }

  clear(): void {
    this.setItems([]);
  }

  private setItems(items: BasketItem[]): void {
    this.items.set(items);
    storage()?.setItem(storageKey, JSON.stringify(items));
  }

  private read(): BasketItem[] {
    const raw = storage()?.getItem(storageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as BasketItem[];
      return Array.isArray(parsed)
        ? parsed.filter(
            (item) =>
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              Number.isInteger(item.quantity) &&
              item.quantity > 0,
          )
        : [];
    } catch {
      return [];
    }
  }
}
