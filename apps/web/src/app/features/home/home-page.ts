import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { forkJoin } from "rxjs";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { Category, Product } from "../../core/api/catalog.models";
import { I18nService } from "../../core/i18n/i18n.service";
import { ProductGrid } from "../../shared/product-grid/product-grid";
import { StatusPanel } from "../../shared/status-panel/status-panel";

type HomeState = "loading" | "ready" | "empty" | "error";

@Component({
  selector: "app-home-page",
  imports: [RouterLink, ProductGrid, StatusPanel],
  templateUrl: "./home-page.html",
  styleUrl: "./home-page.scss",
})
export class HomePage {
  readonly i18n = inject(I18nService);
  readonly state = signal<HomeState>("loading");
  readonly categories = signal<Category[]>([]);
  readonly products = signal<Product[]>([]);
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.load();
  }

  load(): void {
    const locale = this.route.parent?.snapshot.paramMap.get("locale") ?? "hy";
    this.i18n.setLocale(locale);
    this.state.set("loading");
    forkJoin({
      categories: this.api.categories(locale),
      products: this.api.products({
        locale,
        category: "sports-nutrition",
        sort: "displayOrder",
        page: 1,
        pageSize: 8,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ categories, products }) => {
          this.categories.set(categories.slice(0, 2));
          this.products.set(products.items);
          this.state.set(products.items.length ? "ready" : "empty");
        },
        error: () => this.state.set("error"),
      });
  }
}
