import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { I18nService } from "../../core/i18n/i18n.service";
import { Footer } from "./footer";

describe("Footer social links", () => {
  it("shows only configured public social destinations", async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();

    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll(
        "[data-testid='footer-social-link']",
      ),
    );

    expect(links.map((link) => link.dataset["social"])).toEqual([
      "instagram",
      "facebook",
    ]);
    expect(
      links.map((link) => link.querySelector("img")?.getAttribute("src")),
    ).toEqual(["/social/instagram.svg", "/social/facebook.svg"]);
    expect(links[0].href).toBe(
      "https://www.instagram.com/athlon.sports.nutrition/",
    );
    expect(links[0].getAttribute("aria-disabled")).toBeNull();
    expect(links[1].href).toBe(
      "https://www.facebook.com/profile.php?id=61594888554559",
    );
    expect(links[1].getAttribute("aria-disabled")).toBeNull();
  });
});

describe("Footer information navigation", () => {
  it.each([
    [
      "hy",
      ["ATHLON-ի մասին", "Կապ", "Առաքում և վճարում", "Վերադարձ և փոխանակում"],
    ],
    ["ru", ["Об ATHLON", "Контакты", "Доставка и оплата", "Возврат и обмен"]],
    [
      "en",
      [
        "About ATHLON",
        "Contact",
        "Delivery and payment",
        "Returns and exchanges",
      ],
    ],
  ])("exposes localized public links in %s", async (locale, labels) => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([])],
    }).compileComponents();
    TestBed.inject(I18nService).setLocale(locale as string);
    const fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
    const links = Array.from(
      fixture.nativeElement.querySelectorAll(".footer-information a"),
    ) as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      `/${locale}/about`,
      `/${locale}/contact`,
      `/${locale}/delivery`,
      `/${locale}/returns`,
    ]);
    expect(links.map((link) => link.textContent?.trim())).toEqual(labels);
  });
});
