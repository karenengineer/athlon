import { CanMatchFn } from "@angular/router";
import { supportedLocales } from "./i18n.service";

export const localeGuard: CanMatchFn = (_route, segments) =>
  supportedLocales.includes(
    segments[0]?.path as (typeof supportedLocales)[number],
  );
