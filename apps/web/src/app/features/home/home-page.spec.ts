import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { REQUEST, RESPONSE_INIT } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { Product } from "../../core/api/catalog.models";
import { HomePage } from "./home-page";

function product(id: string, brand: string): Product {
  return {
    id,
    sku: id,
    slug: id,
    name: id,
    shortDescription: null,
    price: null,
    currency: "AMD",
    availability: "IN_STOCK",
    featured: false,
    isNew: false,
    category: { slug: "protein", name: "Protein" },
    brand: { slug: brand, name: brand },
    images: [],
  };
}

describe("HomePage", () => {
  let http: HttpTestingController;
  let localeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let request: Request | null;
  let response: ResponseInit;

  beforeEach(async () => {
    localeParams = new BehaviorSubject(convertToParamMap({ locale: "en" }));
    request = null;
    response = { headers: new Headers({ "X-Test": "preserved" }) };
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: REQUEST, useFactory: () => request },
        { provide: RESPONSE_INIT, useFactory: () => response },
        {
          provide: ActivatedRoute,
          useValue: {
            parent: {
              paramMap: localeParams,
              snapshot: { paramMap: localeParams.value },
            },
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    document.cookie = "athlon_home_brand=; Path=/; Max-Age=0";
    http.verify();
  });

  function canonicalProducts() {
    return http.expectOne(
      (request) =>
        request.url.endsWith("/products") &&
        request.params.get("category") === "sports-nutrition" &&
        request.params.get("sort") === "displayOrder" &&
        request.params.get("pageSize") === "8" &&
        !request.params.has("brand"),
    );
  }

  function preferredProducts(brand: string, locale = "en") {
    return http.expectOne(
      (request) =>
        request.url.endsWith("/products") &&
        request.params.get("brand") === brand &&
        request.params.get("locale") === locale &&
        request.params.get("category") === "sports-nutrition" &&
        request.params.get("sort") === "displayOrder" &&
        request.params.get("availability") === "IN_STOCK" &&
        request.params.get("pageSize") === "4",
    );
  }

  function renderHome(locale = "en"): HTMLElement {
    localeParams.next(convertToParamMap({ locale }));
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    canonicalProducts().flush({ items: [] });
    http
      .match(
        (request) =>
          request.url.endsWith("/products") && request.params.has("brand"),
      )
      .forEach((request) => request.flush({ items: [] }));
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it.each(["trec", "optimum-nutrition"])(
    "leads the showcase with in-stock %s products and fills eight distinct slots",
    (brand) => {
      request = new Request("https://athlon.am/en", {
        headers: { Cookie: `athlon_home_brand=${brand}` },
      });
      const fixture = TestBed.createComponent(HomePage);
      const first = product("preferred-first", brand);
      const next = product("preferred-next", brand);
      const otherProducts = Array.from({ length: 7 }, (_, index) =>
        product(`other-${index}`, "other-brand"),
      );

      const preferred = preferredProducts(brand);
      canonicalProducts().flush({
        items: [otherProducts[0], first, ...otherProducts.slice(1)],
      });
      preferred.flush({
        items: [
          first,
          next,
          { ...product("unavailable", brand), availability: "OUT_OF_STOCK" },
          otherProducts[6],
        ],
      });
      fixture.detectChanges();

      const links = (fixture.nativeElement as HTMLElement).querySelectorAll(
        ".showcase app-product-card h3 a",
      );
      expect(Array.from(links, (link) => link.textContent?.trim())).toEqual([
        "preferred-first",
        "preferred-next",
        "other-0",
        "other-1",
        "other-2",
        "other-3",
        "other-4",
        "other-5",
      ]);
      const headers = new Headers(response.headers);
      expect(headers.get("Cache-Control")).toBe("private, no-store");
      expect(headers.has("Set-Cookie")).toBe(false);
      expect(headers.get("X-Test")).toBe("preserved");

      localeParams.next(convertToParamMap({ locale: "ru" }));
      canonicalProducts().flush({ items: [] });
      preferredProducts(brand, "ru").flush({ items: [] });
    },
  );

  it.each([
    [0.49, "trec"],
    [0.5, "optimum-nutrition"],
  ])("assigns and persists the brand at random draw %s", (draw, brand) => {
    request = new Request("https://athlon.am/en", {
      headers: { Cookie: "athlon_home_brand=unsupported" },
    });
    const random = vi.spyOn(Math, "random").mockReturnValue(draw);
    try {
      TestBed.createComponent(HomePage);
    } finally {
      random.mockRestore();
    }
    canonicalProducts().flush({ items: [] });
    preferredProducts(brand).flush({ items: [] });

    expect(new Headers(response.headers).get("Set-Cookie")).toBe(
      `athlon_home_brand=${brand}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`,
    );
  });

  it("uses canonical showcase products when the preferred brand request fails", () => {
    document.cookie = "athlon_home_brand=trec; Path=/";
    const fixture = TestBed.createComponent(HomePage);
    canonicalProducts().flush({ items: [product("fallback", "other-brand")] });
    preferredProducts("trec").flush(
      {},
      { status: 503, statusText: "Unavailable" },
    );
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector(".showcase app-product-card h3 a")
        ?.textContent?.trim(),
    ).toBe("fallback");
    expect(
      fixture.nativeElement.querySelector("[data-testid=home-error]"),
    ).toBeNull();
  });

  function renderCommunity(locale = "en"): HTMLElement {
    const section =
      renderHome(locale).querySelector<HTMLElement>(".community")!;
    expect(section).not.toBeNull();
    return section;
  }

  for (const [locale, delivery, trust] of [
    [
      "hy",
      "ԱՆՎՃԱՐ ԱՌԱՔՈՒՄ ՈՂՋ ՀԱՅԱՍՏԱՆՈՒՄ · 041 44 88 55",
      "Օրիգինալ ապրանք միայն արտադրողից",
    ],
    [
      "ru",
      "БЕСПЛАТНАЯ ДОСТАВКА ПО ВСЕЙ АРМЕНИИ · 041 44 88 55",
      "Оригинальная продукция напрямую от производителя",
    ],
    [
      "en",
      "FREE DELIVERY THROUGHOUT ARMENIA · 041 44 88 55",
      "Original products directly from the manufacturer",
    ],
  ] as const) {
    it(`places localized delivery and trust headings directly after the hero H1 in ${locale}`, () => {
      const home = renderHome(locale);
      const hero = home.querySelector(".hero")!;
      const heroCopy = hero.querySelector(".hero-copy")!;
      const [heading, deliveryHeading, trustHeading] = heroCopy.children;

      expect(home.querySelectorAll("h1")).toHaveLength(1);
      expect(heroCopy.children).toHaveLength(3);
      expect(heading?.tagName).toBe("H1");
      expect(deliveryHeading?.tagName).toBe("H2");
      expect(deliveryHeading?.textContent?.trim()).toBe(delivery);
      expect(deliveryHeading?.textContent).toContain("041 44 88 55");
      expect(trustHeading?.tagName).toBe("H3");
      expect(trustHeading?.textContent?.trim()).toBe(trust);
      const image = hero.querySelector("img")!;
      expect(image.getAttribute("src")).toBe("/brand/athlon-hero-wide.jpeg");
      expect(image.width).toBe(1280);
      expect(image.height).toBe(634);
    });
  }

  it("opens the real ATHLON profile from both community actions", () => {
    const section = renderCommunity();
    const links = Array.from(section.querySelectorAll("a"));

    expect(links).toHaveLength(2);
    expect(links[0].textContent).toContain("@athlon.sports.nutrition");
    expect(links[1].textContent).toContain("Follow on Instagram");
    for (const link of links) {
      expect(link.href).toBe(
        "https://www.instagram.com/athlon.sports.nutrition/",
      );
      expect(link.target).toBe("_blank");
      expect(link.relList.contains("noopener")).toBe(true);
      expect(link.relList.contains("noreferrer")).toBe(true);
    }
  });

  it("shows creatine, training and chocolate whey photos in order with reserved space", () => {
    const section = renderCommunity();
    const images = Array.from(section.querySelectorAll("img"));

    expect(images.map((image) => image.getAttribute("src"))).toEqual([
      "/community/trec-creatine.webp",
      "/community/training.webp",
      "/community/trec-chocolate-whey.webp",
    ]);
    for (const image of images) {
      expect(image.width).toBe(960);
      expect(image.height).toBe(960);
      expect(image.getAttribute("srcset")).toContain("480w");
      expect(image.getAttribute("srcset")).toContain("960w");
      expect(image.getAttribute("loading")).toBe("lazy");
      expect(image.getAttribute("decoding")).toBe("async");
    }
  });

  for (const [locale, heading, follow, alts] of [
    [
      "hy",
      "Միացիր ATHLON-ին",
      "Հետևել Instagram-ում",
      [
        "TREC Creatine կրեատին և շեյքեր մարզասրահում",
        "Մարզիկը մարզվում է համրով",
        "Շոկոլադե TREC Whey 100 պրոտեին և շեյքեր",
      ],
    ],
    [
      "ru",
      "Присоединяйся к ATHLON",
      "Подписаться в Instagram",
      [
        "Креатин TREC Creatine и шейкер в спортзале",
        "Спортсмен тренируется с гантелью",
        "Шоколадный протеин TREC Whey 100 и шейкер",
      ],
    ],
    [
      "en",
      "Join ATHLON",
      "Follow on Instagram",
      [
        "TREC Creatine and shaker in the gym",
        "Athlete training with a dumbbell",
        "Chocolate TREC Whey 100 protein and shaker",
      ],
    ],
  ] as const) {
    it(`localizes community content and photo descriptions in ${locale}`, () => {
      const section = renderCommunity(locale);

      expect(section.querySelector("h2")?.textContent?.trim()).toBe(heading);
      expect(section.querySelector(".community-follow")?.textContent).toContain(
        follow,
      );
      expect(
        Array.from(section.querySelectorAll("img")).map((image) => image.alt),
      ).toEqual(alts);
    });
  }
});
