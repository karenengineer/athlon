import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Meta, Title } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { App } from "../../app";
import { routes } from "../../app.routes";
import { Category } from "../../core/api/catalog.models";
import { PublicShell } from "../../layout/public-shell/public-shell";

const publishedCategories: Category[] = [
  {
    id: "nutrition",
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
        description: "  Compare the protein packages in this category.  ",
        displayOrder: 1,
      },
      {
        id: "new",
        code: "new-category",
        slug: "new-category",
        name: "New category",
        description: " ",
        displayOrder: 2,
      },
    ],
  },
];

describe("Catalog category content and metadata", () => {
  let http: HttpTestingController;
  let router: Router;
  let fixture: ComponentFixture<App>;
  let meta: Meta;
  let title: Title;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.overrideComponent(PublicShell, {
      set: { template: "<router-outlet />" },
    });
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
    meta = TestBed.inject(Meta);
    title = TestBed.inject(Title);
    fixture = TestBed.createComponent(App);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  async function visit(path: string): Promise<void> {
    await router.navigateByUrl(path);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function flushCatalog(categories = publishedCategories): void {
    http
      .match((request) => request.url.endsWith("/categories"))
      .filter((request) => !request.cancelled)
      .forEach((request) => request.flush(categories));
    http
      .match((request) => request.url.endsWith("/brands"))
      .filter((request) => !request.cancelled)
      .forEach((request) => request.flush([]));
    http
      .match((request) => request.url.endsWith("/products"))
      .filter((request) => !request.cancelled)
      .forEach((request) =>
        request.flush({
          items: [],
          meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
        }),
      );
    fixture.detectChanges();
  }

  function description(): string {
    return meta.getTag('name="description"')?.content ?? "";
  }

  it("links only published categories with real locale URLs", async () => {
    await visit("/ru/catalog");
    flushCatalog();
    const links = Array.from(
      fixture.nativeElement.querySelectorAll(".category-navigation a"),
    ) as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/ru/catalog/sports-nutrition",
      "/ru/catalog/protein",
      "/ru/catalog/new-category",
    ]);
    expect(links.map((link) => link.textContent?.trim())).toContain("Protein");
    expect(
      fixture.nativeElement.querySelector('a[href$="/creatine"]'),
    ).toBeNull();
  });

  it("uses the API introduction as plain text and related published links on an empty category", async () => {
    await visit("/en/catalog/protein");
    const categories = structuredClone(publishedCategories);
    categories[0].children[0].description = "<b>Compare packages</b>";
    flushCatalog(categories);
    const intro = fixture.nativeElement.querySelector(".category-introduction");
    expect(intro?.textContent.trim()).toBe("<b>Compare packages</b>");
    expect(intro?.querySelector("b")).toBeNull();
    expect(
      fixture.nativeElement.querySelector(".category-guidance")?.textContent,
    ).toContain("package");
    const related = Array.from(
      fixture.nativeElement.querySelectorAll(".related-categories a"),
    ) as HTMLAnchorElement[];
    expect(related.map((link) => link.getAttribute("href"))).toEqual([
      "/en/catalog/sports-nutrition",
      "/en/catalog/new-category",
    ]);
    expect(title.getTitle()).toBe("Protein — Armenia | ATHLON");
    expect(description()).toBe(
      "<b>Compare packages</b> Free delivery throughout Armenia.",
    );
  });

  for (const [locale, fallbackFragment, guidanceFragment] of [
    ["hy", "սպիտակուց", "փաթեթ"],
    ["ru", "протеин", "упаков"],
    ["en", "protein", "package"],
  ]) {
    it(`provides localized neutral protein fallback and guidance in ${locale}`, async () => {
      await visit(`/${locale}/catalog/protein`);
      const categories = structuredClone(publishedCategories);
      categories[0].children[0].description = " \n ";
      flushCatalog(categories);
      expect(
        fixture.nativeElement.querySelector(".category-introduction")
          ?.textContent,
      ).toContain(fallbackFragment);
      expect(
        fixture.nativeElement.querySelector(".category-guidance")?.textContent,
      ).toContain(guidanceFragment);
      expect(description()).toContain(fallbackFragment);
    });
  }

  it("uses generic guidance for a newly published category without inventing other categories", async () => {
    await visit("/en/catalog/new-category");
    flushCatalog();
    expect(
      fixture.nativeElement.querySelector(".category-introduction")
        ?.textContent,
    ).toContain("New category");
    expect(description()).toContain("New category");
  });

  it("updates metadata between categories and removes previous copy while loading", async () => {
    await visit("/en/catalog/protein");
    flushCatalog();
    expect(description()).toBe(
      "Compare the protein packages in this category. Free delivery throughout Armenia.",
    );
    await visit("/en/catalog/new-category?sort=priceAsc");
    expect(description()).not.toContain("protein packages");
    expect(
      fixture.nativeElement.querySelector(".category-introduction"),
    ).toBeNull();
    flushCatalog();
    expect(title.getTitle()).toBe("New category — Armenia | ATHLON");
    expect(description()).toContain("New category");
  });

  it("replaces metadata and links when the locale changes", async () => {
    await visit("/en/catalog/protein");
    flushCatalog();
    await visit("/ru/catalog/protein");
    const categories = structuredClone(publishedCategories);
    categories[0].children[0].name = "Протеин";
    categories[0].children[0].description = "Сравните упаковки протеина.";
    flushCatalog(categories);
    expect(title.getTitle()).toBe("Протеин — Армения | ATHLON");
    expect(description()).toBe(
      "Сравните упаковки протеина. Бесплатная доставка по всей Армении.",
    );
    expect(
      fixture.nativeElement.querySelector(
        '.category-navigation a[href="/en/catalog/protein"]',
      ),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '.category-navigation a[href="/ru/catalog/protein"]',
      ),
    ).toBeTruthy();
  });

  for (const path of ["/en/search?q=whey", "/en/catalog/protein?q=whey"]) {
    it(`uses search metadata and hides category guidance for ${path}`, async () => {
      await visit("/en/catalog/protein");
      flushCatalog();
      await visit(path);
      flushCatalog();
      expect(title.getTitle()).toBe("Search results: “whey” | ATHLON");
      expect(description()).not.toContain("protein packages");
      expect(description()).toContain("Search");
      expect(
        fixture.nativeElement.querySelector(".category-guidance"),
      ).toBeNull();
    });
  }

  it("clears category copy for unknown and unpublished categories", async () => {
    await visit("/en/catalog/protein");
    flushCatalog();
    await visit("/en/catalog/unknown");
    flushCatalog();
    expect(title.getTitle()).toBe("Catalog — Armenia | ATHLON");
    expect(description()).not.toContain("protein packages");
    expect(
      fixture.nativeElement.querySelector(".category-introduction"),
    ).toBeNull();
    await visit("/en/catalog/protein");
    flushCatalog([]);
    expect(title.getTitle()).toBe("Catalog — Armenia | ATHLON");
    expect(
      fixture.nativeElement.querySelector(".category-introduction"),
    ).toBeNull();
  });

  it("clears category metadata and guidance after an API error", async () => {
    await visit("/en/catalog/protein");
    flushCatalog();
    await visit("/en/catalog/new-category");
    http
      .expectOne((request) => request.url.endsWith("/categories"))
      .flush({}, { status: 503, statusText: "Unavailable" });
    http.match((request) => request.url.endsWith("/products"));
    fixture.detectChanges();
    expect(title.getTitle()).toBe("Catalog — Armenia | ATHLON");
    expect(description()).not.toContain("protein packages");
    expect(
      fixture.nativeElement.querySelector(".category-guidance"),
    ).toBeNull();
  });

  it("does not leave category metadata on an unrelated public page or after destruction", async () => {
    await visit("/en/catalog/protein");
    flushCatalog();
    await visit("/en/unrelated-page");
    expect(title.getTitle()).toBe("Page not found | ATHLON");
    expect(description()).not.toContain("protein packages");
    await visit("/en/catalog/protein");
    flushCatalog();
    fixture.destroy();
    expect(description()).not.toContain("protein packages");
    expect(title.getTitle()).not.toContain("Protein");
  });
});
