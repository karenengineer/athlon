import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { Category, Product } from "../../core/api/catalog.models";
import { BasketService } from "../../core/basket/basket.service";
import { I18nService } from "../../core/i18n/i18n.service";
import { BasketPage } from "./basket-page";

function category(slug: string): Category {
  return {
    id: slug,
    code: slug,
    slug,
    name: slug,
    description: null,
    displayOrder: 0,
    children: [],
  };
}

function product(slug: string, type: string, name = slug): Product {
  return {
    id: slug,
    sku: slug,
    slug,
    name,
    category: { slug: type, name: type },
    availability: "IN_STOCK",
    price: "4500",
    currency: "AMD",
    shortDescription: null,
    featured: false,
    isNew: false,
    brand: { slug, name: slug },
    images: [],
  };
}

describe("Basket product suggestions", () => {
  let http: HttpTestingController;
  let basket: BasketService;
  let fixture: ComponentFixture<BasketPage>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [BasketPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(I18nService).setLocale("en");
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      localStorage.clear();
      sessionStorage.clear();
    }
  });

  function render() {
    basket = TestBed.inject(BasketService);
    fixture = TestBed.createComponent(BasketPage);
    fixture.detectChanges();
    http
      .expectOne("/api/v1/public/settings")
      .flush({ cardPaymentsEnabled: false });
  }

  function detail(item: Product, locale = "en"): void {
    http
      .expectOne(`/api/v1/products/${item.slug}?locale=${locale}`)
      .flush(item);
  }

  function types(locale = "en") {
    return http.expectOne(
      (request) =>
        request.url === "/api/v1/categories" &&
        request.params.get("locale") === locale,
    );
  }

  function suggestions(type: string, locale = "en") {
    return http.expectOne(
      (request) =>
        request.url === "/api/v1/products" &&
        request.params.get("locale") === locale &&
        request.params.get("category") === type &&
        request.params.get("availability") === "IN_STOCK",
    );
  }

  function section(): HTMLElement | null {
    fixture.detectChanges();
    return fixture.nativeElement.querySelector(".basket-suggestions");
  }

  it("excludes current catalog types for both reclassified and legacy products", () => {
    const legacy = product("legacy-whey", "protein");
    localStorage.setItem(
      "athlon:basket:v1",
      JSON.stringify([{ ...legacy, quantity: 1 }]),
    );
    TestBed.inject(BasketService).add(
      product("current-creatine", "pre-workout"),
    );
    render();

    detail(legacy);
    detail(product("current-creatine", "creatine"));
    types().flush([
      {
        ...category("sports-nutrition"),
        children: ["protein", "creatine", "pre-workout", "vitamins"].map(
          category,
        ),
      },
    ]);
    http.expectNone((request) =>
      ["protein", "creatine", "sports-nutrition"].includes(
        request.params.get("category") ?? "",
      ),
    );

    suggestions("pre-workout").flush({
      items: [
        product("other-brand-protein", "protein"),
        product("current-creatine", "pre-workout"),
        product("pre-workout-one", "pre-workout", "Pre-workout One"),
        product("pre-workout-two", "pre-workout"),
      ],
    });
    suggestions("vitamins").flush({
      items: [
        {
          ...product("sold-out-vitamin", "vitamins"),
          availability: "OUT_OF_STOCK",
        },
      ],
    });

    const links = section()?.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links?.[0].textContent).toContain("Pre-workout One");
    expect(links?.[0].getAttribute("href")).toBe("/en/product/pre-workout-one");
    expect(
      section()
        ?.closest("app-basket-suggestions")
        ?.previousElementSibling?.classList.contains("basket-layout"),
    ).toBe(true);
  });

  it("hides suggestions when all published types are in the basket", () => {
    TestBed.inject(BasketService).add(product("current-creatine", "creatine"));
    render();
    detail(product("current-creatine", "creatine"));

    types().flush([category("creatine")]);

    http.expectNone((request) => request.url === "/api/v1/products");
    expect(section()).toBeNull();
  });

  it("hides suggestions when a legacy product no longer resolves", () => {
    const legacy = product("legacy-whey", "protein");
    localStorage.setItem(
      "athlon:basket:v1",
      JSON.stringify([{ ...legacy, quantity: 1 }]),
    );
    render();

    http.expectOne("/api/v1/products/legacy-whey?locale=en").flush(null, {
      status: 404,
      statusText: "Not Found",
    });

    http.expectNone((request) => request.url === "/api/v1/categories");
    expect(section()).toBeNull();
  });

  it("keeps an in-flight query across quantity changes and cancels it on locale change", () => {
    TestBed.inject(BasketService).add(product("current-creatine", "creatine"));
    render();
    detail(product("current-creatine", "creatine"));

    types().flush([category("protein"), category("creatine")]);
    const english = suggestions("protein");

    basket.update("current-creatine", 2);
    expect(section()).toBeNull();
    expect(english.cancelled).toBe(false);
    http.expectNone((request) => request.url === "/api/v1/categories");

    TestBed.inject(I18nService).setLocale("ru");
    expect(section()).toBeNull();
    expect(english.cancelled).toBe(true);

    detail(product("current-creatine", "creatine"), "ru");
    types("ru").flush([category("protein"), category("creatine")]);
    suggestions("protein", "ru").flush({
      items: [product("whey", "protein", "Сывороточный протеин")],
    });
    expect(section()?.querySelector("h2")?.textContent).toContain(
      "Вам также может понравиться",
    );
    expect(section()?.textContent).toContain("Сывороточный протеин");
    expect(section()?.querySelector("a")?.getAttribute("href")).toBe(
      "/ru/product/whey",
    );
  });

  it("hides old suggestions immediately when a recommended type enters the basket", () => {
    TestBed.inject(BasketService).add(product("current-creatine", "creatine"));
    render();
    detail(product("current-creatine", "creatine"));
    types().flush([category("protein"), category("creatine")]);
    suggestions("protein").flush({ items: [product("whey", "protein")] });
    expect(section()).not.toBeNull();

    basket.add(product("other-whey", "protein"));

    expect(section()).toBeNull();
    detail(product("current-creatine", "creatine"));
    detail(product("other-whey", "protein"));
    types().flush([category("protein"), category("creatine")]);
    http.expectNone((request) => request.url === "/api/v1/products");
  });
});
