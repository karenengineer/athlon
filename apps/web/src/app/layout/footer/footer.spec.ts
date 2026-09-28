import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { Footer } from "./footer";

describe("Footer social links", () => {
  it("shows all public social icons in the footer", async () => {
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
      "whatsapp",
      "telegram",
    ]);
    expect(
      links.map((link) => link.querySelector("img")?.getAttribute("src")),
    ).toEqual([
      "/social/instagram.svg",
      "/social/facebook.svg",
      "/social/whatsapp.svg",
      "/social/telegram.svg",
    ]);
  });
});
