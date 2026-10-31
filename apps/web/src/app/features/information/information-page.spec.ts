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

const pageCases = [
  [
    "hy",
    "about",
    "ATHLON-ի մասին",
    "Սպորտային սննդի առցանց խանութ Հայաստանում",
  ],
  ["hy", "contact", "Կապ", "Կապվեք ATHLON-ի հետ"],
  ["hy", "delivery", "Առաքում և վճարում", "Անվճար առաքում ողջ Հայաստանում"],
  [
    "hy",
    "returns",
    "Վերադարձ և փոխանակում",
    "Վերադարձի կամ փոխանակման հարցերով",
  ],
  [
    "ru",
    "about",
    "Об ATHLON",
    "Интернет-магазин спортивного питания в Армении",
  ],
  ["ru", "contact", "Контакты", "Свяжитесь с ATHLON"],
  [
    "ru",
    "delivery",
    "Доставка и оплата",
    "Бесплатная доставка по всей Армении",
  ],
  ["ru", "returns", "Возврат и обмен", "Помощь по вопросам возврата и обмена"],
  ["en", "about", "About ATHLON", "Online sports-nutrition shop in Armenia"],
  ["en", "contact", "Contact", "Contact ATHLON"],
  [
    "en",
    "delivery",
    "Delivery and payment",
    "Free delivery throughout Armenia",
  ],
  [
    "en",
    "returns",
    "Returns and exchanges",
    "Help with return and exchange questions",
  ],
] as const;

describe("Localized information pages", () => {
  let fixture: ComponentFixture<App>;
  let router: Router;
  let meta: Meta;
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
    meta = TestBed.inject(Meta);
    http = TestBed.inject(HttpTestingController);
    meta.removeTag('name="description"');
    meta.addTag({ name: "description", content: "Original store description" });
    fixture = TestBed.createComponent(App);
  });

  afterEach(() => {
    http.verify();
    fixture.destroy();
    meta.removeTag('name="description"');
  });

  async function visit(path: string): Promise<void> {
    await router.navigateByUrl(path);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function page(): HTMLElement {
    return fixture.nativeElement.querySelector("app-information-page");
  }

  it.each(pageCases)(
    "renders /%s/%s with localized heading and metadata",
    async (locale, slug, heading, description) => {
      await visit(`/${locale}/${slug}`);
      expect(page()).not.toBeNull();
      expect(page().querySelectorAll("h1")).toHaveLength(1);
      expect(page().querySelector("h1")?.textContent?.trim()).toBe(heading);
      expect(TestBed.inject(Title).getTitle()).toBe(`${heading} | ATHLON`);
      expect(meta.getTags('name="description"')).toHaveLength(1);
      expect(meta.getTag('name="description"')?.content).toContain(description);
      expect(
        page().querySelector(`a[href="/${locale}/catalog"]`),
      ).not.toBeNull();
      http.expectNone(() => true);
    },
  );

  for (const locale of ["hy", "ru", "en"]) {
    it(`provides accessible confirmed contact links in ${locale}`, async () => {
      await visit(`/${locale}/contact`);
      expect(page()).not.toBeNull();
      expect(
        page().querySelector('a[href="tel:+37441448855"]')?.textContent,
      ).toContain("041 44 88 55");
      expect(
        page().querySelector('a[href="mailto:athlonsportgoods@gmail.com"]')
          ?.textContent,
      ).toContain("athlonsportgoods@gmail.com");
    });
  }

  it.each([
    [
      "hy",
      "Անվճար առաքում ողջ Հայաստանում՝ անկախ պատվերի գումարից",
      "կանխիկ կամ քարտով՝ առաքիչին",
      "Նշեք պատվերի համարը և ձեր հարցը",
    ],
    [
      "ru",
      "Бесплатная доставка по всей Армении независимо от суммы заказа",
      "наличными или картой курьеру",
      "Укажите номер заказа и ваш вопрос",
    ],
    [
      "en",
      "Free delivery throughout Armenia, regardless of order value",
      "cash or card to the courier",
      "Include your order reference and question",
    ],
  ])(
    "uses confirmed delivery/payment facts and assistance-only returns in %s",
    async (locale, free, payment, assistance) => {
      await visit(`/${locale}/delivery`);
      expect(page()).not.toBeNull();
      expect(page().textContent).toContain(free);
      expect(page().textContent).toContain(payment);
      expect(
        page().querySelector(`a[href="/${locale}/contact"]`),
      ).not.toBeNull();
      await visit(`/${locale}/returns`);
      expect(page().textContent).toContain(assistance);
      expect(page().textContent).not.toMatch(
        /\d|deadline|fee|unopened|eligib|days|дней|срок|комисси|невскрыт|օր|ժամկետ|վճար|չբացված/i,
      );
      expect(
        page().querySelector(`a[href="/${locale}/contact"]`),
      ).not.toBeNull();
    },
  );

  it("replaces headings, metadata, and footer links when switching locale and page", async () => {
    await visit("/en/about");
    await visit("/ru/about");
    expect(page()).not.toBeNull();
    expect(page().querySelector("h1")?.textContent).toContain("Об ATHLON");
    expect(meta.getTag('name="description"')?.content).toContain(
      "Интернет-магазин",
    );
    expect(
      fixture.nativeElement.querySelector('footer a[href="/ru/delivery"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('footer a[href="/en/delivery"]'),
    ).toBeNull();
    await visit("/ru/contact");
    expect(TestBed.inject(Title).getTitle()).toBe("Контакты | ATHLON");
    expect(meta.getTag('name="description"')?.content).toContain(
      "Свяжитесь с ATHLON",
    );
    fixture.destroy();
    expect(meta.getTag('name="description"')?.content).toBe(
      "Original store description",
    );
  });

  it("replaces information copy with the current home and product metadata", async () => {
    await visit("/en/delivery");
    expect(page()).not.toBeNull();
    await visit("/en");
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [],
        meta: { page: 1, pageSize: 8, total: 0, totalPages: 0 },
      });
    expect(meta.getTag('name="description"')?.content).toBe(
      "Online sports-nutrition shop in Armenia: protein, creatine and amino acids. Free delivery throughout Armenia.",
    );
    expect(TestBed.inject(Title).getTitle()).toBe(
      "Sports nutrition in Armenia | ATHLON",
    );
    await visit("/en/returns");
    await visit("/en/product/fixture-product");
    http
      .expectOne((request) => request.url.endsWith("/products/fixture-product"))
      .flush({
        id: "fixture-product",
        sku: "FIXTURE",
        slug: "fixture-product",
        name: "Fixture product",
        shortDescription: "Fixture",
        price: "1000",
        currency: "AMD",
        availability: "IN_STOCK",
        featured: false,
        isNew: false,
        category: { slug: "protein", name: "Protein" },
        brand: null,
        images: [],
      });
    http.expectOne((request) => request.url.endsWith("/settings")).flush({});
    http
      .expectOne((request) => request.url.endsWith("/products"))
      .flush({
        items: [],
        meta: { page: 1, pageSize: 5, total: 0, totalPages: 0 },
      });
    expect(meta.getTag('name="description"')?.content).toBe("Fixture");
    expect(TestBed.inject(Title).getTitle()).toBe(
      "Fixture product — Armenia | ATHLON",
    );
  });
});
