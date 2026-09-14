import { CurrencyPipe } from "@angular/common";
import { Component, inject, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Product } from "../../core/api/catalog.models";
import { I18nService } from "../../core/i18n/i18n.service";

@Component({
  selector: "app-product-card",
  imports: [CurrencyPipe, RouterLink],
  templateUrl: "./product-card.html",
  styleUrl: "./product-card.scss",
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly eager = input(false);
  readonly i18n = inject(I18nService);

  imageUrl(): string {
    return (
      this.product().images.find((image) => image.primary)?.cardUrl ??
      this.product().images[0]?.cardUrl ??
      "/placeholders/product-placeholder.svg"
    );
  }

  availabilityLabel(): string {
    const keys = {
      IN_STOCK: "available",
      OUT_OF_STOCK: "unavailable",
      PREORDER: "preorder",
      ON_REQUEST: "onRequest",
    } as const;
    return this.i18n.t(keys[this.product().availability]);
  }
}
