import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { I18nService } from "../../core/i18n/i18n.service";
import { BasketService } from "../../core/basket/basket.service";
import { Header } from "./header";

describe("Header search suggestions", () => {
  it.each(["site-search", "mobile-site-search"])(
    "debounces %s suggestions, cancels stale requests, and closes on Escape",
    async (inputId) => {
      await TestBed.configureTestingModule({
        imports: [Header],
        providers: [
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
        ],
      }).compileComponents();
      TestBed.inject(I18nService).setLocale("en");
      const http = TestBed.inject(HttpTestingController);
      const fixture = TestBed.createComponent(Header);
      fixture.detectChanges();
      const input = fixture.nativeElement.querySelector(
        `#${inputId}`,
      ) as HTMLInputElement;
      const setValue = (value: string) => {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        fixture.detectChanges();
      };
      const url = "/api/v1/products/search-suggestions";

      vi.useFakeTimers();
      try {
        setValue("p");
        vi.advanceTimersByTime(300);
        http.expectNone((request) => request.url === url);
        setValue("pro");
        http.expectNone((request) => request.url === url);
        vi.advanceTimersByTime(300);
        const stale = http.expectOne(
          (request) => request.url === url && request.params.get("q") === "pro",
        );
        setValue("pratein");
        expect(stale.cancelled).toBe(true);
        vi.advanceTimersByTime(300);
        http
          .expectOne(
            (request) =>
              request.url === url &&
              request.params.get("q") === "pratein" &&
              request.params.get("locale") === "en",
          )
          .flush([{ slug: "demo-protein", name: "Demo protein" }]);
        fixture.detectChanges();
        const link = input
          .closest("form")
          ?.querySelector(".search-suggestions a");
        expect(link?.getAttribute("href")).toBe("/en/product/demo-protein");
        expect(link?.textContent?.trim()).toBe("Demo protein");

        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        fixture.detectChanges();
        expect(
          input.closest("form")?.querySelector(".search-suggestions"),
        ).toBeNull();
        http.verify();
      } finally {
        vi.useRealTimers();
      }
    },
  );
});

describe("Header logo presentation", () => {
  it("keeps the delivery announcement out of the shared header in every locale", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    const i18n = TestBed.inject(I18nService);

    for (const locale of ["hy", "ru", "en"] as const) {
      i18n.setLocale(locale);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(".announcement")).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain("041 44 88 55");
    }
  });

  it("renders a circular 64px logo without stretching its image", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    const image: HTMLImageElement =
      fixture.nativeElement.querySelector(".brand img");
    const style = getComputedStyle(image);
    expect(style.width).toBe("64px");
    expect(style.height).toBe("64px");
    expect(style.borderRadius).toBe("50%");
    expect(style.objectFit).toBe("cover");
    expect(image.width).toBe(64);
    expect(image.height).toBe(64);
  });
  it("renders a dedicated mobile search bar outside the hamburger menu", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const mobileSearch: HTMLFormElement | null =
      fixture.nativeElement.querySelector("form.mobile-search");
    const menu = fixture.nativeElement.querySelector("#primary-navigation");

    expect(mobileSearch).not.toBeNull();
    expect(menu.contains(mobileSearch)).toBe(false);
    expect(mobileSearch?.querySelector('input[type="search"]')).not.toBeNull();
    expect(mobileSearch?.querySelector('button[type="submit"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector(".menu-button")).toBeNull();
  });

  it("keeps a direct catalog entry available in the compact header", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector(
      "[data-testid='mobile-catalog-link']",
    ) as HTMLAnchorElement;

    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/hy/catalog");
    expect(link.textContent.trim()).toBe("Կատալոգ");
  });

  it("renders language links for desktop and a language dropdown for mobile", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const languageLinks = Array.from(
      fixture.nativeElement.querySelectorAll("[data-testid=language-link]"),
    ).map((node) => (node as HTMLElement).textContent?.trim());
    const mobileLanguage: HTMLSelectElement | null =
      fixture.nativeElement.querySelector(
        "[data-testid=mobile-language-select]",
      );

    expect(languageLinks).toEqual(["HY", "RU", "EN"]);
    expect(mobileLanguage).not.toBeNull();
    expect(
      Array.from(mobileLanguage?.options ?? []).map((option) => option.value),
    ).toEqual(["hy", "ru", "en"]);
  });

  it("keeps social links out of the header because they live in the footer", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector(".social-menu")).toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll(
        "[data-testid='header-social-link']",
      ).length,
    ).toBe(0);
  });

  it("shows a desktop header basket link with the live item count", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector(
      "[data-testid='header-basket-link']",
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/hy/basket");
    expect(
      fixture.nativeElement
        .querySelector("[data-testid='header-basket-count']")
        .textContent.trim(),
    ).toBe("0");

    TestBed.inject(BasketService).add(
      {
        id: "product-id",
        sku: "SKU",
        slug: "product",
        name: "Product",
        price: "13000",
        currency: "AMD",
        availability: "IN_STOCK",
        featured: false,
        isNew: false,
        category: { slug: "protein", name: "Protein" },
        brand: null,
        images: [],
        shortDescription: null,
      } as never,
      2,
    );
    fixture.detectChanges();
    expect(
      fixture.nativeElement
        .querySelector("[data-testid='header-basket-count']")
        .textContent.trim(),
    ).toBe("2");
    localStorage.clear();
  });

  it("renders mobile home and language controls without social controls", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const mobileHome = fixture.nativeElement.querySelector(
      "[data-testid='mobile-home-link']",
    ) as HTMLAnchorElement;
    const mobileLanguage = fixture.nativeElement.querySelector(
      "[data-testid='mobile-language-select']",
    ) as HTMLSelectElement;

    expect(mobileHome).not.toBeNull();
    expect(mobileHome.getAttribute("href")).toBe("/hy");
    expect(mobileHome.querySelector(".favicon-logo")).not.toBeNull();
    expect(mobileLanguage).not.toBeNull();
  });
});

describe("Header information navigation", () => {
  it.each([
    ["hy", "Մեր մասին", "Կապ"],
    ["ru", "О нас", "Контакты"],
    ["en", "About Us", "Contact"],
  ])(
    "links to About Us and Contact after Catalog in both %s layouts",
    async (locale, aboutLabel, contactLabel) => {
      await TestBed.configureTestingModule({
        imports: [Header],
        providers: [provideRouter([])],
      }).compileComponents();
      TestBed.inject(I18nService).setLocale(locale);
      const fixture = TestBed.createComponent(Header);
      fixture.detectChanges();
      const header: HTMLElement = fixture.nativeElement;
      const aboutLinks = Array.from(
        header.querySelectorAll(`a[href="/${locale}/catalog"] + a`),
      );
      const contactLinks = Array.from(
        header.querySelectorAll(`a[href="/${locale}/about"] + a`),
      );

      expect(aboutLinks.map((link) => link.getAttribute("href"))).toEqual([
        `/${locale}/about`,
        `/${locale}/about`,
      ]);
      expect(aboutLinks.map((link) => link.textContent?.trim())).toEqual([
        aboutLabel,
        aboutLabel,
      ]);
      expect(contactLinks.map((link) => link.getAttribute("href"))).toEqual([
        `/${locale}/contact`,
        `/${locale}/contact`,
      ]);
      expect(contactLinks.map((link) => link.textContent?.trim())).toEqual([
        contactLabel,
        contactLabel,
      ]);
    },
  );
});
