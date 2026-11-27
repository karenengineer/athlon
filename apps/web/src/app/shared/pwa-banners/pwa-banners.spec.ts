import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { I18nService } from "../../core/i18n/i18n.service";
import { PwaService } from "../../core/pwa/pwa.service";
import { PwaBanners } from "./pwa-banners";

describe("PwaBanners", () => {
  const pwa = {
    online: signal(true),
    install: signal<"none" | "prompt" | "ios">("none"),
    updateReady: signal(false),
    promptInstall: vi.fn(),
    dismissInstall: vi.fn(),
    reload: vi.fn(),
  };

  beforeEach(() => {
    pwa.online.set(true);
    pwa.install.set("none");
    pwa.updateReady.set(false);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [PwaBanners],
      providers: [{ provide: PwaService, useValue: pwa }],
    });
    TestBed.inject(I18nService).setLocale("en");
  });

  function render(quiet = false, part: "offline" | "floating" = "floating") {
    const fixture = TestBed.createComponent(PwaBanners);
    fixture.componentRef.setInput("quiet", quiet);
    fixture.componentRef.setInput("part", part);
    fixture.detectChanges();
    return {
      fixture,
      el: fixture.nativeElement as HTMLElement,
    };
  }

  it("shows nothing by default", () => {
    expect(render().el.textContent?.trim()).toBe("");
  });

  it("tells the shopper they are offline and the basket is saved", () => {
    pwa.online.set(false);
    pwa.install.set("prompt");
    const { el } = render(false, "offline");
    expect(
      el.querySelector("[data-testid=pwa-offline]")?.textContent,
    ).toContain("You're offline. Your basket is saved");
    // The in-flow offline notice never also renders the floating card.
    expect(el.querySelector("[data-testid=pwa-install]")).toBeNull();
    expect(render().el.querySelector("[data-testid=pwa-offline]")).toBeNull();
  });

  it("offers a reload when a new version is ready", () => {
    pwa.updateReady.set(true);
    pwa.install.set("prompt");
    const { el } = render();
    expect(el.querySelector("[data-testid=pwa-install]")).toBeNull();
    (
      el.querySelector("[data-testid=pwa-update] button") as HTMLElement
    ).click();
    expect(pwa.reload).toHaveBeenCalled();
  });

  it("offers install where the browser supports it, and can be dismissed", () => {
    pwa.install.set("prompt");
    const { el } = render();
    expect(el.textContent).toContain("Install the ATHLON app");
    (
      el.querySelector("[data-testid=pwa-install-button]") as HTMLElement
    ).click();
    expect(pwa.promptInstall).toHaveBeenCalled();
    (
      el.querySelector("[data-testid=pwa-install-dismiss]") as HTMLElement
    ).click();
    expect(pwa.dismissInstall).toHaveBeenCalled();
  });

  it("shows the Share → Add to Home Screen hint on iPhone", () => {
    pwa.install.set("ios");
    const { el } = render();
    expect(el.textContent).toContain("Tap Share, then “Add to Home Screen”");
    expect(el.querySelector("[data-testid=pwa-install-button]")).toBeNull();
  });

  it("stays out of the way during checkout", () => {
    pwa.install.set("prompt");
    expect(
      render(true).el.querySelector("[data-testid=pwa-install]"),
    ).toBeNull();
  });
});
