import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { AdminShell } from "../admin-shell";
import { adminAuthGuard } from "../auth/admin-auth.guard";
import { routes } from "../../../app.routes";
import { cardPaymentTestGuard } from "./card-payment-test.guard";
import { serverRoutes } from "../../../app.routes.server";
import { RenderMode } from "@angular/ssr";
import { localeGuard } from "../../../core/i18n/locale.guard";

describe("isolated mock card-payment routes", () => {
  it("keeps regular localized basket checkout on its ordinary locale guard without mock mode", async () => {
    const storefront = routes.find((route) => route.path === ":locale");
    expect(storefront?.canMatch).toEqual([localeGuard]);
    const basket = storefront?.children?.find(
      (route) => route.path === "basket",
    );
    expect(basket?.data?.["cardPaymentTestMode"]).not.toBe(true);
    expect(basket?.canActivate).not.toContain(cardPaymentTestGuard);
    const mock = routes.find(
      (route) => route.path === "card-payment-test/:locale",
    )?.children?.[0];
    expect(await basket?.loadComponent?.()).toBe(await mock?.loadComponent?.());
  });

  it("registers dedicated test pages behind the config-authoritative guard with no nav entry", async () => {
    const parent = routes.find(
      (route) => route.path === "card-payment-test/:locale",
    );
    expect(parent?.canActivate).not.toContain(adminAuthGuard);
    expect(parent?.canActivate).toContain(cardPaymentTestGuard);
    expect(parent?.children?.map((route) => route.path)).toEqual([
      "",
      "success/:reference",
      "payment/:reference",
    ]);
    expect(parent?.children?.[0].data).toEqual({ cardPaymentTestMode: true });
    expect(parent?.children?.every((route) => !route.redirectTo)).toBe(true);

    TestBed.configureTestingModule({
      imports: [AdminShell],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(AdminShell);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      "Card payment test",
    );
    expect(
      fixture.nativeElement.querySelector('a[href*="card-payment-test"]'),
    ).toBeNull();
  });

  it.each(["card-payment-test/**"])(
    "renders %s in the browser and excludes it from indexing",
    (path) => {
      const route = serverRoutes.find((candidate) => candidate.path === path);
      expect(route?.renderMode).toBe(RenderMode.Client);
      expect(route?.headers?.["X-Robots-Tag"]).toBe("noindex, nofollow");
      expect(serverRoutes.indexOf(route!)).toBeLessThan(
        serverRoutes.findIndex((candidate) => candidate.path === "**"),
      );
    },
  );
});
