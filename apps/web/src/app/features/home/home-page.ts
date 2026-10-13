import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { distinctUntilChanged, Subscription } from "rxjs";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Title } from "@angular/platform-browser";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { Product } from "../../core/api/catalog.models";
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
  readonly products = signal<Product[]>([]);
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;

  constructor() {
    this.route.parent?.paramMap
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.load(params.get("locale") ?? "hy"));
  }

  load(locale = this.route.parent?.snapshot.paramMap.get("locale") ?? "hy"): void {
    this.loadSubscription?.unsubscribe();
    this.i18n.setLocale(locale);
    this.title.setTitle(`${this.i18n.t("home")} | ATHLON`);
    this.state.set("loading");
    this.loadSubscription = this.api
      .products({
        locale,
        category: "sports-nutrition",
        sort: "displayOrder",
        page: 1,
        pageSize: 8,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => {
          this.products.set(products.items);
          this.state.set(products.items.length ? "ready" : "empty");
        },
        error: () => this.state.set("error"),
      });
  }
}
