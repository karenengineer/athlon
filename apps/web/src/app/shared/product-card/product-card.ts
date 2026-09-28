import { CurrencyPipe } from "@angular/common";
import { Component, computed, inject, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Product } from "../../core/api/catalog.models";
import { BasketService } from "../../core/basket/basket.service";
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
  readonly basket = inject(BasketService);
  readonly quantityInBasket = computed(
    () =>
      this.basket.items().find((item) => item.id === this.product().id)
        ?.quantity ?? 0,
  );

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

  addToBasket(): void {
    this.basket.add(this.product());
  }

  incrementBasket(): void {
    this.basket.add(this.product());
  }

  decrementBasket(): void {
    this.basket.update(this.product().id, this.quantityInBasket() - 1);
  }

  inBasket(): boolean {
    return this.quantityInBasket() > 0;
  }
}
