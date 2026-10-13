import { CurrencyPipe, KeyValuePipe } from "@angular/common";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Title } from "@angular/platform-browser";
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  Subscription,
  switchMap,
} from "rxjs";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { Product, PublicSettings } from "../../core/api/catalog.models";
import { BasketService } from "../../core/basket/basket.service";
import { I18nService } from "../../core/i18n/i18n.service";
import { StatusPanel } from "../../shared/status-panel/status-panel";

@Component({
  selector: "app-product-page",
  imports: [CurrencyPipe, KeyValuePipe, RouterLink, StatusPanel],
  templateUrl: "./product-page.html",
  styleUrl: "./product-page.scss",
})
export class ProductPage {
  readonly i18n = inject(I18nService);
  readonly state = signal<"loading" | "ready" | "error">("loading");
  readonly product = signal<Product | null>(null);
  readonly relatedProducts = signal<Product[]>([]);
  readonly settings = signal<PublicSettings>({});
  readonly selectedImage = signal(0);
  readonly basket = inject(BasketService);
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;

  constructor() {
    combineLatest([this.route.paramMap, this.route.parent!.paramMap])
      .pipe(
        map(([routeParams, parentParams]) => ({
          locale: parentParams.get("locale") ?? "hy",
          slug: routeParams.get("slug") ?? "",
        })),
        distinctUntilChanged(
          (previous, current) =>
            previous.locale === current.locale &&
            previous.slug === current.slug,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ locale, slug }) => this.load(locale, slug));
  }

  load(
    locale = this.route.parent?.snapshot.paramMap.get("locale") ?? "hy",
    slug = this.route.snapshot.paramMap.get("slug") ?? "",
  ): void {
    this.loadSubscription?.unsubscribe();
    this.state.set("loading");
    this.selectedImage.set(0);
    this.relatedProducts.set([]);
    this.loadSubscription = this.api
      .product(slug, locale)
      .pipe(
        switchMap((product) => {
          this.product.set(product);
          this.title.setTitle(`${product.name} | ATHLON`);
          this.selectedImage.set(
            Math.max(
              0,
              product.images.findIndex((image) => image.primary),
            ),
          );
          this.state.set("ready");
          return forkJoin({
            settings: this.api.settings().pipe(catchError(() => of({}))),
            related: this.api
              .products({
                locale,
                category: product.category.slug,
                page: 1,
                pageSize: 5,
                sort: "displayOrder",
              })
              .pipe(
                catchError(() =>
                  of({
                    items: [],
                    meta: { page: 1, pageSize: 5, total: 0, totalPages: 0 },
                  }),
                ),
              ),
          });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ settings, related }) => {
          this.settings.set(settings);
          this.relatedProducts.set(
            related.items
              .filter((item) => item.id !== this.product()?.id)
              .slice(0, 4),
          );
          this.state.set("ready");
        },
        error: () => this.state.set("error"),
      });
  }

  image(): string {
    const images = this.product()?.images ?? [];
    return (
      images[this.selectedImage()]?.detailUrl ??
      "/placeholders/product-placeholder.svg"
    );
  }

  availabilityLabel(): string {
    const availability = this.product()?.availability ?? "ON_REQUEST";
    const keys = {
      IN_STOCK: "available",
      OUT_OF_STOCK: "unavailable",
      PREORDER: "preorder",
      ON_REQUEST: "onRequest",
    } as const;
    return this.i18n.t(keys[availability]);
  }

  contactHref(): string | null {
    const settings = this.settings();
    if (settings.whatsapp) {
      if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(settings.whatsapp)) {
        return settings.whatsapp;
      }
      const digits = settings.whatsapp.replace(/\D/g, "");
      if (digits.length >= 8) return `https://wa.me/${digits}`;
    }
    if (settings.phone && /^\+?[\d ()-]{7,}$/.test(settings.phone)) {
      return `tel:${settings.phone.replace(/[^\d+]/g, "")}`;
    }
    if (settings.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(settings.email)) {
      return `mailto:${settings.email}`;
    }
    return null;
  }

  formatCharacteristic(value: unknown): string {
    if (Array.isArray(value)) return value.join(", ");
    if (value !== null && typeof value === "object")
      return JSON.stringify(value);
    if (typeof value === "boolean") return value ? "✓" : "—";
    const text = String(value ?? "—");
    if (
      ["unflavored", "unflavoured", "without flavor"].includes(
        text.toLowerCase(),
      )
    ) {
      return this.i18n.locale() === "hy"
        ? "Առանց համի"
        : this.i18n.locale() === "ru"
          ? "Без вкуса"
          : "Unflavored";
    }
    return text;
  }

  characteristicLabel(key: string): string {
    const normalized = key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .toLowerCase();
    const known: Record<string, [string, string, string]> = {
      "net weight": ["Net weight", "Вес нетто", "Զուտ քաշ"],
      weight: ["Weight", "Вес", "Քաշ"],
      "serving size": ["Serving size", "Размер порции", "Մեկ չափաբաժնի չափը"],
      servings: ["Servings", "Порций", "Չափաբաժիններ"],
      flavor: ["Flavor", "Вкус", "Համ"],
      "creatine per serving": [
        "Creatine per serving",
        "Креатин на порцию",
        "Կրեատին՝ մեկ չափաբաժնում",
      ],
      "protein per serving": [
        "Protein per serving",
        "Белок на порцию",
        "Սպիտակուց՝ մեկ չափաբաժնում",
      ],
      "caffeine per serving": [
        "Caffeine per serving",
        "Кофеин на порцию",
        "Կոֆեին՝ մեկ չափաբաժնում",
      ],
    };
    const labels = known[normalized];
    if (labels) return labels[{ en: 0, ru: 1, hy: 2 }[this.i18n.locale()]];
    return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  addToBasket(): void {
    const product = this.product();
    if (product && product.availability !== "OUT_OF_STOCK") {
      this.basket.add(product);
    }
  }

  inBasket(): boolean {
    const product = this.product();
    return (
      !!product && this.basket.items().some((item) => item.id === product.id)
    );
  }
}
