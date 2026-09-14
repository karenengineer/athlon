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
  Availability,
  Brand,
  Category,
  Product,
  ProductPageResponse,
} from "../../core/api/catalog.models";
import { I18nService } from "../../core/i18n/i18n.service";
import { ProductGrid } from "../../shared/product-grid/product-grid";
import { StatusPanel } from "../../shared/status-panel/status-panel";

type CatalogState = "loading" | "ready" | "empty" | "error";

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
  brand = "";
  availability: "" | Availability = "";
  minPrice: number | null = null;
  maxPrice: number | null = null;
  sort: "displayOrder" | "priceAsc" | "priceDesc" | "newest" = "displayOrder";

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
          locale: parentParams.get("locale") ?? "ru",
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
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: query,
        brand: this.brand || undefined,
        availability: this.availability || undefined,
        minPrice: this.minPrice ?? undefined,
        maxPrice: this.maxPrice ?? undefined,
        sort: this.sort === "displayOrder" ? undefined : this.sort,
        page: undefined,
      },
      queryParamsHandling: "merge",
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
      this.route.parent?.snapshot.paramMap.get("locale") ?? "ru",
      this.route.snapshot.paramMap,
      this.route.snapshot.queryParamMap,
    );
  }

  heading(): string {
    const query = this.route.snapshot.queryParamMap.get("q");
    if (query) return `${this.i18n.t("searchResults")}: “${query}”`;
    const category = this.route.snapshot.paramMap.get("categorySlug");
    return (
      this.categories().find((item) => item.slug === category)?.name ??
      this.i18n.t("catalog")
    );
  }

  activeCategorySlug(): string | null {
    return this.route.snapshot.paramMap.get("categorySlug");
  }

  private load(locale: string, routeParams: ParamMap, params: ParamMap): void {
    this.loadSubscription?.unsubscribe();
    const category = routeParams.get("categorySlug") || undefined;
    const q = params.get("q") || undefined;
    const parsedPage = Number(params.get("page") ?? "1");
    const page =
      Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const availability = params.get("availability");
    this.brand = params.get("brand") ?? "";
    this.minPrice = this.parsePrice(params.get("minPrice"));
    this.maxPrice = this.parsePrice(params.get("maxPrice"));
    this.availability = [
      "IN_STOCK",
      "OUT_OF_STOCK",
      "PREORDER",
      "ON_REQUEST",
    ].includes(availability ?? "")
      ? (availability as Availability)
      : "";
    const sort = params.get("sort");
    this.sort = ["priceAsc", "priceDesc", "newest"].includes(sort ?? "")
      ? (sort as typeof this.sort)
      : "displayOrder";
    this.state.set("loading");

    this.loadSubscription = forkJoin({
      categories: this.api.categories(locale),
      brands: this.api.brands(locale),
      products: this.api.products({
        locale,
        category,
        brand: this.brand || undefined,
        availability: this.availability || undefined,
        minPrice: this.minPrice ?? undefined,
        maxPrice: this.maxPrice ?? undefined,
        sort: this.sort,
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
        },
        error: () => this.state.set("error"),
      });
  }

  private parsePrice(value: string | null): number | null {
    if (value === null || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
}
