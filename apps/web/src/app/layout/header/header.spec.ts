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
});
