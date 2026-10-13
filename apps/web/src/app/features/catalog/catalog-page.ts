import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, ParamMap, Router, RouterLink } from "@angular/router";
import { Title } from "@angular/platform-browser";
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
import { ProductGrid } from "../../shared/product-grid/product-grid";
import { StatusPanel } from "../../shared/status-panel/status-panel";

type CatalogState = "loading" | "ready" | "empty" | "error";
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
  private readonly title = inject(Title);
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

  private load(locale: string, routeParams: ParamMap, params: ParamMap): void {
    this.loadSubscription?.unsubscribe();
    const category = routeParams.get("categorySlug") || DEFAULT_CATEGORY_SLUG;
    const q = params.get("q") || undefined;
    const parsedPage = Number(params.get("page") ?? "1");
    const page =
      Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    this.categoryFilter = category === DEFAULT_CATEGORY_SLUG ? "" : category;
    this.brandFilter = params.get("brand") ?? "";
    this.availabilityFilter = this.parseAvailability(
      params.get("availability"),
    );
    this.sortFilter = this.parseSort(params.get("sort"));
    this.minPrice = this.parsePrice(params.get("minPrice"));
    this.maxPrice = this.parsePrice(params.get("maxPrice"));
    this.state.set("loading");

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
          this.title.setTitle(`${this.heading()} | ATHLON`);
        },
        error: () => this.state.set("error"),
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
