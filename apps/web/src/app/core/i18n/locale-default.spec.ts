import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { routes } from "../../app.routes";
import { CatalogPage } from "../../features/catalog/catalog-page";
import { ProductPage } from "../../features/product/product-page";
import { I18nService } from "./i18n.service";

describe("default public locale", () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  function flushCatalog(locale: string): void {
    const requests = http.match(() => true);
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      expect(request.request.params.get("locale")).toBe(locale);
      request.flush(
        request.request.url.endsWith("/products")
          ? {
              items: [],
              meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
            }
          : [],
      );
    }
  }

  it("redirects the root to Armenian and requests Armenian home data", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl("/");
    expect(TestBed.inject(Router).url).toBe("/hy");
    flushCatalog("hy");
  });

  for (const locale of ["hy", "ru", "en"]) {
    it(`preserves explicit /${locale} and requests its locale`, async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(`/${locale}`);
      expect(TestBed.inject(Router).url).toBe(`/${locale}`);
      expect(TestBed.inject(I18nService).locale()).toBe(locale);
      flushCatalog(locale);
    });
  }

  it("redirects an unsupported locale to Armenian preserving the catalog path", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl("/de/catalog/sports-nutrition");
    expect(TestBed.inject(Router).url).toBe("/hy/catalog/sports-nutrition");
    flushCatalog("hy");
  });

  it("starts with Armenian copy before navigation", () => {
    expect(TestBed.inject(I18nService).t("home")).toBe("Գլխավոր");
  });

  for (const value of [null, undefined, "de"]) {
    it(`uses Armenian copy for a missing or unsupported locale (${value})`, () => {
      const service = TestBed.inject(I18nService);
      service.setLocale("ru");
      service.setLocale(value);
      expect(service.t("home")).toBe("Գլխավոր");
    });
  }

  it("uses the correct Russian noun form for product counts", () => {
    const service = TestBed.inject(I18nService);
    service.setLocale("ru");

    for (const [count, expected] of [
      [0, "0 товаров"],
      [1, "1 товар"],
      [2, "2 товара"],
      [5, "5 товаров"],
      [11, "11 товаров"],
      [21, "21 товар"],
      [22, "22 товара"],
      [25, "25 товаров"],
    ] as const) {
      expect(service.productCountLabel(count)).toBe(expected);
    }
  });

  it("uses singular and plural English product counts", () => {
    const service = TestBed.inject(I18nService);
    service.setLocale("en");

    expect(service.productCountLabel(1)).toBe("1 product");
    expect(service.productCountLabel(2)).toBe("2 products");
  });

  it("shows a no-results message instead of an empty-catalog message for search misses", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl("/en/search?q=zzzz-nonexistent");
    flushCatalog("en");
    harness.detectChanges();

    const text = harness.routeNativeElement?.textContent ?? "";
    expect(text).toContain("No products found");
    expect(text).not.toContain("Products are coming soon");
  });

  describe("page requests when the parent locale is absent", () => {
    beforeEach(() => {
      const publicRoute = routes.find((route) => route.path === ":locale")!;
      // Keep real page components under a real parent route without a locale parameter.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideRouter([{ ...publicRoute, path: "missing", canActivate: [] }]),
          provideHttpClient(),
          provideHttpClientTesting(),
        ],
      });
      http = TestBed.inject(HttpTestingController);
    });

    it("requests Armenian home data", async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl("/missing");
      flushCatalog("hy");
    });

    it("requests Armenian catalog data including retries", async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl("/missing/catalog");
      flushCatalog("hy");
      harness.fixture.debugElement
        .query(By.directive(CatalogPage))
        .componentInstance.retry();
      flushCatalog("hy");
    });

    it("requests Armenian product data including reloads", async () => {
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl("/missing/product/demo");
      const initial = http.expectOne((request) =>
        request.url.endsWith("/products/demo"),
      );
      expect(initial.request.params.get("locale")).toBe("hy");
      initial.flush({}, { status: 404, statusText: "Not Found" });
      harness.fixture.debugElement
        .query(By.directive(ProductPage))
        .componentInstance.load();
      const reload = http.expectOne((request) =>
        request.url.endsWith("/products/demo"),
      );
      expect(reload.request.params.get("locale")).toBe("hy");
      reload.flush({}, { status: 404, statusText: "Not Found" });
    });
  });
});
