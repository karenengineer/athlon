import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { RESPONSE_INIT } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Meta, Title } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { App } from "../../app";
import { routes } from "../../app.routes";
import { Category, Product } from "../api/catalog.models";
import { Locale } from "../i18n/i18n.service";
import { homeContent } from "../../features/home/home-content";
import { PublicShell } from "../../layout/public-shell/public-shell";

const categories: Category[] = [
  {
    id: "nutrition",
    code: "sports-nutrition",
    slug: "sports-nutrition",
    name: "Nutrition",
    description: null,
    displayOrder: 0,
    children: [
      {
        id: "protein",
        code: "protein",
        slug: "protein",
        name: "Protein",
        description: null,
        displayOrder: 0,
      },
    ],
  },
];
const product: Product = {
  id: "whey",
  sku: "WHEY",
  slug: "whey",
  name: "Whey </script>&",
  shortDescription: "Actual localized description",
  price: "15000",
  currency: "AMD",
  availability: "IN_STOCK",
  featured: false,
  isNew: false,
  category: { slug: "unpublished", name: "Unpublished" },
  brand: { slug: "trec", name: "TREC" },
  images: [],
};

describe("Public page SEO navigation", () => {
  let fixture: ComponentFixture<App>;
  let router: Router;
  let http: HttpTestingController;
  let response: ResponseInit;
  const canonical = () =>
    document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const noindex = () => TestBed.inject(Meta).getTag('name="robots"')?.content;
  const schemas = () =>
    Array.from(document.querySelectorAll("script[data-athlon-seo]")).map(
      (node) => JSON.parse(node.textContent!),
    );

  beforeEach(async () => {
    response = {};
    TestBed.overrideComponent(PublicShell, {
      set: { template: "<router-outlet />" },
    });
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RESPONSE_INIT, useValue: response },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
  });
  afterEach(() => {
    http.verify();
    fixture.destroy();
    TestBed.resetTestingModule();
  });
  async function visit(path: string) {
    await router.navigateByUrl(path);
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function flushProducts(page = 1, totalPages = 0, items: Product[] = []) {
    http
      .match((request) => request.url.endsWith("/products"))
      .filter((request) => !request.cancelled)
      .forEach((request) =>
        request.flush({
          items,
          meta: { page, pageSize: 24, total: totalPages * 24, totalPages },
        }),
      );
  }
  function flushCatalog(page = 1, totalPages = 0, items: Product[] = []) {
    http
      .match((request) => request.url.endsWith("/categories"))
      .filter((request) => !request.cancelled)
      .forEach((request) => request.flush(categories));
    http
      .match((request) => request.url.endsWith("/brands"))
      .filter((request) => !request.cancelled)
      .forEach((request) => request.flush([]));
    flushProducts(page, totalPages, items);
    fixture.detectChanges();
  }
  function flushProduct(value: Product = product) {
    http
      .expectOne((request) => request.url.endsWith(`/products/${value.slug}`))
      .flush(value);
    http.expectOne((request) => request.url.endsWith("/settings")).flush({});
    flushProducts();
    fixture.detectChanges();
  }

  for (const [locale, nutrition, armenia] of [
    ["hy", "Սպորտային սնունդ", "Հայաստան"],
    ["ru", "Спортивное питание", "Армени"],
    ["en", "Sports nutrition", "Armenia"],
  ]) {
    it(`renders localized home, category and product metadata in ${locale}`, async () => {
      await visit(`/${locale}?utm_source=test`);
      flushProducts();
      expect(TestBed.inject(Title).getTitle()).toContain(nutrition);
      expect(
        TestBed.inject(Meta).getTag('name="description"')?.content,
      ).toContain(armenia);
      expect(canonical()).toBe(`https://athlon.am/${locale}`);
      expect(document.querySelectorAll('link[rel="alternate"]')).toHaveLength(
        4,
      );
      expect(schemas().map((value) => value["@type"])).toEqual([
        "OnlineStore",
        "WebSite",
      ]);
      fixture.detectChanges();
      const guide = fixture.nativeElement.querySelector(".store-guide");
      expect(guide.querySelector("h2").textContent).toBe(
        homeContent[locale as Locale].heading,
      );
      expect(
        guide.querySelector(`a[href="/${locale}/catalog/protein"]`),
      ).not.toBeNull();
      await visit(`/${locale}/catalog/protein`);
      flushCatalog();
      expect(response.status).toBe(200);
      expect(TestBed.inject(Title).getTitle()).toContain("Protein");
      expect(TestBed.inject(Title).getTitle()).toContain(armenia);
      expect(noindex()).toBeUndefined();
      await visit(`/${locale}/product/whey`);
      flushProduct();
      expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(
        product.shortDescription,
      );
      expect(TestBed.inject(Title).getTitle()).toContain(armenia);
      const schema = schemas().find((value) => value["@type"] === "Product");
      expect(schema.offers.shippingDetails).toEqual({
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: 0,
          currency: "AMD",
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "AM",
        },
      });
      expect(schema.name).toBe(product.name);
      expect(schema.offers).toMatchObject({
        price: "15000",
        priceCurrency: "AMD",
        availability: "https://schema.org/InStock",
      });
      expect(JSON.stringify(schemas())).not.toContain("/catalog/unpublished");
      expect(
        document.querySelector("script[data-athlon-seo]")?.textContent,
      ).not.toContain("</script>");
    });
  }

  it("clears product facts while loading another product and distinguishes missing from outage", async () => {
    await visit("/en/product/whey");
    flushProduct();
    await visit("/en/product/missing");
    expect(schemas()).toEqual([]);
    expect(canonical()).toBeUndefined();
    http
      .expectOne((request) => request.url.endsWith("/products/missing"))
      .flush({}, { status: 404, statusText: "Not found" });
    expect(response.status).toBe(404);
    expect(noindex()).toBe("noindex, follow");
    expect(canonical()).toBeUndefined();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Page not found");
    expect(
      fixture.nativeElement.querySelector("[data-testid=retry-home]"),
    ).toBeNull();
    await visit("/en/product/outage");
    http
      .expectOne((request) => request.url.endsWith("/products/outage"))
      .flush({}, { status: 500, statusText: "Unavailable" });
    expect(response.status).toBe(503);
    expect(schemas()).toEqual([]);
    expect(TestBed.inject(Title).getTitle()).toBe(
      "Service temporarily unavailable | ATHLON",
    );
    await visit("/ru/does-not-exist");
    expect(response.status).toBe(404);
    await visit("/bogus/path");
    expect(response.status).toBe(404);
    expect(router.url).toBe("/bogus/path");
  });

  it("keeps optional failures successful and omits offers for unknown availability or invalid prices", async () => {
    for (const [slug, availability, price] of [
      ["request", "ON_REQUEST", "15000"],
      ["invalid", "IN_STOCK", "NaN"],
      ["negative", "IN_STOCK", "-1"],
      ["unknown", "UNKNOWN", "10"],
      ["constructor", "constructor", "10"],
      ["prototype", "__proto__", "10"],
    ]) {
      await visit(`/en/product/${slug}`);
      http
        .expectOne((request) => request.url.endsWith(`/products/${slug}`))
        .flush({ ...product, slug, availability, price });
      http
        .expectOne((request) => request.url.endsWith("/settings"))
        .flush({}, { status: 503, statusText: "Unavailable" });
      http
        .expectOne((request) => request.url.endsWith("/products"))
        .flush({}, { status: 503, statusText: "Unavailable" });
      expect(response.status).toBe(200);
      expect(
        schemas().find((value) => value["@type"] === "Product").offers,
      ).toBeUndefined();
    }
  });

  it("self-canonicalizes page two and exposes query-preserving pagination links with boundaries", async () => {
    await visit("/en/catalog/protein?page=2&utm_source=test");
    flushCatalog(2, 3, [product]);
    expect(canonical()).toBe("https://athlon.am/en/catalog/protein?page=2");
    expect(TestBed.inject(Title).getTitle()).toContain("Page 2");
    expect(
      fixture.nativeElement
        .querySelector('.pagination a[rel="prev"]')
        ?.getAttribute("href"),
    ).toBe("/en/catalog/protein?utm_source=test");
    expect(
      fixture.nativeElement
        .querySelector('.pagination a[rel="next"]')
        ?.getAttribute("href"),
    ).toBe("/en/catalog/protein?page=3&utm_source=test");
    await visit("/en/catalog/protein?brand=trec&page=1&sort=priceAsc");
    flushCatalog(1, 2, [product]);
    expect(canonical()).toBe(
      "https://athlon.am/en/catalog/protein?brand=trec&sort=priceAsc",
    );
    expect(noindex()).toBe("noindex, follow");
    expect(schemas()).toEqual([]);
    expect(document.querySelectorAll('link[rel="alternate"]')).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelector('.pagination a[rel="prev"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.pagination [aria-disabled="true"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('.pagination a[rel="next"]')
        ?.getAttribute("href"),
    ).toContain("brand=trec");
  });

  for (const path of [
    "/en/search",
    "/en/catalog?q=whey",
    "/en/catalog?sort=displayOrder",
    "/en/catalog?page=bad",
    "/en/catalog?page=20",
  ]) {
    it(`excludes nonindexable catalog state ${path}`, async () => {
      await visit(path);
      flushCatalog(path.includes("20") ? 20 : 1);
      expect(noindex()).toBe("noindex, follow");
      expect(schemas()).toEqual([]);
    });
  }
  it("returns 404 for unknown categories, 200 for published empty categories and 503 for required API failures", async () => {
    await visit("/en/catalog/unpublished");
    flushCatalog();
    expect(response.status).toBe(404);
    expect(noindex()).toBe("noindex, follow");
    expect(TestBed.inject(Title).getTitle()).toBe("Page not found | ATHLON");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Page not found");
    await visit("/en/catalog/protein");
    flushCatalog();
    expect(response.status).toBe(200);
    expect(noindex()).toBeUndefined();
    await visit("/en/catalog");
    http
      .expectOne((request) => request.url.endsWith("/categories"))
      .flush({}, { status: 500, statusText: "Unavailable" });
    http.match(() => true);
    expect(response.status).toBe(503);
    expect(noindex()).toBe("noindex, follow");
  });
  it("marks basket noindex and clears public schema and alternates", async () => {
    await visit("/en");
    flushProducts();
    await visit("/en/basket");
    http.expectOne((request) => request.url.endsWith("/settings")).flush({});
    expect(noindex()).toBe("noindex, follow");
    expect(schemas()).toEqual([]);
    expect(document.querySelectorAll('link[rel="alternate"]')).toHaveLength(0);
  });
  it("returns 503 without public metadata after homepage inventory failure and recovers on retry", async () => {
    await visit("/en");
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({}, { status: 500, statusText: "Unavailable" });
    expect(response.status).toBe(503);
    expect(noindex()).toBe("noindex, follow");
    expect(canonical()).toBeUndefined();
    expect(schemas()).toEqual([]);
    await visit("/ru");
    flushProducts();
    expect(response.status).toBe(200);
    expect(noindex()).toBeUndefined();
  });
});
