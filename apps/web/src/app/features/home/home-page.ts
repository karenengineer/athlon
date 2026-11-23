import { Component, computed, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  catchError,
  distinctUntilChanged,
  map,
  of,
  Subscription,
  timeout,
} from "rxjs";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { Product } from "../../core/api/catalog.models";
import { I18nService } from "../../core/i18n/i18n.service";
import { INSTAGRAM_PROFILE_URL } from "../../core/social-links";
import { ProductGrid } from "../../shared/product-grid/product-grid";
import { StatusPanel } from "../../shared/status-panel/status-panel";
import {
  createPageMetadata,
  createPageResponseStatus,
} from "../../core/seo/page-metadata";
import { guideSlugs } from "../guides/guide-slugs";
import { guides, guidesCopy } from "../guides/guides-content";
import { homeContent } from "./home-content";
import {
  bandsCategorySlug,
  HomeBandSuggestions,
  pickBandSuggestions,
} from "./home-band-suggestions";
import { HomeShowcase } from "./home-showcase";
import {
  seoCopy,
  storeSchema,
  websiteSchema,
} from "../../core/seo/seo-content";

type HomeState = "loading" | "ready" | "empty" | "error";
type ShowcaseCategory = "sports-nutrition" | "accessories";

@Component({
  selector: "app-home-page",
  imports: [RouterLink, ProductGrid, StatusPanel, HomeBandSuggestions],
  templateUrl: "./home-page.html",
  styleUrl: "./home-page.scss",
})
export class HomePage {
  readonly i18n = inject(I18nService);
  readonly content = computed(() => homeContent[this.i18n.locale()]);
  readonly guideLinks = computed(() => ({
    heading: guidesCopy[this.i18n.locale()].related,
    items: guideSlugs.map((slug) => ({
      slug,
      heading: guides[slug].copy[this.i18n.locale()].heading,
    })),
  }));
  readonly instagramUrl = INSTAGRAM_PROFILE_URL;
  readonly communityPhotos = [
    {
      src: "/community/trec-creatine.webp",
      srcset:
        "/community/trec-creatine-480.webp 480w, /community/trec-creatine.webp 960w",
      alt: "communityCreatineAlt",
    },
    {
      src: "/community/training.webp",
      srcset:
        "/community/training-480.webp 480w, /community/training.webp 960w",
      alt: "communityTrainingAlt",
    },
    {
      src: "/community/trec-chocolate-whey.webp",
      srcset:
        "/community/trec-chocolate-whey-480.webp 480w, /community/trec-chocolate-whey.webp 960w",
      alt: "communityWheyAlt",
    },
  ] as const;
  readonly state = signal<HomeState>("loading");
  readonly products = signal<Product[]>([]);
  readonly bands = signal<Product[]>([]);
  readonly selectedCategory = signal<ShowcaseCategory>("sports-nutrition");
  readonly showingAccessories = computed(
    () => this.selectedCategory() === "accessories",
  );
  private readonly accessoryState = signal<HomeState | "idle">("idle");
  private readonly accessories = signal<Product[]>([]);
  readonly showcaseState = computed(() =>
    this.showingAccessories() ? this.accessoryState() : this.state(),
  );
  readonly showcaseProducts = computed(() =>
    this.showingAccessories() ? this.accessories() : this.products(),
  );
  readonly showcaseBands = computed(() =>
    this.showingAccessories() ? [] : this.bands(),
  );
  readonly showcaseCatalogLink = computed(() => {
    const catalog = ["/", this.i18n.locale(), "catalog"];
    return this.showingAccessories() ? [...catalog, "accessories"] : catalog;
  });
  private readonly showcase = inject(HomeShowcase);
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly metadata = createPageMetadata();
  private readonly responseStatus = createPageResponseStatus();
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;
  private bandsSubscription?: Subscription;
  private accessoriesSubscription?: Subscription;

  constructor() {
    this.route.parent?.paramMap
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.load(params.get("locale") ?? "hy"));
  }

  load(
    locale = this.route.parent?.snapshot.paramMap.get("locale") ?? "hy",
  ): void {
    this.loadSubscription?.unsubscribe();
    this.accessoriesSubscription?.unsubscribe();
    this.accessories.set([]);
    this.accessoryState.set("idle");
    this.i18n.setLocale(locale);
    const currentLocale = this.i18n.locale();
    if (this.showingAccessories()) this.loadAccessories();
    this.responseStatus(200);
    this.metadata.set({
      title: seoCopy[currentLocale].homeTitle,
      description: seoCopy[currentLocale].homeDescription,
      locale: currentLocale,
      path: [],
      jsonLd: [storeSchema(currentLocale), websiteSchema(currentLocale)],
    });
    this.state.set("loading");
    this.loadBands(locale);
    this.loadSubscription = this.showcase
      .products(locale)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => {
          this.products.set(products);
          this.state.set(products.length ? "ready" : "empty");
        },
        error: () => {
          this.responseStatus(503);
          this.metadata.set({
            title: seoCopy[currentLocale].homeTitle,
            description: seoCopy[currentLocale].homeDescription,
            noindex: true,
          });
          this.state.set("error");
        },
      });
  }

  selectCategory(category: ShowcaseCategory): void {
    this.selectedCategory.set(category);
    if (category === "accessories" && this.accessoryState() === "idle") {
      this.loadAccessories();
    }
  }

  retryShowcase(): void {
    if (this.showingAccessories()) this.loadAccessories();
    else this.load();
  }

  private loadAccessories(): void {
    this.accessoriesSubscription?.unsubscribe();
    this.accessoryState.set("loading");
    this.accessoriesSubscription = this.api
      .products({
        locale: this.i18n.locale(),
        category: "accessories",
        sort: "displayOrder",
        page: 1,
        pageSize: 8,
      })
      .pipe(timeout({ first: 5000 }), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ items }) => {
          this.accessories.set(items);
          this.accessoryState.set(items.length ? "ready" : "empty");
        },
        error: () => this.accessoryState.set("error"),
      });
  }

  private loadBands(locale: string): void {
    this.bandsSubscription?.unsubscribe();
    this.bands.set([]);
    // Suggestions are optional: a slow or failed request never blocks the showcase.
    this.bandsSubscription = this.api
      .products({
        locale,
        category: bandsCategorySlug,
        sort: "displayOrder",
        page: 1,
        pageSize: 12,
      })
      .pipe(
        timeout({ first: 1500 }),
        map(({ items }) => pickBandSuggestions(items)),
        catchError(() => of([])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((bands) => this.bands.set(bands));
  }
}
