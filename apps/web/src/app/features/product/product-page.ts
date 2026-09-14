import { JsonPipe } from "@angular/common";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { Product } from "../../core/api/catalog.models";
import { I18nService } from "../../core/i18n/i18n.service";
import { StatusPanel } from "../../shared/status-panel/status-panel";

@Component({
  selector: "app-product-page",
  imports: [JsonPipe, RouterLink, StatusPanel],
  templateUrl: "./product-page.html",
  styleUrl: "./product-page.scss",
})
export class ProductPage {
  readonly i18n = inject(I18nService);
  readonly state = signal<"loading" | "ready" | "error">("loading");
  readonly product = signal<Product | null>(null);
  readonly selectedImage = signal(0);
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.load();
  }

  load(): void {
    const locale = this.route.parent?.snapshot.paramMap.get("locale") ?? "ru";
    const slug = this.route.snapshot.paramMap.get("slug") ?? "";
    this.state.set("loading");
    this.api
      .product(slug, locale)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          this.product.set(product);
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
}
