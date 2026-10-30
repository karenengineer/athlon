import { Category } from "../../core/api/catalog.models";
import { Locale } from "../../core/i18n/i18n.service";

type PublishedCategory = Omit<Category, "children">;

const introductions: Record<string, Record<Locale, string>> = {
  "sports-nutrition": {
    hy: "Դիտեք սպորտային սննդի տեսականին և համեմատեք ապրանքների փաթեթները։",
    ru: "Посмотрите ассортимент спортивного питания и сравните упаковки товаров.",
    en: "Browse sports nutrition and compare the available product packages.",
  },
  protein: {
    hy: "Համեմատեք սպիտակուցային ապրանքների հասանելի համերն ու փաթեթների չափերը։",
    ru: "Сравните доступные вкусы и размеры упаковок протеина.",
    en: "Compare the available protein flavors and package sizes.",
  },
  performance: {
    hy: "Դիտեք այս բաժնի սպորտային սնունդը և համեմատեք ներկայացված ձևաչափերը։",
    ru: "Посмотрите спортивное питание в этом разделе и сравните представленные форматы.",
    en: "Browse this sports nutrition range and compare the listed formats.",
  },
  creatine: {
    hy: "Համեմատեք կրեատինի հասանելի ձևաչափերն ու փաթեթների չափերը։",
    ru: "Сравните доступные форматы креатина и размеры упаковок.",
    en: "Compare the available creatine formats and package sizes.",
  },
  vitamins: {
    hy: "Դիտեք վիտամինների տեսականին և համեմատեք ձևաչափերն ու փաթեթների տվյալները։",
    ru: "Посмотрите ассортимент витаминов и сравните форматы и сведения на упаковках.",
    en: "Browse vitamins and compare formats and package information.",
  },
  "pre-workout": {
    hy: "Համեմատեք նախամարզումային ապրանքների ձևաչափերը, համերն ու փաթեթները։",
    ru: "Сравните форматы, вкусы и упаковки предтренировочных продуктов.",
    en: "Compare pre-workout product formats, flavors and packages.",
  },
  "other-nutrition": {
    hy: "Դիտեք սպորտային սննդի մյուս ապրանքներն ու դրանց փաթեթների տվյալները։",
    ru: "Посмотрите другие товары спортивного питания и сведения об их упаковках.",
    en: "Browse other sports nutrition products and their package information.",
  },
  accessories: {
    hy: "Դիտեք աքսեսուարները և համեմատեք ապրանքների ներկայացված չափերն ու ձևաչափերը։",
    ru: "Посмотрите аксессуары и сравните указанные размеры и форматы товаров.",
    en: "Browse accessories and compare the listed product sizes and formats.",
  },
  "training-accessories": {
    hy: "Դիտեք մարզման աքսեսուարներն ու համեմատեք ապրանքների նկարագրություններն ու չափերը։",
    ru: "Посмотрите аксессуары для тренировок и сравните описания и размеры товаров.",
    en: "Browse training accessories and compare product descriptions and sizes.",
  },
};

export const catalogContentCopy: Record<
  Locale,
  {
    categories: string;
    guidanceHeading: string;
    guidance: string;
    related: string;
    description: string;
    searchDescription: string;
    genericIntroduction: (name: string) => string;
  }
> = {
  hy: {
    categories: "Ապրանքների բաժիններ",
    guidanceHeading: "Ինչպես համեմատել ապրանքները",
    guidance:
      "Համեմատեք նշված գինն ու փաթեթի տեղեկությունները։ Ուշադրություն դարձրեք փաթեթի չափին, համին և ձևաչափին, եթե դրանք նշված են ապրանքի էջում։",
    related: "Այլ բաժիններ",
    description:
      "Դիտեք ATHLON-ի սպորտային սննդի և աքսեսուարների առցանց կատալոգը Հայաստանում։",
    searchDescription:
      "Որոնեք ATHLON-ի կատալոգում և համեմատեք ապրանքների տվյալներն ու նշված գները։",
    genericIntroduction: (name) =>
      `Դիտեք «${name}» բաժնի ապրանքներն ու համեմատեք ներկայացված տարբերակները։`,
  },
  ru: {
    categories: "Разделы каталога",
    guidanceHeading: "Как сравнивать товары",
    guidance:
      "Сравните указанную цену и сведения на упаковке. Обратите внимание на размер упаковки, вкус и формат, если они указаны на странице товара.",
    related: "Другие разделы",
    description:
      "Посмотрите онлайн-каталог спортивного питания и аксессуаров ATHLON в Армении.",
    searchDescription:
      "Ищите в каталоге ATHLON и сравнивайте сведения о товарах и указанные цены.",
    genericIntroduction: (name) =>
      `Посмотрите товары раздела «${name}» и сравните представленные варианты.`,
  },
  en: {
    categories: "Catalog categories",
    guidanceHeading: "How to compare products",
    guidance:
      "Compare the listed price and package information. Check package size, flavor and format where these are shown on the product page.",
    related: "Other categories",
    description:
      "Browse ATHLON's online sports nutrition and accessories catalog in Armenia.",
    searchDescription:
      "Search the ATHLON catalog and compare product information and listed prices.",
    genericIntroduction: (name) =>
      `Browse ${name} products and compare the listed options.`,
  },
};

export function categoryIntroduction(
  category: PublishedCategory,
  locale: Locale,
): string {
  return (
    category.description?.trim() ||
    introductions[category.slug]?.[locale] ||
    catalogContentCopy[locale].genericIntroduction(category.name)
  );
}
