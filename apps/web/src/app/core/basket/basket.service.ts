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

interface StoredBasket {
  version: 2;
  items: BasketItem[];
  settledReferences: string[];
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isBasketItem(value: unknown): value is BasketItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<BasketItem>;
  return (
    isNonemptyString(item.id) &&
    typeof item.name === "string" &&
    Number.isSafeInteger(item.quantity) &&
    (item.quantity ?? 0) > 0
  );
}

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
  private readonly initialState = this.read();
  private settledReferences = this.initialState?.settledReferences ?? [];
  readonly items = signal<BasketItem[]>(this.initialState?.items ?? []);
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

  settlePayment(
    reference: string,
    items: Array<{ productId: string; quantity: number }>,
  ): boolean {
    if (
      !isNonemptyString(reference) ||
      !Array.isArray(items) ||
      items.length === 0 ||
      items.some(
        (item) =>
          !item ||
          !isNonemptyString(item.productId) ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity <= 0,
      ) ||
      new Set(items.map((item) => item.productId)).size !== items.length
    ) {
      return false;
    }

    const target = storage();
    const current = this.read(target);
    if (!target || !current) return false;
    if (current.settledReferences.includes(reference)) {
      this.settledReferences = current.settledReferences;
      this.items.set(current.items);
      return true;
    }

    const purchased = new Map(
      items.map((item) => [item.productId, item.quantity]),
    );
    const next: StoredBasket = {
      version: 2,
      items: current.items
        .map((item) => ({
          ...item,
          quantity: Math.max(0, item.quantity - (purchased.get(item.id) ?? 0)),
        }))
        .filter((item) => item.quantity > 0),
      settledReferences: [...current.settledReferences, reference],
    };
    try {
      // One record retains both changes; localStorage offers no cross-tab CAS.
      target.setItem(storageKey, JSON.stringify(next));
    } catch {
      return false;
    }
    this.settledReferences = next.settledReferences;
    this.items.set(next.items);
    return true;
  }

  private setItems(items: BasketItem[]): void {
    this.settledReferences = [
      ...new Set([
        ...this.settledReferences,
        ...(this.read()?.settledReferences ?? []),
      ]),
    ];
    this.items.set(items);
    storage()?.setItem(
      storageKey,
      JSON.stringify({
        version: 2,
        items,
        settledReferences: this.settledReferences,
      }),
    );
  }

  private read(target = storage()): StoredBasket | null {
    if (!target) return null;
    try {
      const raw = target.getItem(storageKey);
      if (raw === null) return { version: 2, items: [], settledReferences: [] };
      const parsed: unknown = JSON.parse(raw);
      const record = (
        Array.isArray(parsed)
          ? { version: 2, items: parsed, settledReferences: [] }
          : parsed
      ) as Partial<StoredBasket> | null;
      if (
        !record ||
        record.version !== 2 ||
        !Array.isArray(record.items) ||
        !record.items.every(isBasketItem) ||
        new Set(record.items.map((item) => item.id)).size !==
          record.items.length ||
        !Array.isArray(record.settledReferences) ||
        !record.settledReferences.every(isNonemptyString)
      ) {
        return null;
      }
      return record as StoredBasket;
    } catch {
      return null;
    }
  }
}
