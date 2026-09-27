import { computed, Injectable, signal } from "@angular/core";
import { Product } from "../api/catalog.models";
import { Locale } from "../i18n/i18n.service";

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

function money(value: number): string {
  return new Intl.NumberFormat("hy-AM", {
    style: "currency",
    currency: "AMD",
    maximumFractionDigits: 0,
  }).format(value);
}

@Injectable({ providedIn: "root" })
export class BasketService {
  readonly items = signal<BasketItem[]>(this.read());
  readonly totalQuantity = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0),
  );
  readonly total = computed(() =>
    this.items().reduce(
      (sum, item) => sum + Number(item.price ?? 0) * item.quantity,
      0,
    ),
  );

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

  orderText(locale: Locale): string {
    const lines = this.items().map(
      (item, index) => `${index + 1}. ${item.name} × ${item.quantity}`,
    );
    const totalLine = this.total() > 0 ? money(this.total()) : null;
    const copy = {
      hy: {
        hello: "Բարև ATHLON 👋",
        want: "Ուզում եմ պատվիրել՝",
        total: "Ընդամենը",
        confirm: "Խնդրում եմ հաստատել առկայությունը։",
      },
      ru: {
        hello: "Здравствуйте, ATHLON 👋",
        want: "Хочу заказать:",
        total: "Итого",
        confirm: "Пожалуйста, подтвердите наличие.",
      },
      en: {
        hello: "Hello ATHLON 👋",
        want: "I would like to order:",
        total: "Total",
        confirm: "Please confirm availability.",
      },
    }[locale];

    return [
      copy.hello,
      "",
      copy.want,
      "",
      ...lines,
      ...(totalLine ? ["", `${copy.total}: ${totalLine}`] : []),
      "",
      copy.confirm,
    ].join("\n");
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
