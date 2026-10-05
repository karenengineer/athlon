import { CurrencyPipe } from "@angular/common";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { catchError, of } from "rxjs";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { PublicSettings } from "../../core/api/catalog.models";
import { BasketService } from "../../core/basket/basket.service";
import { I18nService } from "../../core/i18n/i18n.service";
import { INSTAGRAM_PROFILE_URL } from "../../core/social-links";

@Component({
  selector: "app-basket-page",
  imports: [CurrencyPipe, RouterLink],
  templateUrl: "./basket-page.html",
  styleUrl: "./basket-page.scss",
})
export class BasketPage {
  readonly basket = inject(BasketService);
  readonly i18n = inject(I18nService);
  readonly copied = signal(false);
  readonly settings = signal<PublicSettings>({});
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.i18n.setLocale(this.route.parent?.snapshot.paramMap.get("locale"));
    this.api
      .settings()
      .pipe(
        catchError(() => of({})),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((settings) => this.settings.set(settings));
  }

  update(id: string, value: string): void {
    this.basket.update(id, Number(value));
  }

  async copyAndOpenInstagram(): Promise<void> {
    const text = this.basket.orderText(this.i18n.locale());
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
    this.copied.set(true);
    if (typeof window !== "undefined") {
      window.open(this.instagramUrl(), "_blank", "noopener,noreferrer");
    }
  }

  instagramUrl(): string {
    const instagram = this.settings().instagram?.trim();
    const profileUrl = instagram?.startsWith("http")
      ? instagram
      : instagram
        ? `https://www.instagram.com/${instagram.replace(/^@/, "")}/`
        : INSTAGRAM_PROFILE_URL;
    try {
      const profile = new URL(profileUrl);
      const username = profile.pathname.split("/").filter(Boolean)[0];
      if (
        ["instagram.com", "www.instagram.com"].includes(profile.hostname) &&
        username
      ) {
        return `https://ig.me/m/${username}`;
      }
    } catch {
      // Ignore an invalid configured profile URL and use the ATHLON account.
    }
    return "https://ig.me/m/__athlon__";
  }
}
