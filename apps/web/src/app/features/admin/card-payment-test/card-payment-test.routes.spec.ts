import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { AdminShell } from "../admin-shell";
import { adminAuthGuard } from "../auth/admin-auth.guard";
import { routes } from "../../../app.routes";
import { cardPaymentTestGuard } from "./card-payment-test.guard";

describe("isolated mock card-payment routes", () => {
  it("registers dedicated test pages at the app root behind both guards with no nav entry", async () => {
    const parent = routes.find(
      (route) => route.path === "card-payment-test/:locale",
    );
    expect(parent?.canActivate).toContain(adminAuthGuard);
    expect(parent?.canActivate).toContain(cardPaymentTestGuard);
    expect(parent?.children?.map((route) => route.path)).toEqual([
      "",
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
});
