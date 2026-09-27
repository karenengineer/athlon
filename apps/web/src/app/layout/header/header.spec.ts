import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { Header } from "./header";

describe("Header logo presentation", () => {
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

  it("renders square placeholder social links in the header", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll(
        "[data-testid='header-social-link']",
      ),
    );

    expect(links.length).toBe(4);
    expect(links.map((link) => link.dataset["social"])).toEqual([
      "instagram",
      "facebook",
      "whatsapp",
      "telegram",
    ]);
    expect(links.every((link) => link.hasAttribute("href"))).toBe(false);
    expect(
      links.every((link) => link.getAttribute("aria-disabled") === "true"),
    ).toBe(true);
    expect(links.every((link) => link.querySelector("svg"))).toBe(true);

    const firstStyle = getComputedStyle(links[0]);
    expect(firstStyle.width).toBe("36px");
    expect(firstStyle.height).toBe("36px");
  });

  it("shows a colored social trigger and closes the mobile socials on outside click", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const menu: HTMLDetailsElement =
      fixture.nativeElement.querySelector(".social-menu");
    const trigger = fixture.nativeElement.querySelector(
      "[data-testid='social-menu-trigger']",
    ) as HTMLElement;

    expect(trigger.textContent?.trim()).not.toBe("•••");
    expect(trigger.querySelector("svg")).not.toBeNull();
    expect(getComputedStyle(trigger).backgroundColor).not.toBe(
      "rgb(23, 23, 25)",
    );

    menu.open = true;
    document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    fixture.detectChanges();

    expect(menu.open).toBe(false);
  });

  it("renders a mobile home logo before the socials trigger", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const headerContent: HTMLElement =
      fixture.nativeElement.querySelector(".header-content");
    const mobileHome = fixture.nativeElement.querySelector(
      "[data-testid='mobile-home-link']",
    ) as HTMLAnchorElement;
    const socialMenu: HTMLElement =
      fixture.nativeElement.querySelector(".social-menu");

    expect(mobileHome).not.toBeNull();
    expect(mobileHome.getAttribute("href")).toBe("/hy");
    expect(mobileHome.querySelector(".favicon-logo")).not.toBeNull();
    expect(Array.from(headerContent.children).indexOf(mobileHome)).toBeLessThan(
      Array.from(headerContent.children).indexOf(socialMenu),
    );
  });

  it("toggles the social dropdown when tapping the colored social trigger", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const menu: HTMLDetailsElement =
      fixture.nativeElement.querySelector(".social-menu");
    const trigger = fixture.nativeElement.querySelector(
      "[data-testid='social-menu-trigger']",
    ) as HTMLElement;

    trigger.click();
    fixture.detectChanges();
    expect(menu.open).toBe(true);

    trigger.click();
    fixture.detectChanges();
    expect(menu.open).toBe(false);
  });

  it("renders the basket action as an icon without a visible number", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const basketLink = fixture.nativeElement.querySelector(
      "[data-testid='basket-link']",
    ) as HTMLAnchorElement;

    expect(basketLink).not.toBeNull();
    expect(
      basketLink.querySelector("[data-testid='basket-icon']"),
    ).not.toBeNull();
    expect(basketLink.querySelector("b")).toBeNull();
  });

  it("uses a shopping cart style basket icon instead of a bin-like bag", async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();

    const basketIcon = fixture.nativeElement.querySelector(
      "[data-testid='basket-icon']",
    ) as SVGElement;

    expect(basketIcon.querySelectorAll("circle").length).toBe(2);
    expect(
      Array.from(basketIcon.querySelectorAll("path")).some((path) =>
        path.getAttribute("d")?.includes("M3 4"),
      ),
    ).toBe(true);
  });
});
