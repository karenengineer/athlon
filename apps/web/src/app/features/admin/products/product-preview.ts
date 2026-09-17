import { Component, inject, Input } from "@angular/core";
import { AdminImage, AdminProductInput } from "../shared/admin-api.types";
import { AdminI18nService } from "../shared/admin-i18n.service";

// Only server storage keys become same-origin URLs. Never accept arbitrary URLs.
export function productImageUrl(key: string): string | null {
  return /^[0-9a-f-]+-(original|thumbnail|card|detail)\.webp$/.test(key)
    ? `/api/v1/media/${key}`
    : null;
}
@Component({
  selector: "app-admin-product-preview",
  templateUrl: "./product-preview.html",
  styleUrl: "./product-preview.scss",
})
export class ProductPreview {
  readonly i18n = inject(AdminI18nService);
  @Input({ required: true }) product!: AdminProductInput;
  @Input() images: readonly AdminImage[] = [];
  readonly imageUrl = productImageUrl;
  specifications(): string {
    return JSON.stringify(this.product.characteristics, null, 2);
  }
  alt(image: AdminImage): string {
    return (
      image.translations.find(
        (value) => value.locale === this.i18n.locale().toUpperCase(),
      )?.altText ??
      image.translations[0]?.altText ??
      ""
    );
  }
}
