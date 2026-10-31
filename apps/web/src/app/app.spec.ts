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

  for (const [locale, removedCopy] of [
    ["hy", "Խոշոր քարտեր և միայն կարևոր տեղեկություն։"],
    ["ru", "Крупные карточки и только важные факты о продукте."],
    ["en", "Large product cards with the facts that matter."],
  ]) {
    it(`omits the showcase supporting sentence in ${locale}`, async () => {
      const fixture = TestBed.createComponent(App);
      await router.navigateByUrl(`/${locale}`);
      fixture.detectChanges();

      http
        .expectOne((request) => request.url.endsWith("/products"))
        .flush({
          items: [],
          meta: { page: 1, pageSize: 8, total: 0, totalPages: 0 },
        });
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(".section-heading p:not(.eyebrow)"),
      ).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain(removedCopy);
    });
  }

  for (const [locale, title, communityTitle] of [
    ["hy", "Կառուցիր մարմինդ հոգուդ համապատասխան", "Միացիր ATHLON-ին"],
    ["ru", "Создай тело под стать своему духу", "Присоединяйся к ATHLON"],
    ["en", "Build a body to match your spirit", "Join ATHLON"],
  ]) {
    it(`shows the updated homepage slogan in ${locale}`, async () => {
      const fixture = TestBed.createComponent(App);
      await router.navigateByUrl(`/${locale}`);
      fixture.detectChanges();

      http
        .expectOne((request) => request.url.endsWith("/products"))
        .flush({
          items: [],
          meta: { page: 1, pageSize: 8, total: 0, totalPages: 0 },
        });
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelector(".hero h1").textContent.trim(),
      ).toBe(title);
      expect(
        fixture.nativeElement.querySelector(".community h2").textContent.trim(),
      ).toBe(communityTitle);
    });
  }

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

  it("renders a localized not-found view and document title", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru/not-a-real-page");
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Страница не найдена");
    expect(fixture.nativeElement.textContent).toContain("Главная");
    expect(document.title).toBe("Страница не найдена | ATHLON");
  });

  it("renders not-found for an unsupported first path segment instead of redirecting", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/de/catalog");
    fixture.detectChanges();

    expect(router.url).toBe("/de/catalog");
    expect(fixture.nativeElement.textContent).toContain("404");
    expect(document.title).toContain("ATHLON");
    expect(
      document.querySelector('meta[name="robots"]')?.getAttribute("content"),
    ).toBe("noindex, follow");
  });

  it("updates the homepage locale and title when only the locale route changes", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/en");
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [],
        meta: { page: 1, pageSize: 8, total: 0, totalPages: 0 },
      });
    fixture.detectChanges();
    expect(document.title).toBe("Sports nutrition in Armenia | ATHLON");

    await router.navigateByUrl("/ru");
    fixture.detectChanges();
    expect(document.title).toBe("Спортивное питание в Армении | ATHLON");
    http
      .expectOne(
        (request) =>
          request.url.endsWith("/products") &&
          request.params.get("locale") === "ru",
      )
      .flush({
        items: [],
        meta: { page: 1, pageSize: 8, total: 0, totalPages: 0 },
      });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Главная");
  });

  it("updates not-found content and title when locale changes without recreating the view", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru/not-a-real-page");
    fixture.detectChanges();
    expect(document.title).toBe("Страница не найдена | ATHLON");

    await router.navigateByUrl("/en/still-not-a-real-page");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Page not found");
    expect(fixture.nativeElement.textContent).toContain("Home");
    expect(document.title).toBe("Page not found | ATHLON");
  });

  it("updates basket title and language when locale changes without recreating the view", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/en/basket");
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith("/public/settings"))
      .flush({
        cardPaymentsEnabled: false,
      });
    fixture.detectChanges();
    expect(document.title).toBe("Basket | ATHLON");

    await router.navigateByUrl("/ru/basket");
    fixture.detectChanges();
    expect(document.title).toBe("Корзина | ATHLON");
    expect(fixture.nativeElement.textContent).toContain("Корзина пуста");
  });

  it("loads catalog brands once per locale across filter and page changes", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/en/catalog?page=1");
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith("/categories")).flush([]);
    http
      .expectOne((request) => request.url.endsWith("/brands"))
      .flush([{ id: "demo-brand", slug: "demo-brand", name: "Demo Brand" }]);
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [],
        meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
      });
    fixture.detectChanges();

    await router.navigateByUrl("/en/catalog?page=2&brand=demo-brand");
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith("/categories")).flush([]);
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [],
        meta: { page: 2, pageSize: 24, total: 0, totalPages: 0 },
      });
    fixture.detectChanges();
    http.expectNone((request) => request.url.endsWith("/brands"));

    await router.navigateByUrl("/ru/catalog?page=1");
    fixture.detectChanges();
    const categories = http.match((request) =>
      request.url.endsWith("/categories"),
    );
    categories
      .filter((request) => !request.cancelled)
      .forEach((request) => request.flush([]));
    const localizedBrands = http.match(
      (request) =>
        request.url.endsWith("/brands") &&
        request.params.get("locale") === "ru",
    );
    expect(
      localizedBrands.filter((request) => !request.cancelled),
    ).toHaveLength(1);
    localizedBrands
      .filter((request) => !request.cancelled)
      .forEach((request) =>
        request.flush([
          { id: "demo-brand", slug: "demo-brand", name: "Демо бренд" },
        ]),
      );
    const products = http.match((request) => request.url.endsWith("/products"));
    products
      .filter((request) => !request.cancelled)
      .forEach((request) =>
        request.flush({
          items: [],
          meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
        }),
      );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Демо бренд");
  });

  it("retries brands after a transient brand request failure", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/en/catalog");
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith("/categories")).flush([]);
    http
      .expectOne((request) => request.url.endsWith("/brands"))
      .flush(
        { message: "Temporary failure" },
        { status: 503, statusText: "Unavailable" },
      );
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush(
        { message: "Temporary failure" },
        { status: 503, statusText: "Unavailable" },
      );
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector(
        '[data-testid="retry-home"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith("/categories")).flush([]);
    http
      .expectOne((request) => request.url.endsWith("/brands"))
      .flush([
        {
          id: "recovered-brand",
          slug: "recovered-brand",
          name: "Recovered Brand",
        },
      ]);
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [],
        meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
      });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Recovered Brand");
  });

  it("applies edited catalog filters through the form action", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl(
      "/en/catalog/sports-nutrition?brand=demo-brand&availability=IN_STOCK&minPrice=5000&maxPrice=25000&sort=priceAsc&page=2&q=whey",
    );
    fixture.detectChanges();

    http
      .expectOne((request) => request.url.endsWith("/categories"))
      .flush([sportsNutritionCategory]);
    http
      .expectOne((request) => request.url.endsWith("/brands"))
      .flush([{ id: "demo-brand", slug: "demo-brand", name: "Demo Brand" }]);
    const productsRequest = http.expectOne((request) =>
      request.url.endsWith("/products"),
    );
    expect(productsRequest.request.params.get("category")).toBe(
      "sports-nutrition",
    );
    expect(productsRequest.request.params.get("brand")).toBe("demo-brand");
    expect(productsRequest.request.params.get("availability")).toBe("IN_STOCK");
    expect(productsRequest.request.params.get("minPrice")).toBe("5000");
    expect(productsRequest.request.params.get("maxPrice")).toBe("25000");
    expect(productsRequest.request.params.get("sort")).toBe("priceAsc");
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
    ).toEqual([
      "category",
      "brand",
      "availability",
      "sort",
      "minPrice",
      "maxPrice",
    ]);
    expect(fixture.nativeElement.textContent).toContain("All product types");
    expect(fixture.nativeElement.textContent).toContain("All brands");
    expect(fixture.nativeElement.textContent).toContain("Any availability");
    expect(fixture.nativeElement.textContent).toContain("Lowest price");
    expect(
      fixture.nativeElement.querySelector("[data-testid=catalog-breadcrumbs]"),
    ).toBeTruthy();

    await fixture.whenStable();
    const values = [
      "protein",
      "demo-brand",
      "PREORDER",
      "priceDesc",
      "0",
      "30000",
    ];
    filterControls.forEach((control, index) => {
      control.value = values[index];
      control.dispatchEvent(
        new Event(control instanceof HTMLSelectElement ? "change" : "input"),
      );
    });
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        ".filters button[type='submit']",
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    expect(router.url).toBe(
      "/en/catalog/protein?q=whey&brand=demo-brand&availability=PREORDER&minPrice=0&maxPrice=30000&sort=priceDesc",
    );
    http
      .match((request) => request.url.endsWith("/categories"))
      .filter((request) => !request.cancelled)
      .at(-1)!
      .flush([sportsNutritionCategory]);
    http.expectNone((request) => request.url.endsWith("/brands"));
    const filteredRequests = http
      .match((request) => request.url.endsWith("/products"))
      .filter((request) => !request.cancelled);
    expect(filteredRequests).toHaveLength(1);
    const filteredProducts = filteredRequests[0];
    expect(
      Object.fromEntries(
        filteredProducts.request.params
          .keys()
          .map((key) => [key, filteredProducts.request.params.get(key)]),
      ),
    ).toEqual({
      locale: "en",
      category: "protein",
      brand: "demo-brand",
      availability: "PREORDER",
      minPrice: "0",
      maxPrice: "30000",
      sort: "priceDesc",
      page: "1",
      pageSize: "24",
      q: "whey",
    });
    filteredProducts.flush({
      items: [],
      meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
    });
  });

  it("resets catalog filters while keeping the current search query", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl(
      "/en/catalog/protein?q=long%20query&brand=demo-brand&availability=IN_STOCK&minPrice=5000&sort=priceAsc&page=2",
    );
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith("/categories"))
      .flush([sportsNutritionCategory]);
    http
      .expectOne((request) => request.url.endsWith("/brands"))
      .flush([{ id: "demo-brand", slug: "demo-brand", name: "Demo Brand" }]);
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [],
        meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
      });
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector(
        "[data-testid='catalog-reset']",
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(router.url).toBe("/en/catalog/sports-nutrition?q=long%20query");

    const categories = http.match((request) =>
      request.url.endsWith("/categories"),
    );
    const products = http.match((request) => request.url.endsWith("/products"));
    categories
      .filter((request) => !request.cancelled)
      .at(-1)!
      .flush([sportsNutritionCategory]);
    http.expectNone((request) => request.url.endsWith("/brands"));
    products
      .filter((request) => !request.cancelled)
      .at(-1)!
      .flush({
        items: [],
        meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
      });
  });

  it("cancels stale catalog requests and reuses the in-flight brands request", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru/catalog?page=1");
    fixture.detectChanges();

    const oldCategories = http.expectOne((request) =>
      request.url.endsWith("/categories"),
    );
    const oldBrands = http.expectOne((request) =>
      request.url.endsWith("/brands"),
    );
    const oldProducts = http.expectOne(
      (request) =>
        request.url.endsWith("/products") && request.params.get("page") === "1",
    );

    await router.navigateByUrl("/ru/catalog?page=2");
    fixture.detectChanges();

    expect(oldCategories.cancelled).toBe(true);
    expect(oldBrands.cancelled).toBe(false);
    expect(oldProducts.cancelled).toBe(true);

    http
      .expectOne((request) => request.url.endsWith("/categories"))
      .flush([sportsNutritionCategory]);
    http.expectNone((request) => request.url.endsWith("/brands"));
    oldBrands.flush([]);
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
        availability: "OUT_OF_STOCK",
        description: "Полное описание продукта",
        characteristics: {
          netWeight: "900 г",
          servings: 30,
          flavor: "Unflavored",
        },
        images: [
          {
            id: "image-1",
            thumbnailUrl: "/media/thumb.webp",
            cardUrl: "/media/card.webp",
            detailUrl: "/media/detail.webp",
            alt: "Whey Protein",
            primary: true,
          },
          {
            id: "image-2",
            thumbnailUrl: "/media/thumb-2.webp",
            cardUrl: "/media/card-2.webp",
            detailUrl: "/media/detail-2.webp",
            alt: "Whey Protein back label",
            primary: false,
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
    expect(fixture.nativeElement.textContent).toContain("Вес нетто");
    expect(fixture.nativeElement.textContent).toContain("Порций");
    expect(fixture.nativeElement.textContent).toContain("Без вкуса");
    expect(fixture.nativeElement.textContent).toContain("Нет в наличии");
    expect(fixture.nativeElement.querySelector(".basket-cta")).toBeNull();
    expect(
      fixture.nativeElement.querySelector("[aria-pressed='true']"),
    ).not.toBeNull();
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
