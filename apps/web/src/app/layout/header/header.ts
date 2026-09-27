import {
  Component,
  ElementRef,
  HostListener,
  inject,
  viewChild,
} from "@angular/core";
import { Router, RouterLink, RouterLinkActive } from "@angular/router";
import {
  I18nService,
  Locale,
  supportedLocales,
} from "../../core/i18n/i18n.service";
import { BasketService } from "../../core/basket/basket.service";

@Component({
  selector: "app-header",
  imports: [RouterLink, RouterLinkActive],
  templateUrl: "./header.html",
  styleUrl: "./header.scss",
})
export class Header {
  readonly i18n = inject(I18nService);
  readonly basket = inject(BasketService);
  readonly locales = supportedLocales;
  readonly socialMenu = viewChild<ElementRef<HTMLDetailsElement>>("socialMenu");
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
  }

  onLocaleSelect(event: Event): void {
    const locale = (event.target as HTMLSelectElement).value as Locale;
    void this.router.navigateByUrl(this.localeHref(locale));
  }

  @HostListener("document:click", ["$event"])
  closeSocialsOnOutsideClick(event: MouseEvent): void {
    const menu = this.socialMenu()?.nativeElement;
    if (!menu?.open) return;
    if (event.target instanceof Node && menu.contains(event.target)) return;
    menu.open = false;
  }
}
