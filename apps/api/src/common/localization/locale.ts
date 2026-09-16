import { BadRequestException } from "@nestjs/common";
import { Locale } from "../../generated/prisma/enums";

export function parseLocale(value?: string): Locale {
  if (!value) return Locale.HY;
  const normalized = value.toUpperCase();
  if (!Object.values(Locale).includes(normalized as Locale)) {
    throw new BadRequestException(`Unsupported locale: ${value}`);
  }
  return normalized as Locale;
}

export function selectTranslation<T extends { locale: Locale }>(
  translations: T[],
  locale: Locale,
): T | undefined {
  return (
    translations.find((translation) => translation.locale === locale) ??
    translations.find((translation) => translation.locale === Locale.RU) ??
    translations[0]
  );
}
