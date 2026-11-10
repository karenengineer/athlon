import { CurrencyPipe } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import {
  catchError,
  forkJoin,
  from,
  map,
  mergeMap,
  Observable,
  of,
  switchMap,
  toArray,
} from "rxjs";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { Product } from "../../core/api/catalog.models";
import { BasketItem, BasketService } from "../../core/basket/basket.service";
import { I18nService, Locale } from "../../core/i18n/i18n.service";

type BasketMember = Pick<BasketItem, "id" | "slug">;
const preferredTypes = ["protein", "creatine", "pre-workout"];
const maxCategoryQueries = 8;
const maxSuggestions = 4;

function isCatalogSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

@Component({
  selector: "app-basket-suggestions",
  imports: [CurrencyPipe, RouterLink],
  templateUrl: "./basket-suggestions.html",
  styleUrl: "./basket-suggestions.scss",
})
export class BasketSuggestions {
  readonly i18n = inject(I18nService);
  private readonly basket = inject(BasketService);
  private readonly api = inject(CatalogApiService);
  private readonly members = computed(
    () => this.basket.items().map(({ id, slug }) => ({ id, slug })),
    {
      equal: (previous, current) =>
        previous.length === current.length &&
        previous.every(
          (item, index) =>
            item.id === current[index].id && item.slug === current[index].slug,
        ),
    },
  );
  private readonly request = computed(() => ({
    items: this.members(),
    locale: this.i18n.locale(),
  }));
  private readonly result = toSignal(
    toObservable(this.request).pipe(
      switchMap((request) =>
        this.loadSuggestions(request.items, request.locale).pipe(
          map((products) => ({ request, products })),
        ),
      ),
    ),
  );
  readonly products = computed(() => {
    const result = this.result();
    if (result?.request !== this.request()) return [];
    return result.products.map((product) => ({
      ...product,
      imageUrl:
        product.images.find((image) => image.primary)?.thumbnailUrl ??
        product.images[0]?.thumbnailUrl ??
        "/placeholders/product-placeholder.svg",
    }));
  });

  private loadSuggestions(items: BasketMember[], locale: Locale) {
    if (!items.length) return of([]);

    return from(items).pipe(
      mergeMap((item) => this.resolveType(item, locale), 4),
      toArray(),
      switchMap((types) => {
        if (types.includes(null)) return of([]);

        const excludedTypes = new Set(types);
        const basketIds = new Set(items.map((item) => item.id));

        return this.api.categories(locale).pipe(
          switchMap((categories) => {
            const eligible = new Set(
              categories
                .flatMap((type) =>
                  type.children.length ? type.children : [type],
                )
                .map((type) => type.slug)
                .filter((slug) => !excludedTypes.has(slug)),
            );
            const typesToQuery = [...new Set([...preferredTypes, ...eligible])]
              .filter((slug) => eligible.has(slug))
              .slice(0, maxCategoryQueries);

            if (!typesToQuery.length) return of([]);
            return forkJoin(
              typesToQuery.map((category) =>
                this.api
                  .products({
                    locale,
                    category,
                    availability: "IN_STOCK",
                    pageSize: 1,
                  })
                  .pipe(
                    map(({ items }) =>
                      items.find(
                        (item) =>
                          item.availability === "IN_STOCK" &&
                          item.category.slug === category &&
                          !basketIds.has(item.id),
                      ),
                    ),
                    catchError(() => of(undefined)),
                  ),
              ),
            ).pipe(
              map((products) =>
                products
                  .filter(
                    (product): product is Product => product !== undefined,
                  )
                  .slice(0, maxSuggestions),
              ),
            );
          }),
          catchError(() => of([])),
        );
      }),
    );
  }

  private resolveType(
    item: BasketMember,
    locale: Locale,
  ): Observable<string | null> {
    if (!isCatalogSlug(item.slug)) return of(null);

    return this.api.product(encodeURIComponent(item.slug), locale).pipe(
      map((product) =>
        product?.id === item.id && isCatalogSlug(product.category?.slug)
          ? product.category.slug
          : null,
      ),
      catchError(() => of(null)),
    );
  }
}
