import { CurrencyPipe, KeyValuePipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
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
import {
  Product,
  ProductReviews as ProductReviewsData,
  PublicSettings,
} from "../../core/api/catalog.models";
import { ProductReviews } from "./product-reviews";
import {
  BasketService,
  isBasketEligible,
  resistanceBandsCategory,
} from "../../core/basket/basket.service";
import {
  INSTAGRAM_PROFILE_URL,
  ORDER_PHONE_DISPLAY,
  ORDER_PHONE_HREF,
} from "../../core/social-links";
import { I18nService, Locale } from "../../core/i18n/i18n.service";
import { imageAlt } from "../../core/seo/image-alt";
import { localizeCharacteristicValue } from "./characteristic-values";
import { guidesForCategory } from "../guides/guide-index";
import { StatusPanel } from "../../shared/status-panel/status-panel";
import {
  createPageMetadata,
  createPageResponseStatus,
  publicPageUrl,
} from "../../core/seo/page-metadata";
import {
  breadcrumbSchema,
  localProductDescription,
  productSchema,
  seoCopy,
} from "../../core/seo/seo-content";

@Component({
  selector: "app-product-page",
  imports: [
    CurrencyPipe,
    KeyValuePipe,
    RouterLink,
    StatusPanel,
    ProductReviews,
  ],
  templateUrl: "./product-page.html",
  styleUrl: "./product-page.scss",
})
export class ProductPage {
  readonly isBasketEligible = isBasketEligible;
  readonly resistanceBandsCategory = resistanceBandsCategory;
  readonly instagramUrl = INSTAGRAM_PROFILE_URL;
  readonly orderPhoneDisplay = ORDER_PHONE_DISPLAY;
  readonly orderPhoneHref = ORDER_PHONE_HREF;
  readonly i18n = inject(I18nService);
  readonly state = signal<"loading" | "ready" | "error" | "not-found">(
    "loading",
  );
  readonly product = signal<Product | null>(null);
  readonly relatedProducts = signal<Product[]>([]);
  readonly reviews = signal<ProductReviewsData | null>(null);
  readonly settings = signal<PublicSettings>({});
  readonly selectedImage = signal(0);
  readonly basket = inject(BasketService);

  /** The guide for the product's category, linked from the product page. */
  guideFor(
    category: string | null | undefined,
  ): { slug: string; heading: string } | null {
    const [match] = guidesForCategory(category);
    return match
      ? { slug: match.slug, heading: match.link.heading[this.i18n.locale()] }
      : null;
  }

  altFor(alt: string | null | undefined, name: string): string {
    return imageAlt(alt, name, this.i18n.locale());
  }
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly metadata = createPageMetadata();
  private readonly responseStatus = createPageResponseStatus();
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;
  private swipeOrigin: { x: number; y: number } | null = null;
  private static readonly swipeThreshold = 40;

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
    this.i18n.setLocale(locale);
    const currentLocale = this.i18n.locale();
    this.responseStatus(200);
    this.product.set(null);
    this.settings.set({});
    this.metadata.set({
      title: `${this.i18n.t("details")} | ATHLON`,
      description: seoCopy[currentLocale].productDescription,
      noindex: true,
    });
    this.state.set("loading");
    this.selectedImage.set(0);
    this.relatedProducts.set([]);
    this.reviews.set(null);
    this.loadSubscription = this.api
      .product(slug, locale)
      .pipe(
        switchMap((product) => {
          this.product.set(product);
          this.setProductMetadata(product, currentLocale, null);
          this.selectedImage.set(
            Math.max(
              0,
              product.images.findIndex((image) => image.primary),
            ),
          );
          this.state.set("ready");
          return forkJoin({
            settings: this.api.settings().pipe(catchError(() => of({}))),
            reviews: this.api
              .reviews(product.slug)
              .pipe(catchError(() => of(null))),
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
        next: ({ settings, related, reviews }) => {
          this.settings.set(settings);
          this.reviews.set(reviews);
          const loaded = this.product();
          if (loaded && reviews?.summary.count)
            this.setProductMetadata(loaded, currentLocale, reviews);
          this.relatedProducts.set(
            related.items
              .filter((item) => item.id !== this.product()?.id)
              .slice(0, 4),
          );
          this.state.set("ready");
        },
        error: (error: unknown) => {
          const missing =
            error instanceof HttpErrorResponse && error.status === 404;
          this.responseStatus(missing ? 404 : 503);
          this.product.set(null);
          this.metadata.set({
            title: `${missing ? this.i18n.t("notFoundTitle") : seoCopy[currentLocale].unavailableTitle} | ATHLON`,
            description: this.i18n.t(missing ? "notFoundText" : "errorText"),
            noindex: true,
          });
          this.state.set(missing ? "not-found" : "error");
        },
      });
  }

  private setProductMetadata(
    product: Product,
    locale: Locale,
    reviews: ProductReviewsData | null,
  ): void {
    this.metadata.set({
      title: `${product.name} — ${seoCopy[locale].armenia} | ATHLON`,
      description: localProductDescription(product, locale),
      locale,
      path: ["product", product.slug],
      type: "product",
      image:
        product.images.find((image) => image.primary)?.detailUrl ??
        product.images[0]?.detailUrl,
      jsonLd: [
        productSchema(product, locale, reviews),
        breadcrumbSchema([
          { name: this.i18n.t("home"), url: publicPageUrl(locale) },
          {
            name: this.i18n.t("catalog"),
            url: publicPageUrl(locale, ["catalog"]),
          },
          {
            name: product.name,
            url: publicPageUrl(locale, ["product", product.slug]),
          },
        ]),
      ],
    });
  }

  image(): string {
    const images = this.product()?.images ?? [];
    return (
      images[this.selectedImage()]?.detailUrl ??
      "/placeholders/product-placeholder.svg"
    );
  }

  onSwipeStart(event: PointerEvent): void {
    this.swipeOrigin = { x: event.clientX, y: event.clientY };
  }

  onSwipeEnd(event: PointerEvent): void {
    const origin = this.swipeOrigin;
    this.swipeOrigin = null;
    if (!origin) return;
    const deltaX = event.clientX - origin.x;
    const deltaY = event.clientY - origin.y;
    if (
      Math.abs(deltaX) < ProductPage.swipeThreshold ||
      Math.abs(deltaX) < Math.abs(deltaY) * 1.5
    ) {
      return;
    }
    const last = (this.product()?.images.length ?? 1) - 1;
    const next = this.selectedImage() + (deltaX < 0 ? 1 : -1);
    this.selectedImage.set(Math.min(Math.max(next, 0), Math.max(last, 0)));
  }

  onSwipeCancel(): void {
    this.swipeOrigin = null;
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
    return localizeCharacteristicValue(
      String(value ?? "—"),
      this.i18n.locale(),
    );
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
      flavour: ["Flavor", "Вкус", "Համ"],
      color: ["Color", "Цвет", "Գույն"],
      material: ["Material", "Материал", "Նյութ"],
      form: ["Form", "Форма", "Ձև"],
      "bcaa per serving": [
        "BCAA per serving",
        "BCAA на порцию",
        "BCAA՝ մեկ չափաբաժնում",
      ],
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
    if (product && isBasketEligible(product)) {
      this.basket.add(product);
    }
  }

  readonly quantityInBasket = computed(() => {
    const product = this.product();
    if (!product) return 0;
    return (
      this.basket.items().find((item) => item.id === product.id)?.quantity ?? 0
    );
  });

  inBasket(): boolean {
    return this.quantityInBasket() > 0;
  }

  changeQuantity(quantity: number): void {
    const product = this.product();
    if (!product || !isBasketEligible(product)) return;
    const next = Math.min(99, Math.max(0, Math.floor(quantity)));
    if (this.quantityInBasket() === 0) {
      if (next > 0) this.basket.add(product, next);
      return;
    }
    this.basket.update(product.id, next);
  }

  setQuantityFromInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    if (!Number.isFinite(value) || input.value.trim() === "") {
      input.value = String(this.quantityInBasket());
      return;
    }
    this.changeQuantity(value);
    input.value = String(this.quantityInBasket());
  }
}
