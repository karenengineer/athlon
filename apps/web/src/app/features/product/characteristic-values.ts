import { Locale } from "../../core/i18n/i18n.service";

// Product characteristics are stored once (in English) for every locale, so
// common values are translated for display. Unknown values are shown as-is.
const values: Record<string, { hy: string; ru: string }> = {
  unflavored: { hy: "Առանց համի", ru: "Без вкуса" },
  unflavoured: { hy: "Առանց համի", ru: "Без вкуса" },
  "without flavor": { hy: "Առանց համի", ru: "Без вкуса" },
  vanilla: { hy: "Վանիլ", ru: "Ваниль" },
  "vanilla ice cream": { hy: "Վանիլային պաղպաղակ", ru: "Ванильное мороженое" },
  chocolate: { hy: "Շոկոլադ", ru: "Шоколад" },
  "double rich chocolate": { hy: "Կրկնակի շոկոլադ", ru: "Двойной шоколад" },
  "banana cream": { hy: "Բանանային կրեմ", ru: "Банановый крем" },
  "strawberry lime": { hy: "Ելակ և լայմ", ru: "Клубника и лайм" },
  orange: { hy: "Նարինջ", ru: "Апельсин" },
  "blueberry mojito": { hy: "Հապալաս և մոխիտո", ru: "Черника и мохито" },
  yellow: { hy: "Դեղին", ru: "Жёлтый" },
  black: { hy: "Սև", ru: "Чёрный" },
  purple: { hy: "Մանուշակագույն", ru: "Фиолетовый" },
  red: { hy: "Կարմիր", ru: "Красный" },
  green: { hy: "Կանաչ", ru: "Зелёный" },
  rubber: { hy: "Ռետին", ru: "Резина" },
  powder: { hy: "Փոշի", ru: "Порошок" },
  capsules: { hy: "Պատիճներ", ru: "Капсулы" },
  liquid: { hy: "Հեղուկ", ru: "Жидкость" },
};

const UNFLAVORED = new Set(["unflavored", "unflavoured", "without flavor"]);

const units: Record<string, { hy: string; ru: string }> = {
  g: { hy: "գ", ru: "г" },
  mg: { hy: "մգ", ru: "мг" },
  kg: { hy: "կգ", ru: "кг" },
  ml: { hy: "մլ", ru: "мл" },
  cm: { hy: "սմ", ru: "см" },
  mm: { hy: "մմ", ru: "мм" },
};

const substances: Record<string, { hy: string; ru: string }> = {
  "creatine monohydrate": {
    hy: "կրեատին մոնոհիդրատ",
    ru: "креатина моногидрата",
  },
};

export function localizeCharacteristicValue(
  text: string,
  locale: Locale,
): string {
  const key = text.trim().toLowerCase();
  const known = values[key];
  if (locale === "en") return UNFLAVORED.has(key) ? "Unflavored" : text;
  if (known) return known[locale];
  // "907 g", "5.5 g", "5 g creatine monohydrate"
  const measure = /^(\d+(?:[.,]\d+)?)\s*(g|mg|kg|ml|cm|mm)\b\s*(.*)$/i.exec(
    text.trim(),
  );
  if (measure) {
    const [, amount, unit, rest] = measure;
    const restKey = rest.toLowerCase();
    if (rest && !substances[restKey]) return text;
    const localizedUnit = units[unit.toLowerCase()][locale];
    return [amount, localizedUnit, rest ? substances[restKey][locale] : ""]
      .filter(Boolean)
      .join(" ");
  }
  return text;
}
