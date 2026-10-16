import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { catchError, map, of } from "rxjs";
import { supportedLocales } from "../../../core/i18n/i18n.service";
import { CardPaymentTestApiService } from "./card-payment-test-api.service";

export const cardPaymentTestGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const locale =
    route.paramMap.get("locale") ?? route.parent?.paramMap.get("locale");
  if (!supportedLocales.includes(locale as (typeof supportedLocales)[number])) {
    return router.createUrlTree(["/hy"]);
  }
  const home = () => router.createUrlTree([`/${locale}`]);

  return inject(CardPaymentTestApiService)
    .config()
    .pipe(
      map((config) =>
        config.enabled === true &&
        (config.mode === "MOCK" ||
          (config.mode === "AMERIA_SANDBOX" &&
            !state.url.split(/[?#]/)[0].includes("/payment/"))) &&
        typeof config.csrfToken === "string" &&
        config.csrfToken.trim()
          ? true
          : home(),
      ),
      catchError(() => of(home())),
    );
};
