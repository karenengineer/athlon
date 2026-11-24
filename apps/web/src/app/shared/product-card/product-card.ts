import { CurrencyPipe } from "@angular/common";
import { Component, computed, inject, input } from "@angular/core";
import { ProductVideoPreview } from "./product-video-preview";
import { RouterLink } from "@angular/router";
import { Product } from "../../core/api/catalog.models";
import {
  BasketService,
  isBasketEligible,
} from "../../core/basket/basket.service";
import { I18nService } from "../../core/i18n/i18n.service";
import { imageAlt } from "../../core/seo/image-alt";

@Component({
  selector: "app-product-card",
  imports: [CurrencyPipe, RouterLink, ProductVideoPreview],
  templateUrl: "./product-card.html",
  styleUrl: "./product-card.scss",
})
export class ProductCard {
  readonly product = input.required<Product>();
  readonly canAddToBasket = computed(() => isBasketEligible(this.product()));
  readonly eager = input(false);
  readonly i18n = inject(I18nService);
  readonly basket = inject(BasketService);
  readonly quantityInBasket = computed(
    () =>
      this.basket.items().find((item) => item.id === this.product().id)
        ?.quantity ?? 0,
  );
  readonly nameParts = computed(() => {
    const name = this.product().name;
    const separator = name.lastIndexOf(" — ");
    return separator < 0
      ? { base: name, variant: "" }
      : {
          base: name.slice(0, separator),
          variant: name.slice(separator + 3),
        };
  });

  imageUrl(): string {
    return (
      this.product().images.find((image) => image.primary)?.cardUrl ??
      this.product().images[0]?.cardUrl ??
      "/placeholders/product-placeholder.svg"
    );
  }

  imageAlt(): string {
    const image =
      this.product().images.find((item) => item.primary) ??
      this.product().images[0];
    return imageAlt(image?.alt, this.product().name, this.i18n.locale());
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
    if (!this.canAddToBasket()) return;
    this.basket.add(this.product());
  }

  incrementBasket(): void {
    if (!this.canAddToBasket()) return;
    this.basket.add(this.product());
  }

  decrementBasket(): void {
    this.basket.update(this.product().id, this.quantityInBasket() - 1);
  }

  inBasket(): boolean {
    return this.quantityInBasket() > 0;
  }
}
