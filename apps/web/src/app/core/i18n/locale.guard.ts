import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { supportedLocales } from "./i18n.service";

export const localeGuard: CanActivateFn = (route, state) => {
  const locale = route.paramMap.get("locale");
  if (supportedLocales.includes(locale as (typeof supportedLocales)[number])) {
    return true;
  }
  const safePath = state.url.split("?")[0].split("/").slice(2).join("/");
  return inject(Router).parseUrl(`/hy${safePath ? `/${safePath}` : ""}`);
};
