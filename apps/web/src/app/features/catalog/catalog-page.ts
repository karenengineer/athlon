import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, ParamMap, Router, RouterLink } from "@angular/router";
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  forkJoin,
  map,
  Observable,
  shareReplay,
  Subscription,
  of,
} from "rxjs";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import {
  Availability,
  Brand,
  Category,
  Product,
  ProductPageResponse,
  ProductQuery,
} from "../../core/api/catalog.models";
import { I18nService } from "../../core/i18n/i18n.service";
import {
  createPageMetadata,
  createPageResponseStatus,
  publicPageUrl,
} from "../../core/seo/page-metadata";
import { breadcrumbSchema, seoCopy } from "../../core/seo/seo-content";
import { ProductGrid } from "../../shared/product-grid/product-grid";
import { StatusPanel } from "../../shared/status-panel/status-panel";
import {
  catalogContentCopy,
  categoryGuidance,
  categoryIntroduction,
} from "./category-content";

type CatalogState = "loading" | "ready" | "empty" | "error" | "not-found";
type CategoryOption = Pick<Category, "id" | "slug" | "name" | "displayOrder">;
const DEFAULT_CATEGORY_SLUG = "sports-nutrition";

@Component({
  selector: "app-catalog-page",
  imports: [FormsModule, RouterLink, ProductGrid, StatusPanel],
  templateUrl: "./catalog-page.html",
  styleUrl: "./catalog-page.scss",
})
export class CatalogPage {
  readonly i18n = inject(I18nService);
  readonly state = signal<CatalogState>("loading");
  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly brands = signal<Brand[]>([]);
  readonly selectedCategory = signal<Omit<Category, "children"> | null>(null);
  readonly introduction = signal("");
  readonly meta = signal<ProductPageResponse["meta"]>({
    page: 1,
    pageSize: 24,
    total: 0,
    totalPages: 0,
  });
  categoryFilter = "";
  minPrice: number | null = null;
  maxPrice: number | null = null;
  brandFilter = "";
  availabilityFilter: Availability | "" = "";
  sortFilter: NonNullable<ProductQuery["sort"]> = "displayOrder";

  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pageMetadata = createPageMetadata();
  private readonly responseStatus = createPageResponseStatus();
  private catalogStatus: 200 | 404 | 503 = 200;
  private invalidPage = false;
  private seoQuery: Record<string, string> = {};
  private nonindexableQuery = false;
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;
  private readonly brandsByLocale = new Map<string, Observable<Brand[]>>();

