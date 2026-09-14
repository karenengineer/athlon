import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { forkJoin } from "rxjs";
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
  imports: [FormsModule, ProductGrid, StatusPanel],
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
  sort: "displayOrder" | "priceAsc" | "priceDesc" | "newest" = "displayOrder";

  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.route.url
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.loadFromRoute());
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.loadFromRoute());
  }

  applyFilters(): void {
    const query = this.route.snapshot.queryParamMap.get("q") || undefined;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: query,
        brand: this.brand || undefined,
        availability: this.availability || undefined,
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
    this.loadFromRoute();
  }

  private loadFromRoute(): void {
    const locale = this.route.parent?.snapshot.paramMap.get("locale") ?? "ru";
    const params = this.route.snapshot.queryParamMap;
    const category =
      this.route.snapshot.paramMap.get("categorySlug") || undefined;
    const q = params.get("q") || undefined;
    const parsedPage = Number(params.get("page") ?? "1");
    const page =
      Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const availability = params.get("availability");
    this.brand = params.get("brand") ?? "";
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

    forkJoin({
      categories: this.api.categories(locale),
      brands: this.api.brands(locale),
      products: this.api.products({
        locale,
        category,
        brand: this.brand || undefined,
        availability: this.availability || undefined,
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
}
