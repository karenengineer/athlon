import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { HomePage } from "./home-page";

describe("HomePage", () => {
  let http: HttpTestingController;
  let localeParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    localeParams = new BehaviorSubject(convertToParamMap({ locale: "en" }));
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
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

  afterEach(() => http.verify());

  function renderHome(locale = "en"): HTMLElement {
    localeParams.next(convertToParamMap({ locale }));
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [],
        meta: { page: 1, pageSize: 8, total: 0, totalPages: 0 },
      });
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function renderCommunity(locale = "en"): HTMLElement {
    const section =
      renderHome(locale).querySelector<HTMLElement>(".community")!;
    expect(section).not.toBeNull();
    return section;
  }

  for (const [locale, delivery] of [
    ["hy", "ԱՆՎՃԱՐ ԱՌԱՔՈՒՄ ՈՂՋ ՀԱՅԱՍՏԱՆՈՒՄ · 041 44 88 55"],
    ["ru", "БЕСПЛАТНАЯ ДОСТАВКА ПО ВСЕЙ АРМЕНИИ · 041 44 88 55"],
    ["en", "FREE DELIVERY THROUGHOUT ARMENIA · 041 44 88 55"],
  ] as const) {
    it(`places the localized delivery heading directly after the hero H1 in ${locale}`, () => {
      const home = renderHome(locale);
      const hero = home.querySelector(".hero")!;
      const heading = hero.querySelector("h1")!;
      const deliveryHeading = heading.nextElementSibling;

      expect(home.querySelectorAll("h1")).toHaveLength(1);
      expect(deliveryHeading?.tagName).toBe("H2");
      expect(deliveryHeading?.textContent?.trim()).toBe(delivery);
      expect(deliveryHeading?.textContent).toContain("041 44 88 55");
      expect(deliveryHeading?.nextElementSibling?.classList).toContain(
        "hero-text",
      );
      expect(hero.querySelector(".primary-button")?.getAttribute("href")).toBe(
        `/${locale}/catalog`,
      );
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
