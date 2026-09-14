import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { App } from "./app";
import { routes } from "./app.routes";

const categories = [
  {
    id: "sports",
    code: "sports-nutrition",
    slug: "sports-nutrition",
    name: "Спортивное питание",
    description: null,
    displayOrder: 0,
    children: [],
  },
  {
    id: "accessories",
    code: "accessories",
    slug: "accessories",
    name: "Аксессуары",
    description: null,
    displayOrder: 1,
    children: [],
  },
];

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

  it("shows exactly two catalog categories and sports nutrition products on home", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru");
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector("[data-testid=home-loading]"),
    ).toBeTruthy();

    http
      .expectOne((request) => request.url.endsWith("/categories"))
      .flush(categories);
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
    expect(categoryControls).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain("Спортивное питание");
    expect(fixture.nativeElement.textContent).toContain("Аксессуары");
    expect(fixture.nativeElement.textContent).toContain("Демо протеин");
    expect(fixture.nativeElement.textContent).toContain("Уточнить цену");
  });

  it("renders a useful empty state when the nutrition category has no products", async () => {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl("/ru");
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith("/categories"))
      .flush(categories);
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
      .expectOne((request) => request.url.endsWith("/categories"))
      .flush(categories);
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
      .expectOne((request) => request.url.endsWith("/categories"))
      .flush(categories);
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
});
