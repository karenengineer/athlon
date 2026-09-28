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

  it("renders mobile home and language controls without header basket or social controls", async () => {
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
    expect(
      fixture.nativeElement.querySelector("[data-testid='basket-link']"),
    ).toBeNull();
  });
});
