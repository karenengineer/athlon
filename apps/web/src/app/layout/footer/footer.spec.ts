import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
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
    expect(links[0].href).toBe("https://www.instagram.com/__athlon__/");
    expect(links[0].getAttribute("aria-disabled")).toBeNull();
    expect(links[1].href).toBe(
      "https://www.facebook.com/profile.php?id=61594888554559",
    );
    expect(links[1].getAttribute("aria-disabled")).toBeNull();
  });
});
