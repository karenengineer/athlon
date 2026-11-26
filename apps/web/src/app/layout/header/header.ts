import { NgTemplateOutlet } from "@angular/common";
import { Component, inject, Injector, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
} from "@angular/router";
import { catchError, EMPTY, of, Subject, switchMap, timer } from "rxjs";
import {
  I18nService,
  Locale,
  supportedLocales,
} from "../../core/i18n/i18n.service";
import { informationNavigation } from "../../core/i18n/information-navigation";
import { BasketService } from "../../core/basket/basket.service";
import { BasketBumpDirective } from "../../shared/basket-bump/basket-bump.directive";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { ProductSearchSuggestion } from "../../core/api/catalog.models";

@Component({
  selector: "app-header",
  imports: [
    RouterLink,
    RouterLinkActive,
    BasketBumpDirective,
    NgTemplateOutlet,
  ],
  templateUrl: "./header.html",
  styleUrl: "./header.scss",
})
export class Header {
  readonly i18n = inject(I18nService);
  readonly basket = inject(BasketService);
  readonly locales = supportedLocales;
  readonly information = informationNavigation;
  readonly activeSearchId = signal("");
  readonly suggestions = signal<ProductSearchSuggestion[]>([]);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly suggestionQuery = new Subject<{
    query: string;
    locale: Locale;
  } | null>();

  constructor() {
    this.suggestionQuery
      .pipe(
        switchMap((request) =>
          request
            ? timer(250).pipe(
                switchMap(() =>
                  this.injector
                    .get(CatalogApiService)
                    .searchSuggestions(request.query, request.locale),
                ),
                catchError(() => of([])),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((items) => this.suggestions.set(items));
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) this.closeSuggestions();
    });
  }

  localeHref(locale: Locale): string {
    const [path, query = ""] = this.router.url.split("?");
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) parts.push(locale);
    else parts[0] = locale;
    return `/${parts.join("/")}${query ? `?${query}` : ""}`;
  }

  search(value: string): void {
    this.closeSuggestions();
    const query = value.trim();
    if (!query) return;
    void this.router.navigate(["/", this.i18n.locale(), "search"], {
      queryParams: { q: query },
    });
  }

  suggest(input: HTMLInputElement): void {
    this.closeSuggestions();
    const query = input.value.trim();
    if (query.length < 2 || query.length > 120) return;
    this.activeSearchId.set(input.id);
    this.suggestionQuery.next({ query, locale: this.i18n.locale() });
  }

  closeSuggestions(): void {
    this.suggestionQuery.next(null);
    this.activeSearchId.set("");
    this.suggestions.set([]);
  }

  onSearchFocusOut(event: FocusEvent): void {
    const form = event.currentTarget as HTMLFormElement;
    if (!form.contains(event.relatedTarget as Node | null))
      this.closeSuggestions();
  }

  onSearchEscape(event: Event, input: HTMLInputElement): void {
    if (!this.activeSearchId()) return;
    event.preventDefault();
    if (event.target !== input) input.focus();
    this.closeSuggestions();
  }

  onLocaleSelect(event: Event): void {
    const locale = (event.target as HTMLSelectElement).value as Locale;
    void this.router.navigateByUrl(this.localeHref(locale));
  }
}
