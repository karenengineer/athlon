import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, ParamMap, Router, RouterLink } from "@angular/router";
import {
  combineLatest,
  distinctUntilChanged,
  forkJoin,
  map,
  Subscription,
} from "rxjs";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import {
  Category,
  Product,
  ProductPageResponse,
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
  readonly meta = signal<ProductPageResponse["meta"]>({
    page: 1,
    pageSize: 24,
    total: 0,
    totalPages: 0,
  });
  categoryFilter = "";
  minPrice: number | null = null;
  maxPrice: number | null = null;

  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;

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
        minPrice: this.minPrice ?? undefined,
        maxPrice: this.maxPrice ?? undefined,
      },
    });
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
    this.minPrice = this.parsePrice(params.get("minPrice"));
    this.maxPrice = this.parsePrice(params.get("maxPrice"));
    this.state.set("loading");

    this.loadSubscription = forkJoin({
      categories: this.api.categories(locale),
      products: this.api.products({
        locale,
        category,
        minPrice: this.minPrice ?? undefined,
        maxPrice: this.maxPrice ?? undefined,
        page,
        pageSize: 24,
        q,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.categories.set(response.categories);
          this.products.set(response.products.items);
          this.meta.set(response.products.meta);
          this.state.set(response.products.items.length ? "ready" : "empty");
        },
        error: () => this.state.set("error"),
      });
  }

  private parsePrice(value: string | null): number | null {
    if (value === null || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
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
