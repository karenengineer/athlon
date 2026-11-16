import { DOCUMENT, isPlatformBrowser } from "@angular/common";
import {
  Injectable,
  inject,
  makeStateKey,
  PLATFORM_ID,
  REQUEST,
  RESPONSE_INIT,
  TransferState,
} from "@angular/core";
import { catchError, forkJoin, map, Observable, of, timeout } from "rxjs";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { Product, ProductQuery } from "../../core/api/catalog.models";

type ShowcaseBrand = "trec" | "optimum-nutrition";

const cookieName = "athlon_home_brand";
const brandState = makeStateKey<ShowcaseBrand | null>("home-showcase-brand");
const fallbackState = makeStateKey<string | null>("home-showcase-fallback");
const showcaseSize = 8;

function cookieBrand(cookies: string): ShowcaseBrand | undefined {
  const prefix = `${cookieName}=`;
  const value = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix))
    ?.slice(prefix.length);
  return value === "trec" || value === "optimum-nutrition" ? value : undefined;
}

@Injectable({ providedIn: "root" })
export class HomeShowcase {
  private readonly api = inject(CatalogApiService);
  private readonly document = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true });
  private readonly response = inject(RESPONSE_INIT, { optional: true });
  private readonly transferState = inject(TransferState);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly brand = this.assignBrand();

  products(locale: string): Observable<Product[]> {
    const query: ProductQuery = {
      locale,
      category: "sports-nutrition",
      sort: "displayOrder",
      page: 1,
    };

    return forkJoin({
      canonical: this.api.products({ ...query, pageSize: showcaseSize }),
      preferred: this.preferredProducts(query),
    }).pipe(
      map(({ canonical, preferred }) => {
        const showcase = new Map<string, Product>();
        for (const product of [...preferred, ...canonical.items]) {
          if (!showcase.has(product.id)) showcase.set(product.id, product);
          if (showcase.size === showcaseSize) break;
        }
        return [...showcase.values()];
      }),
    );
  }

  private preferredProducts(query: ProductQuery): Observable<Product[]> {
    if (
      !this.request &&
      this.transferState.get(fallbackState, null) === query.locale
    ) {
      // Hydrate with the same canonical order if the optional SSR request failed.
      this.transferState.remove(fallbackState);
      return of([]);
    }

    return this.api
      .products({
        ...query,
        brand: this.brand,
        availability: "IN_STOCK",
        pageSize: 4,
      })
      .pipe(
        timeout({ first: 1500 }),
        map(({ items }) =>
          items
            .filter(
              (product) =>
                product.brand?.slug === this.brand &&
                product.availability === "IN_STOCK",
            )
            .slice(0, 4),
        ),
        catchError(() => {
          if (this.request) this.transferState.set(fallbackState, query.locale);
          return of([]);
        }),
      );
  }

  private assignBrand(): ShowcaseBrand {
    const transferred = this.transferState.get(brandState, null);
    this.transferState.remove(brandState);
    if (!this.request && transferred) return transferred;

    const existing = cookieBrand(
      this.request?.headers.get("Cookie") ??
        (this.isBrowser && !this.request ? this.document.cookie : ""),
    );
    const brand =
      existing ?? (Math.random() < 0.5 ? "trec" : "optimum-nutrition");
    const secure = this.request
      ? new URL(this.request.url).protocol === "https:"
      : this.isBrowser && this.document.location.protocol === "https:";
    const cookie = `${cookieName}=${brand}; Path=/; Max-Age=2592000; SameSite=Lax${secure ? "; Secure" : ""}`;

    if (this.request) {
      if (this.response) {
        const headers = new Headers(this.response.headers);
        headers.set("Cache-Control", "private, no-store");
        if (!existing) headers.append("Set-Cookie", cookie);
        this.response.headers = headers;
      }
      this.transferState.set(brandState, brand);
    } else if (this.isBrowser && !existing) {
      this.document.cookie = cookie;
    }

    return brand;
  }
}
