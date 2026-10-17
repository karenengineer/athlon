import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  Router,
  convertToParamMap,
} from "@angular/router";
import { firstValueFrom, isObservable, of, throwError } from "rxjs";
import { CardPaymentTestApiService } from "./card-payment-test-api.service";
import { cardPaymentTestGuard } from "./card-payment-test.guard";

describe("cardPaymentTestGuard", () => {
  let config: ReturnType<typeof vi.fn>;
  let createUrlTree: ReturnType<typeof vi.fn>;
  const routeFor = (locale: string) =>
    ({ paramMap: convertToParamMap({ locale }) }) as ActivatedRouteSnapshot;

  beforeEach(() => {
    config = vi.fn();
    createUrlTree = vi.fn((commands: string[]) => ({ commands }));
    TestBed.configureTestingModule({
      providers: [
        { provide: CardPaymentTestApiService, useValue: { config } },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  async function resolvedResult(value: unknown): Promise<unknown> {
    return isObservable(value) ? firstValueFrom(value) : value;
  }

  it.each(["hy", "ru", "en"])(
    "allows enabled mock mode for %s",
    async (locale) => {
      config.mockReturnValue(of({ enabled: true, mode: "MOCK" }));
      const result = TestBed.runInInjectionContext(() =>
        cardPaymentTestGuard(routeFor(locale), {} as never),
      );
      expect(await resolvedResult(result)).toBe(true);
    },
  );

  it("allows enabled Ameriabank sandbox mode", async () => {
    config.mockReturnValue(of({ enabled: true, mode: "AMERIA_SANDBOX" }));
    const result = TestBed.runInInjectionContext(() =>
      cardPaymentTestGuard(routeFor("hy"), {} as never),
    );
    expect(await resolvedResult(result)).toBe(true);
  });

  it.each([
    { enabled: false, mode: "MOCK" },
    { enabled: true, mode: "AMERIA" as never },
  ])("redirects when config is not enabled mock mode: %s", async (response) => {
    config.mockReturnValue(of(response));
    const result = TestBed.runInInjectionContext(() =>
      cardPaymentTestGuard(routeFor("hy"), {} as never),
    );
    expect(await resolvedResult(result)).toEqual({ commands: ["/admin"] });
  });

  it("rejects unsupported locales before making the capability request", async () => {
    const result = TestBed.runInInjectionContext(() =>
      cardPaymentTestGuard(routeFor("fr"), {} as never),
    );
    expect(await resolvedResult(result)).toEqual({ commands: ["/admin"] });
    expect(config).not.toHaveBeenCalled();
  });

  it("redirects to admin when the capability endpoint errors", async () => {
    config.mockReturnValue(throwError(() => new Error("unauthorized")));
    const result = TestBed.runInInjectionContext(() =>
      cardPaymentTestGuard(routeFor("en"), {} as never),
    );
    expect(await resolvedResult(result)).toEqual({ commands: ["/admin"] });
  });
});
