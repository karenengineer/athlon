import { Locale } from "../i18n/i18n.service";

const localeScript: Partial<Record<Locale, RegExp>> = {
  hy: /[Ա-և]/,
  ru: /[Ѐ-ӿ]/,
};

/**
 * Returns alt text in the page language. Stored alt text that is missing, or
 * written in another script (for example English alt text on an Armenian page),
 * falls back to the localized product name.
 */
export function imageAlt(
  alt: string | null | undefined,
  name: string,
  locale: Locale,
): string {
  const value = alt?.trim();
  if (!value) return name;
  const script = localeScript[locale];
  return !script || script.test(value) ? value : name;
}
