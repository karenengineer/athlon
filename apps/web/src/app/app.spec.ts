import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { App } from "./app";
import { routes } from "./app.routes";

const product = {
  id: "product-1",
  sku: "DEMO-WHEY",
  slug: "demo-whey",
  name: "Демо протеин",
  shortDescription: "Сывороточный протеин",
  price: null,
  currency: "AMD",
  availability: "IN_STOCK",
  featured: true,
  isNew: true,
  category: { slug: "sports-nutrition", name: "Спортивное питание" },
  brand: { slug: "demo-brand", name: "Demo Brand" },
  images: [],
};

const sportsNutritionCategory = {
  id: "sports",
  code: "sports-nutrition",
  slug: "sports-nutrition",
  name: "Sports nutrition",
  description: null,
  displayOrder: 0,
  children: [
    {
      id: "protein",
      code: "protein",
      slug: "protein",
      name: "Protein",
      description: null,
      displayOrder: 1,
    },
  ],
};

describe("ATHLON public application", () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  it("shows sports nutrition products on home without category tabs", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru");
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector("[data-testid=home-loading]"),
    ).toBeTruthy();

    http
      .expectOne(
        (request) =>
          request.url.endsWith("/products") &&
          request.params.get("category") === "sports-nutrition",
      )
      .flush({
        items: [product],
        meta: { page: 1, pageSize: 8, total: 1, totalPages: 1 },
      });
    fixture.detectChanges();

    const categoryControls = fixture.nativeElement.querySelectorAll(
      "[data-testid=category-control]",
    );
    expect(categoryControls).toHaveLength(0);
    expect(fixture.nativeElement.textContent).not.toContain("Аксессуары");
    expect(fixture.nativeElement.textContent).toContain("Демо протеин");
    expect(fixture.nativeElement.textContent).toContain("Уточнить цену");
  });

  it("uses see all products CTAs above and below the home showcase", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/en");
    fixture.detectChanges();

    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [product],
        meta: { page: 1, pageSize: 8, total: 1, totalPages: 1 },
      });
    fixture.detectChanges();

    const links = [
      ...fixture.nativeElement.querySelectorAll(
        '[data-testid="see-all-products"]',
      ),
    ] as HTMLAnchorElement[];

    expect(fixture.nativeElement.textContent).not.toContain("View catalog");
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      "See all products →",
      "See all products →",
    ]);
    expect(
      links.every((link) => link.getAttribute("href") === "/en/catalog"),
    ).toBe(true);
  });

  it("renders a useful empty state when the nutrition category has no products", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru");
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [],
        meta: { page: 1, pageSize: 8, total: 0, totalPages: 0 },
      });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector("[data-testid=home-empty]"),
    ).toBeTruthy();
  });

  it("renders an error state with a retry action when the API fails", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru");
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush(
        { message: "Unavailable" },
        { status: 503, statusText: "Unavailable" },
      );
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector("[data-testid=home-error]"),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector("[data-testid=retry-home]"),
    ).toBeTruthy();
  });

  it("provides HY, RU and EN language navigation", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru");
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [product],
        meta: { page: 1, pageSize: 8, total: 1, totalPages: 1 },
      });
    fixture.detectChanges();

    const languages = Array.from(
      fixture.nativeElement.querySelectorAll("[data-testid=language-link]"),
    ).map((node) => (node as HTMLElement).textContent?.trim());
    expect(languages).toEqual(["HY", "RU", "EN"]);
  });

  it("uses only product type and price filters in the catalog", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl(
      "/en/catalog/sports-nutrition?brand=demo-brand&availability=IN_STOCK&minPrice=5000&maxPrice=25000&sort=priceAsc&page=2&q=whey",
    );
    fixture.detectChanges();

    http
      .expectOne((request) => request.url.endsWith("/categories"))
      .flush([sportsNutritionCategory]);
    const productsRequest = http.expectOne((request) =>
      request.url.endsWith("/products"),
    );
    expect(productsRequest.request.params.get("category")).toBe(
      "sports-nutrition",
    );
    expect(productsRequest.request.params.has("brand")).toBe(false);
    expect(productsRequest.request.params.has("availability")).toBe(false);
    expect(productsRequest.request.params.get("minPrice")).toBe("5000");
    expect(productsRequest.request.params.get("maxPrice")).toBe("25000");
    expect(productsRequest.request.params.has("sort")).toBe(false);
    expect(productsRequest.request.params.get("page")).toBe("2");
    expect(productsRequest.request.params.get("q")).toBe("whey");
    productsRequest.flush({
      items: [product],
      meta: { page: 2, pageSize: 24, total: 30, totalPages: 2 },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Sports nutrition");
    const filterControls = Array.from(
      fixture.nativeElement.querySelectorAll(".filters select, .filters input"),
    ) as HTMLInputElement[];
    expect(
      filterControls.map((control) => control.getAttribute("name")),
    ).toEqual(["category", "minPrice", "maxPrice"]);
    expect(fixture.nativeElement.textContent).toContain("All product types");
    expect(fixture.nativeElement.textContent).not.toContain("All brands");
    expect(fixture.nativeElement.textContent).not.toContain("Any availability");
    expect(fixture.nativeElement.textContent).not.toContain("Recommended");
    expect(
      fixture.nativeElement.querySelector("[data-testid=catalog-breadcrumbs]"),
    ).toBeTruthy();
  });

  it("cancels stale catalog requests when URL parameters change", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru/catalog?page=1");
    fixture.detectChanges();

    const oldCategories = http.expectOne((request) =>
      request.url.endsWith("/categories"),
    );
    const oldProducts = http.expectOne(
      (request) =>
        request.url.endsWith("/products") && request.params.get("page") === "1",
    );

    await router.navigateByUrl("/ru/catalog?page=2");
    fixture.detectChanges();

    expect(oldCategories.cancelled).toBe(true);
    expect(oldProducts.cancelled).toBe(true);

    http
      .expectOne((request) => request.url.endsWith("/categories"))
      .flush([sportsNutritionCategory]);
    http
      .expectOne(
        (request) =>
          request.url.endsWith("/products") &&
          request.params.get("page") === "2",
      )
      .flush({
        items: [product],
        meta: { page: 2, pageSize: 24, total: 30, totalPages: 2 },
      });
  });

  it("renders product facts, localized availability, contact CTA and related products", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru/product/demo-whey");
    fixture.detectChanges();

    http
      .expectOne((request) => request.url.endsWith("/products/demo-whey"))
      .flush({
        ...product,
        description: "Полное описание продукта",
        characteristics: { weight: "900 г", servings: 30 },
        images: [
          {
            id: "image-1",
            thumbnailUrl: "/media/thumb.webp",
            cardUrl: "/media/card.webp",
            detailUrl: "/media/detail.webp",
            alt: "Whey Protein",
            primary: true,
          },
        ],
      });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Демо протеин");
    expect(fixture.nativeElement.textContent).toContain(
      "Полное описание продукта",
    );

    http
      .expectOne((request) => request.url.endsWith("/public/settings"))
      .flush({ whatsapp: "+37499111222" });
    http
      .expectOne(
        (request) =>
          request.url.endsWith("/products") &&
          request.params.get("category") === "sports-nutrition",
      )
      .flush({
        items: [{ ...product, id: "related-1", slug: "related-whey" }],
        meta: { page: 1, pageSize: 4, total: 1, totalPages: 1 },
      });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("900 г");
    expect(fixture.nativeElement.textContent).toContain("В наличии");
    expect(
      fixture.nativeElement.querySelector("[data-testid=availability-cta]")
        ?.textContent,
    ).toContain("Уточнить наличие");
    expect(
      fixture.nativeElement.querySelector("[data-testid=related-products]"),
    ).toBeTruthy();
  });

  it("reloads product data when the locale changes without leaving the SPA", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru/product/demo-whey");
    fixture.detectChanges();

    http
      .expectOne(
        (request) =>
          request.url.endsWith("/products/demo-whey") &&
          request.params.get("locale") === "ru",
      )
      .flush(product);
    http
      .expectOne((request) => request.url.endsWith("/public/settings"))
      .flush({});
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [],
        meta: { page: 1, pageSize: 5, total: 0, totalPages: 0 },
      });
    fixture.detectChanges();

    await router.navigateByUrl("/en/product/demo-whey");
    fixture.detectChanges();

    http
      .expectOne(
        (request) =>
          request.url.endsWith("/products/demo-whey") &&
          request.params.get("locale") === "en",
      )
      .flush({ ...product, name: "Demo whey" });
    http
      .expectOne((request) => request.url.endsWith("/public/settings"))
      .flush({});
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [],
        meta: { page: 1, pageSize: 5, total: 0, totalPages: 0 },
      });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Demo whey");
  });
});