  constructor() {
    combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
      this.route.parent!.paramMap,
    ])
      .pipe(
        map(([routeParams, queryParams, parentParams]) => ({
          routeParams,
          queryParams,
          locale: parentParams.get("locale") ?? "hy",
          key: `${parentParams.get("locale")}|${routeParams.get("categorySlug")}|${queryParams.keys
            .sort()
            .map((key) => `${key}=${queryParams.get(key)}`)
            .join("&")}`,
        })),
        distinctUntilChanged(
          (previous, current) => previous.key === current.key,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ routeParams, queryParams, locale }) =>
        this.load(locale, routeParams, queryParams),
      );
  }

  applyFilters(): void {
    const query = this.route.snapshot.queryParamMap.get("q") || undefined;
    const category = this.categoryFilter || DEFAULT_CATEGORY_SLUG;
    void this.router.navigate(["/", this.i18n.locale(), "catalog", category], {
      queryParams: {
        q: query,
        brand: this.brandFilter || undefined,
        availability: this.availabilityFilter || undefined,
        minPrice: this.minPrice ?? undefined,
        maxPrice: this.maxPrice ?? undefined,
        sort: this.sortFilter === "displayOrder" ? undefined : this.sortFilter,
      },
    });
  }

  resetFilters(): void {
    const query = this.route.snapshot.queryParamMap.get("q") || undefined;
    void this.router.navigate(
      ["/", this.i18n.locale(), "catalog", DEFAULT_CATEGORY_SLUG],
      { queryParams: { q: query } },
    );
  }

  goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: "merge",
    });
  }

  paginationQuery(page: number): { page: number | null } {
    return { page: page === 1 ? null : page };
  }

  retry(): void {
    this.load(
      this.route.parent?.snapshot.paramMap.get("locale") ?? "hy",
      this.route.snapshot.paramMap,
      this.route.snapshot.queryParamMap,
    );
  }

  heading(): string {
    const query = this.route.snapshot.queryParamMap.get("q");
    if (query) return `${this.i18n.t("searchResults")}: “${query}”`;
    const category = this.route.snapshot.paramMap.get("categorySlug");
    return this.findCategoryName(category) ?? this.i18n.t("catalog");
  }

  activeCategorySlug(): string | null {
    return this.route.snapshot.paramMap.get("categorySlug");
  }

  hasActiveFilters(): boolean {
    return (
      Boolean(this.route.snapshot.queryParamMap.get("q")) ||
      this.minPrice !== null ||
      this.maxPrice !== null ||
      Boolean(this.categoryFilter) ||
      Boolean(this.brandFilter) ||
      Boolean(this.availabilityFilter) ||
      this.sortFilter !== "displayOrder"
    );
  }

  categoryOptions(): CategoryOption[] {
    const sportsNutrition = this.categories().find(
      (item) => item.slug === DEFAULT_CATEGORY_SLUG,
    );
    const options = sportsNutrition?.children.length
      ? sportsNutrition.children
      : this.categories().filter((item) => item.slug !== DEFAULT_CATEGORY_SLUG);

    return [...options].sort((left, right) => {
      const order = left.displayOrder - right.displayOrder;
      return order || left.name.localeCompare(right.name);
    });
  }

  guidance(): string {
    return categoryGuidance(this.selectedCategory(), this.i18n.locale());
  }

  contentCopy() {
    return catalogContentCopy[this.i18n.locale()];
  }

  publishedCategories(): Omit<Category, "children">[] {
    return this.categories().flatMap((category) => [
      category,
      ...category.children,
    ]);
  }

  relatedCategories(): Omit<Category, "children">[] {
    return this.publishedCategories().filter(
      (category) => category.slug !== this.selectedCategory()?.slug,
    );
  }

  private load(locale: string, routeParams: ParamMap, params: ParamMap): void {
    this.loadSubscription?.unsubscribe();
    this.i18n.setLocale(locale);
    const category = routeParams.get("categorySlug") || DEFAULT_CATEGORY_SLUG;
    const q = params.get("q") || undefined;
    const parsedPage = Number(params.get("page") ?? "1");
    const page =
      Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    this.catalogStatus = 200;
    this.responseStatus(200);
    this.invalidPage =
      !/^\d+$/.test(params.get("page") ?? "1") ||
      !Number.isSafeInteger(parsedPage) ||
      parsedPage < 1 ||
      params.getAll("page").length > 1;
    this.seoQuery = {};
    this.nonindexableQuery = false;
    for (const key of params.keys) {
      if (/^(utm_.+|gclid|fbclid|msclkid)$/i.test(key)) continue;
      if (key === "page" && !this.invalidPage && parsedPage === 1) continue;
      this.seoQuery[key] = params.get(key) ?? "";
      if (key !== "page") this.nonindexableQuery = true;
    }
    this.categoryFilter = category === DEFAULT_CATEGORY_SLUG ? "" : category;
    this.brandFilter = params.get("brand") ?? "";
    this.availabilityFilter = this.parseAvailability(
      params.get("availability"),
    );
    this.sortFilter = this.parseSort(params.get("sort"));
    this.minPrice = this.parsePrice(params.get("minPrice"));
    this.maxPrice = this.parsePrice(params.get("maxPrice"));
    this.state.set("loading");
    this.categories.set([]);
    this.selectedCategory.set(null);
    this.introduction.set("");
    this.updateMetadata(q);

    this.loadSubscription = forkJoin({
      categories: this.api.categories(locale),
      brands: this.brandsForLocale(locale),
      products: this.api.products({
        locale,
        category,
        brand: this.brandFilter || undefined,
        availability: this.availabilityFilter || undefined,
        minPrice: this.minPrice ?? undefined,
        maxPrice: this.maxPrice ?? undefined,
        sort: this.sortFilter,
        page,
        pageSize: 24,
        q,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.categories.set(response.categories);
          this.brands.set(response.brands);
          this.products.set(response.products.items);
          this.meta.set(response.products.meta);
          this.state.set(response.products.items.length ? "ready" : "empty");
          const selected = this.publishedCategories().find(
            (item) => item.slug === category,
          );
          if (routeParams.get("categorySlug") && !selected) {
            this.catalogStatus = 404;
            this.responseStatus(404);
            this.products.set([]);
            this.state.set("not-found");
          }
          this.invalidPage ||=
            page > Math.max(1, response.products.meta.totalPages);
          if (
            !q &&
            this.route.snapshot.routeConfig?.path !== "search" &&
            selected
          ) {
            this.selectedCategory.set(selected);
            this.introduction.set(
              categoryIntroduction(selected, this.i18n.locale()),
            );
          }
          this.updateMetadata(q);
        },
        error: () => {
          this.catalogStatus = 503;
          this.responseStatus(503);
          this.state.set("error");
          this.updateMetadata(q);
        },
      });
  }

  private updateMetadata(query: string | undefined): void {
    const locale = this.i18n.locale();
    const copy = seoCopy[locale];
    const isSearch =
      Boolean(query) || this.route.snapshot.routeConfig?.path === "search";
    const path =
      isSearch && this.route.snapshot.routeConfig?.path === "search"
        ? ["search"]
        : [
            "catalog",
            ...(this.activeCategorySlug() ? [this.activeCategorySlug()!] : []),
          ];
    const noindex =
      this.state() === "loading" ||
      this.catalogStatus !== 200 ||
      isSearch ||
      this.nonindexableQuery ||
      this.invalidPage;
    const page = this.meta().page;
    const label = this.selectedCategory()?.name ?? this.i18n.t("catalog");
    const pageSuffix =
      !this.invalidPage && page > 1 ? ` — ${copy.page} ${page}` : "";
    const breadcrumbs = [
      { name: this.i18n.t("home"), url: publicPageUrl(locale) },
      { name: this.i18n.t("catalog"), url: publicPageUrl(locale, ["catalog"]) },
      ...(this.activeCategorySlug() && this.selectedCategory()
        ? [{ name: label, url: publicPageUrl(locale, path) }]
        : []),
    ];
    if (this.catalogStatus === 404) {
      this.pageMetadata.set({
        title: `${this.i18n.t("notFoundTitle")} | ATHLON`,
        description: this.i18n.t("notFoundText"),
        noindex: true,
      });
      return;
    }
    this.pageMetadata.set({
      title: `${query ? `${this.i18n.t("searchResults")}: “${query}”` : `${label} — ${copy.armenia}`}${pageSuffix} | ATHLON`,
      description: isSearch
        ? this.contentCopy().searchDescription
        : `${this.introduction() || this.contentCopy().description} ${copy.delivery}`,
      locale,
      ...(this.state() !== "loading" && this.catalogStatus === 200
        ? { path, query: this.seoQuery }
        : {}),
      noindex,
      jsonLd: [breadcrumbSchema(breadcrumbs)],
    });
  }

  private parsePrice(value: string | null): number | null {
    if (value === null || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  private brandsForLocale(locale: string): Observable<Brand[]> {
    let brands = this.brandsByLocale.get(locale);
    if (!brands) {
      brands = this.api.brands(locale).pipe(
        catchError(() => {
          if (this.brandsByLocale.get(locale) === brands) {
            this.brandsByLocale.delete(locale);
          }
          return of([]);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.brandsByLocale.set(locale, brands);
    }
    return brands;
  }

  private parseAvailability(value: string | null): Availability | "" {
    return value === "IN_STOCK" ||
      value === "OUT_OF_STOCK" ||
      value === "PREORDER" ||
      value === "ON_REQUEST"
      ? value
      : "";
  }

  private parseSort(value: string | null): NonNullable<ProductQuery["sort"]> {
    return value === "priceAsc" || value === "priceDesc" || value === "newest"
      ? value
      : "displayOrder";
  }

  private findCategoryName(slug: string | null): string | undefined {
    if (!slug) return undefined;
    for (const category of this.categories()) {
      if (category.slug === slug) return category.name;
      const child = category.children.find((item) => item.slug === slug);
      if (child) return child.name;
    }
    return undefined;
  }
}
