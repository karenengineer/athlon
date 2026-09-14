import { Component, inject, signal } from "@angular/core";
import { Router, RouterLink, RouterLinkActive } from "@angular/router";
import {
  I18nService,
  Locale,
  supportedLocales,
} from "../../core/i18n/i18n.service";

@Component({
  selector: "app-header",
  imports: [RouterLink, RouterLinkActive],
  templateUrl: "./header.html",
  styleUrl: "./header.scss",
})
export class Header {
  readonly i18n = inject(I18nService);
  readonly locales = supportedLocales;
  readonly menuOpen = signal(false);
  private readonly router = inject(Router);

  localeHref(locale: Locale): string {
    const [path, query = ""] = this.router.url.split("?");
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) parts.push(locale);
    else parts[0] = locale;
    return `/${parts.join("/")}${query ? `?${query}` : ""}`;
  }

  search(value: string): void {
    const query = value.trim();
    if (!query) return;
    void this.router.navigate(["/", this.i18n.locale(), "search"], {
      queryParams: { q: query },
    });
    this.menuOpen.set(false);
  }
}
