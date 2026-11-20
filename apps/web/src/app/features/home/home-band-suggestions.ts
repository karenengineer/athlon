import { CurrencyPipe } from "@angular/common";
import { Component, computed, inject, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Product } from "../../core/api/catalog.models";
import { I18nService } from "../../core/i18n/i18n.service";

export const bandsCategorySlug = "resistance-bands";

type BandUse = "bandsUseStrength" | "bandsUseWarmUp";

const bandUseByColor: Record<string, BandUse> = {
  purple: "bandsUseStrength",
  yellow: "bandsUseWarmUp",
};

const resistanceRange =
  /(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)\s*(kg|кг|կգ)/i;

/**
 * Picks the homepage band suggestions: ATHLON's choice (featured) first,
 * then the light warm-up band, falling back to the next listed band.
 */
export function pickBandSuggestions(items: Product[]): Product[] {
  const eligible = items.filter(
    (product) =>
      product.category.slug === bandsCategorySlug &&
      product.availability !== "OUT_OF_STOCK",
  );
  const choice = eligible.find((product) => product.featured) ?? eligible[0];
  if (!choice) return [];
  const rest = eligible.filter((product) => product !== choice);
  const warmUp =
    rest.find((product) => product.slug.startsWith("yellow-")) ?? rest[0];
  return warmUp ? [choice, warmUp] : [choice];
}

@Component({
  selector: "app-home-band-suggestions",
  imports: [CurrencyPipe, RouterLink],
  templateUrl: "./home-band-suggestions.html",
  styleUrl: "./home-band-suggestions.scss",
  host: {
    "[class.layout-sidebar]": "layout() === 'sidebar'",
    "[class.layout-inline]": "layout() === 'inline'",
  },
})
export class HomeBandSuggestions {
  readonly products = input.required<Product[]>();
  readonly layout = input<"sidebar" | "inline">("sidebar");
  readonly i18n = inject(I18nService);
  readonly bandsCategorySlug = bandsCategorySlug;
  readonly headingId = computed(() => `home-bands-title-${this.layout()}`);

  imageUrl(product: Product): string {
    return (
      product.images.find((image) => image.primary)?.cardUrl ??
      product.images[0]?.cardUrl ??
      "/placeholders/product-placeholder.svg"
    );
  }

  imageAlt(product: Product): string {
    return (
      product.images.find((image) => image.primary)?.alt ??
      product.images[0]?.alt ??
      product.name
    );
  }

  useLabel(product: Product): string {
    const key = bandUseByColor[product.slug.split("-")[0]];
    if (key) return this.i18n.t(key);
    const separator = product.name.lastIndexOf(" — ");
    return separator < 0 ? product.name : product.name.slice(0, separator);
  }

  resistance(product: Product): string {
    const match = resistanceRange.exec(product.name);
    return match ? `${match[1]}–${match[2]} ${match[3]}` : "";
  }
}
