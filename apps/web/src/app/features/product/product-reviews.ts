import { DatePipe } from "@angular/common";
import { Component, computed, inject, input } from "@angular/core";
import { ProductReviews as ProductReviewsData } from "../../core/api/catalog.models";
import { I18nService } from "../../core/i18n/i18n.service";
import { reviewsCopy } from "./product-reviews-copy";

export function starsText(rating: number): string {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

/**
 * Approved reviews for one product. There is no open form: only buyers can
 * review, through the personal link emailed after delivery.
 */
@Component({
  selector: "app-product-reviews",
  imports: [DatePipe],
  templateUrl: "./product-reviews.html",
  styleUrl: "./product-reviews.scss",
})
export class ProductReviews {
  readonly reviews = input<ProductReviewsData | null>(null);
  readonly i18n = inject(I18nService);
  readonly copy = computed(() => reviewsCopy[this.i18n.locale()]);
  readonly starsText = starsText;
}
