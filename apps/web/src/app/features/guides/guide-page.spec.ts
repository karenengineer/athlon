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
import { supportedLocales } from "../../core/i18n/i18n.service";
import { guideSlugs } from "./guide-slugs";
import { guideIndex, guidesCopy } from "./guide-index";
import { guides } from "./guides-content";

describe("Guides", () => {
  let fixture: ComponentFixture<App>;
  let router: Router;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(App);
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
  });

  async function visit(path: string): Promise<void> {
    await router.navigateByUrl(path);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const page = (): HTMLElement =>
    fixture.nativeElement.querySelector("app-guide-page");
  const schemas = () =>
    Array.from(
      document.head.querySelectorAll('script[type="application/ld+json"]'),
    ).map((script) => JSON.parse(script.textContent ?? "{}"));
  const canonical = () =>
    document.head.querySelector('link[rel="canonical"]')?.getAttribute("href");

  it("defines every guide in every locale with content", () => {
    for (const slug of guideSlugs)
      for (const locale of supportedLocales) {
        const guide = guides[slug].copy[locale];
        expect(guideIndex[slug].heading[locale].trim()).not.toBe("");
        expect(guide.description.trim()).not.toBe("");
        expect(guide.sections.length).toBeGreaterThanOrEqual(3);
      }
  });

  it.each(supportedLocales)(
    "lists every guide on /%s/guides",
    async (locale) => {
      await visit(`/${locale}/guides`);
      expect(page().querySelector("h1")?.textContent?.trim()).toBe(
        guidesCopy[locale].heading,
      );
      const links = Array.from(
        page().querySelectorAll(".guide-list a"),
      ) as HTMLAnchorElement[];
      expect(links.map((link) => link.getAttribute("href"))).toEqual(
        guideSlugs.map((slug) => `/${locale}/guides/${slug}`),
      );
      expect(TestBed.inject(Title).getTitle()).toBe(
        `${guidesCopy[locale].title} | ATHLON`,
      );
      expect(canonical()).toBe(`https://athlon.am/${locale}/guides`);
    },
  );

  it.each(supportedLocales)(
    "renders a guide with Article data and a shop link in %s",
    async (locale) => {
      await visit(`/${locale}/guides/creatine-guide`);
      const guide = {
        ...guides["creatine-guide"].copy[locale],
        heading: guideIndex["creatine-guide"].heading[locale],
      };
      expect(page().querySelectorAll("h1")).toHaveLength(1);
      expect(page().querySelector("h1")?.textContent?.trim()).toBe(
        guide.heading,
      );
      expect(page().querySelectorAll(".guide-section")).toHaveLength(
        guide.sections.length,
      );
      expect(
        page().querySelector(`a[href="/${locale}/catalog/creatine"]`),
      ).not.toBeNull();
      expect(TestBed.inject(Title).getTitle()).toBe(`${guide.title} | ATHLON`);
      expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(
        guide.description,
      );
      expect(canonical()).toBe(
        `https://athlon.am/${locale}/guides/creatine-guide`,
      );
      const article = schemas().find((value) => value["@type"] === "Article");
      expect(article).toMatchObject({
        headline: guide.heading,
        inLanguage: locale,
        datePublished: "2026-11-23",
      });
    },
  );

  it("links the sports-nutrition guide to /catalog", async () => {
    await visit("/en/guides/original-vs-fake-supplements");
    expect(
      page().querySelector('.guide-actions a[href="/en/catalog"]'),
    ).not.toBeNull();
  });

  it("returns a noindex 404 for an unknown guide", async () => {
    await visit("/en/guides/unknown");
    expect(page().querySelector("h1")?.textContent?.trim()).toBe(
      "Page not found",
    );
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe(
      "noindex, follow",
    );
  });
});
