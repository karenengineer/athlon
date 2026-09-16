import { BadRequestException } from "@nestjs/common";
import { Locale } from "../../generated/prisma/enums";
import { parseLocale, selectTranslation } from "./locale";

describe("public API locale defaults", () => {
  const translations = [
    { locale: Locale.RU, name: "Спортивное питание" },
    { locale: Locale.HY, name: "Սպորտային սնունդ" },
    { locale: Locale.EN, name: "Sports nutrition" },
  ];

  it("returns Armenian catalog copy when the locale is omitted", () => {
    expect(selectTranslation(translations, parseLocale())?.name).toBe(
      "Սպորտային սնունդ",
    );
  });

  it.each([
    ["hy", "Սպորտային սնունդ"],
    ["ru", "Спортивное питание"],
    ["en", "Sports nutrition"],
    ["RU", "Спортивное питание"],
  ])("preserves the requested %s translation", (locale, expected) => {
    expect(selectTranslation(translations, parseLocale(locale))?.name).toBe(
      expected,
    );
  });

  it("continues rejecting unsupported API locales", () => {
    expect(() => parseLocale("de")).toThrow(BadRequestException);
  });

  it("retains Russian translation fallback when Armenian copy is unavailable", () => {
    expect(selectTranslation([translations[0]!], parseLocale())?.name).toBe(
      "Спортивное питание",
    );
  });
});
