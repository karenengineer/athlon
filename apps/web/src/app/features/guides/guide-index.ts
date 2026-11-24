import { Locale } from "../../core/i18n/i18n.service";
import { GuideSlug, guideSlugs } from "./guide-slugs";

export const guidesCopy: Record<
  Locale,
  {
    title: string;
    heading: string;
    description: string;
    introduction: string;
    readMore: string;
    related: string;
    shop: string;
    all: string;
  }
> = {
  hy: {
    title: "Սպորտային սննդի ուղեցույցներ",
    heading: "Ուղեցույցներ",
    description:
      "Ինչպես ընտրել պրոտեին, կրեատին և նախամարզումային համալիր, ինչպես տարբերել օրիգինալ ապրանքը կեղծից։ Գործնական խորհուրդներ ATHLON-ից։",
    introduction:
      "Գործնական խորհուրդներ սպորտային սննդի ընտրության և օգտագործման վերաբերյալ։ Դրանք չեն փոխարինում բժշկի խորհրդատվությանը։",
    readMore: "Կարդալ",
    related: "Օգտակար հոդվածներ",
    shop: "Դիտել ապրանքները",
    all: "Բոլոր ուղեցույցները",
  },
  ru: {
    title: "Статьи о спортивном питании",
    heading: "Полезные статьи",
    description:
      "Как выбрать протеин, креатин и предтренировочный комплекс и как отличить оригинал от подделки. Практические советы от ATHLON.",
    introduction:
      "Практические советы по выбору и приёму спортивного питания. Они не заменяют консультацию врача.",
    readMore: "Читать",
    related: "Полезные статьи",
    shop: "Смотреть товары",
    all: "Все статьи",
  },
  en: {
    title: "Sports nutrition guides",
    heading: "Guides",
    description:
      "How to choose protein, creatine and pre-workout, and how to tell original supplements from fakes. Practical advice from ATHLON.",
    introduction:
      "Practical advice on choosing and using sports nutrition. It doesn't replace advice from a doctor.",
    readMore: "Read",
    related: "Helpful guides",
    shop: "Shop the products",
    all: "All guides",
  },
};

export interface GuideLink {
  /** Catalog category the guide links to, and is linked from. */
  category: string;
  heading: Record<Locale, string>;
}

export const guideIndex: Record<GuideSlug, GuideLink> = {
  "how-to-choose-protein": {
    category: "protein",
    heading: {
      hy: "Ինչպես ընտրել պրոտեին",
      ru: "Как выбрать протеин",
      en: "How to choose protein powder",
    },
  },
  "creatine-guide": {
    category: "creatine",
    heading: {
      hy: "Կրեատին․ ինչպես և երբ ընդունել",
      ru: "Креатин: как и когда принимать",
      en: "Creatine: how and when to take it",
    },
  },
  "pre-workout-guide": {
    category: "pre-workout",
    heading: {
      hy: "Նախամարզումային համալիր․ ինչպես ընտրել և ընդունել",
      ru: "Предтренировочный комплекс: как выбрать и принимать",
      en: "Pre-workout: how to choose and take it",
    },
  },
  "original-vs-fake-supplements": {
    category: "sports-nutrition",
    heading: {
      hy: "Ինչպես տարբերել օրիգինալ սպորտային սնունդը կեղծից",
      ru: "Как отличить оригинальное спортивное питание от подделки",
      en: "How to tell original sports supplements from fakes",
    },
  },
  "gainer-guide": {
    category: "protein",
    heading: {
      hy: "Գեյներ․ ինչպես ընտրել և ընդունել",
      ru: "Гейнер: как выбрать и принимать",
      en: "Mass gainer: how to choose and take it",
    },
  },
  "bcaa-amino-acids-guide": {
    category: "performance",
    heading: {
      hy: "BCAA և ամինաթթուներ․ ինչպես ընդունել",
      ru: "BCAA и аминокислоты: как принимать",
      en: "BCAA and amino acids: how to take them",
    },
  },
  "l-carnitine-guide": {
    category: "other-nutrition",
    heading: {
      hy: "L-կարնիտին․ ինչ ակնկալել",
      ru: "L-карнитин: чего ожидать",
      en: "L-carnitine: what to expect",
    },
  },
};

/** Guides for a catalog category, in publication order. */
export function guidesForCategory(
  category: string | null | undefined,
): { slug: GuideSlug; link: GuideLink }[] {
  return category
    ? guideSlugs
        .filter((slug) => guideIndex[slug].category === category)
        .map((slug) => ({ slug, link: guideIndex[slug] }))
    : [];
}
