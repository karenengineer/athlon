import { Locale } from "../../core/i18n/i18n.service";

/**
 * Search-focused copy for catalog listings. Each indexable listing targets its
 * own query so the home page, the catalog root and the categories do not
 * compete for "sports nutrition".
 */
export interface CategorySeo {
  /** Page title without the "| ATHLON" suffix. */
  title: string;
  /** Visible H1. */
  heading: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** The catalog root (/catalog) lists the default sports-nutrition category. */
export const CATALOG_ROOT_SEO_KEY = "sports-nutrition";

const seo: Record<string, Record<Locale, CategorySeo>> = {
  "sports-nutrition": {
    hy: {
      title: "Սպորտային սննդի խանութ Երևանում — կատալոգ",
      heading: "Սպորտային սննդի կատալոգ",
      description:
        "Պրոտեին, կրեատին, նախամարզումային համալիրներ և վիտամիններ Optimum Nutrition, Trec Nutrition, Cellucor և Rule 1 բրենդներից։ Միայն օրիգինալ ապրանք, անվճար առաքում ողջ Հայաստանում։",
    },
    ru: {
      title: "Магазин спортивного питания в Ереване — каталог",
      heading: "Каталог спортивного питания",
      description:
        "Протеин, креатин, предтренировочные комплексы и витамины Optimum Nutrition, Trec Nutrition, Cellucor и Rule 1. Только оригинальная продукция, бесплатная доставка по всей Армении.",
    },
    en: {
      title: "Sports nutrition shop in Yerevan — catalog",
      heading: "Sports nutrition catalog",
      description:
        "Protein, creatine, pre-workout and vitamins from Optimum Nutrition, Trec Nutrition, Cellucor and Rule 1. Original products only, with free delivery throughout Armenia.",
    },
  },
  protein: {
    hy: {
      title: "Պրոտեին գնել Երևանում — շիճուկային պրոտեին",
      heading: "Պրոտեին (շիճուկային սպիտակուց)",
      description:
        "Օրիգինալ շիճուկային պրոտեին Optimum Nutrition Gold Standard և Trec Nutrition՝ տարբեր համերով և փաթեթներով։ Անվճար առաքում ողջ Հայաստանում, առցանց քարտային վճարում։",
    },
    ru: {
      title: "Купить протеин в Ереване — сывороточный протеин",
      heading: "Протеин (сывороточный белок)",
      description:
        "Оригинальный сывороточный протеин Optimum Nutrition Gold Standard и Trec Nutrition разных вкусов и фасовок. Бесплатная доставка по всей Армении, оплата картой онлайн.",
    },
    en: {
      title: "Buy protein in Armenia — whey protein powder",
      heading: "Whey protein",
      description:
        "Original whey protein from Optimum Nutrition Gold Standard and Trec Nutrition in several flavors and sizes. Free delivery throughout Armenia, pay online by card.",
    },
  },
  creatine: {
    hy: {
      title: "Կրեատին գնել Երևանում — կրեատին մոնոհիդրատ",
      heading: "Կրեատին",
      description:
        "Օրիգինալ կրեատին մոնոհիդրատ Optimum Nutrition, Trec Nutrition և Rule 1 բրենդներից։ Համեմատեք փաթեթներն ու մեկ չափաբաժնի գինը։ Անվճար առաքում ողջ Հայաստանում։",
    },
    ru: {
      title: "Купить креатин в Ереване — креатин моногидрат",
      heading: "Креатин",
      description:
        "Оригинальный креатин моногидрат Optimum Nutrition, Trec Nutrition и Rule 1. Сравните фасовки и цену за порцию. Бесплатная доставка по всей Армении.",
    },
    en: {
      title: "Buy creatine in Armenia — creatine monohydrate",
      heading: "Creatine",
      description:
        "Original creatine monohydrate from Optimum Nutrition, Trec Nutrition and Rule 1. Compare pack sizes and price per serving. Free delivery throughout Armenia.",
    },
  },
  "pre-workout": {
    hy: {
      title: "Նախամարզումային համալիր (pre-workout) Երևանում",
      heading: "Նախամարզումային համալիրներ (pre-workout)",
      description:
        "Օրիգինալ նախամարզումային համալիրներ, այդ թվում՝ Cellucor C4։ Համեմատեք համերը, կազմը և չափաբաժինները։ Անվճար առաքում ողջ Հայաստանում։",
    },
    ru: {
      title: "Предтренировочный комплекс (pre-workout) в Ереване",
      heading: "Предтренировочные комплексы",
      description:
        "Оригинальные предтренировочные комплексы, включая Cellucor C4. Сравните вкусы, состав и порции. Бесплатная доставка по всей Армении.",
    },
    en: {
      title: "Pre-workout supplements in Armenia",
      heading: "Pre-workout supplements",
      description:
        "Original pre-workout supplements, including Cellucor C4. Compare flavors, ingredients and servings. Free delivery throughout Armenia.",
    },
  },
  vitamins: {
    hy: {
      title: "Վիտամիններ մարզվողների համար Երևանում",
      heading: "Վիտամիններ և հանքանյութեր",
      description:
        "Օրիգինալ վիտամիններ և հանքանյութեր ակտիվ ապրելակերպ ունեցողների համար։ Համեմատեք կազմը և չափաբաժինները։ Անվճար առաքում ողջ Հայաստանում։",
    },
    ru: {
      title: "Витамины для спортсменов в Ереване",
      heading: "Витамины и минералы",
      description:
        "Оригинальные витамины и минералы для активного образа жизни. Сравните состав и порции. Бесплатная доставка по всей Армении.",
    },
    en: {
      title: "Vitamins for active people in Armenia",
      heading: "Vitamins and minerals",
      description:
        "Original vitamins and minerals for an active lifestyle. Compare ingredients and servings. Free delivery throughout Armenia.",
    },
  },
  accessories: {
    hy: {
      title: "Մարզման աքսեսուարներ Երևանում",
      heading: "Մարզման աքսեսուարներ",
      description:
        "Աքսեսուարներ տանը և դահլիճում մարզվելու համար, այդ թվում՝ ռետինե ժապավեններ տարբեր դիմադրությամբ։ Անվճար առաքում ողջ Հայաստանում։",
    },
    ru: {
      title: "Аксессуары для тренировок в Ереване",
      heading: "Аксессуары для тренировок",
      description:
        "Аксессуары для тренировок дома и в зале, включая резинки для фитнеса разной нагрузки. Бесплатная доставка по всей Армении.",
    },
    en: {
      title: "Training accessories in Armenia",
      heading: "Training accessories",
      description:
        "Accessories for training at home and in the gym, including resistance bands in several strengths. Free delivery throughout Armenia.",
    },
  },
  "resistance-bands": {
    hy: {
      title: "Ռետինե ժապավեններ մարզման համար (resistance bands)",
      heading: "Ռետինե ժապավեններ մարզման համար",
      description:
        "Մարզման ռետինե ժապավեններ տարբեր դիմադրությամբ՝ տանը, դահլիճում և վերականգնման համար։ Անվճար առաքում ողջ Հայաստանում։",
    },
    ru: {
      title: "Резинки для фитнеса (эспандеры) в Ереване",
      heading: "Резинки для фитнеса",
      description:
        "Ленточные эспандеры разной нагрузки для тренировок дома, в зале и для разминки. Бесплатная доставка по всей Армении.",
    },
    en: {
      title: "Resistance bands in Armenia",
      heading: "Resistance bands",
      description:
        "Resistance bands in several strengths for home workouts, the gym and warm-ups. Free delivery throughout Armenia.",
    },
  },
};

const faq: Record<string, Record<Locale, readonly FaqItem[]>> = {
  "sports-nutrition": {
    hy: [
      {
        question: "Ապրանքները օրիգինա՞լ են։",
        answer:
          "Այո։ Մենք վաճառում ենք միայն օրիգինալ ապրանքներ, որոնք ստանում ենք արտադրողից։",
      },
      {
        question: "Որքա՞ն արժե առաքումը։",
        answer:
          "Առաքումը ողջ Հայաստանում անվճար է։ Վճարումը կատարվում է առցանց՝ բանկային քարտով։",
      },
      {
        question: "Ինչպե՞ս պատվիրել։",
        answer:
          "Ավելացրեք ապրանքը զամբյուղ և լրացրեք պատվերի տվյալները կամ զանգահարեք 041 44 88 55 հեռախոսահամարով։",
      },
    ],
    ru: [
      {
        question: "Продукция оригинальная?",
        answer:
          "Да. Мы продаём только оригинальную продукцию, которую получаем от производителя.",
      },
      {
        question: "Сколько стоит доставка?",
        answer:
          "Доставка по всей Армении бесплатная. Оплата банковской картой онлайн.",
      },
      {
        question: "Как сделать заказ?",
        answer:
          "Добавьте товар в корзину и заполните данные заказа или позвоните по номеру 041 44 88 55.",
      },
    ],
    en: [
      {
        question: "Are the products original?",
        answer:
          "Yes. We sell only original products that we receive from the manufacturer.",
      },
      {
        question: "How much is delivery?",
        answer: "Delivery is free throughout Armenia. You pay online by card.",
      },
      {
        question: "How do I order?",
        answer:
          "Add the product to your basket and fill in the order details, or call 041 44 88 55.",
      },
    ],
  },
  protein: {
    hy: [
      {
        question: "Ի՞նչ է շիճուկային պրոտեինը։",
        answer:
          "Կաթի շիճուկից ստացվող սպիտակուց է, որով հարմար է լրացնել սննդակարգում սպիտակուցի քանակը։ Այն հեշտությամբ լուծվում է ջրում կամ կաթում։",
      },
      {
        question: "Ե՞րբ ընդունել պրոտեինը։",
        answer:
          "Շատերն այն ընդունում են մարզումից հետո կամ որպես նախաճաշի լրացում։ Ավելի կարևոր է օրվա ընթացքում ստացվող սպիտակուցի ընդհանուր քանակը։ Հետևեք փաթեթի ցուցումներին։",
      },
      {
        question: "Ի՞նչ ընտրել լակտոզայի անհանդուրժողականության դեպքում։",
        answer:
          "Ստուգեք կազմը և ընտրեք ավելի քիչ լակտոզա պարունակող ապրանք, օրինակ՝ իզոլատ։ Կասկածի դեպքում խորհրդակցեք բժշկի հետ։",
      },
    ],
    ru: [
      {
        question: "Что такое сывороточный протеин?",
        answer:
          "Это белок из молочной сыворотки, которым удобно восполнять количество белка в рационе. Он легко размешивается в воде или молоке.",
      },
      {
        question: "Когда принимать протеин?",
        answer:
          "Многие принимают его после тренировки или как дополнение к завтраку. Важнее общее количество белка за день. Следуйте инструкции на упаковке.",
      },
      {
        question: "Что выбрать при непереносимости лактозы?",
        answer:
          "Проверьте состав и выберите продукт с меньшим содержанием лактозы, например изолят. При сомнениях проконсультируйтесь с врачом.",
      },
    ],
    en: [
      {
        question: "What is whey protein?",
        answer:
          "It is protein made from milk whey, a convenient way to add protein to your diet. It mixes easily with water or milk.",
      },
      {
        question: "When should I take protein?",
        answer:
          "Many people take it after training or alongside breakfast. Your total protein intake across the day matters more than timing. Follow the directions on the package.",
      },
      {
        question: "What if I am lactose intolerant?",
        answer:
          "Check the ingredients and choose a product with less lactose, such as an isolate. If in doubt, talk to a doctor.",
      },
    ],
  },
  creatine: {
    hy: [
      {
        question: "Ի՞նչ է կրեատին մոնոհիդրատը։",
        answer:
          "Կրեատինի ամենաշատ ուսումնասիրված ձևն է։ Այն օգտագործում են կարճ և ինտենսիվ ծանրաբեռնվածությամբ մարզումների, օրինակ՝ ուժային մարզումների համար։",
      },
      {
        question: "Ինչպե՞ս ընդունել կրեատինը։",
        answer:
          "Հետևեք փաթեթի ցուցումներին։ Սովորաբար այն ընդունում են ամեն օր՝ ջրի կամ այլ ըմպելիքի հետ․ կարևորը կանոնավորությունն է, ոչ թե ժամը։",
      },
      {
        question: "Պարտադի՞ր է «բեռնման» փուլը։",
        answer:
          "Ոչ։ Ամենօրյա կանոնավոր ընդունումը նույնպես բերում է արդյունքի, պարզապես ավելի դանդաղ։",
      },
    ],
    ru: [
      {
        question: "Что такое креатин моногидрат?",
        answer:
          "Это наиболее изученная форма креатина. Его используют при коротких интенсивных нагрузках, например в силовых тренировках.",
      },
      {
        question: "Как принимать креатин?",
        answer:
          "Следуйте инструкции на упаковке. Обычно его принимают ежедневно с водой или другим напитком: важна регулярность, а не время приёма.",
      },
      {
        question: "Обязательна ли «загрузка»?",
        answer:
          "Нет. Ежедневный регулярный приём тоже даёт результат, просто медленнее.",
      },
    ],
    en: [
      {
        question: "What is creatine monohydrate?",
        answer:
          "It is the most researched form of creatine, used for short, intense efforts such as strength training.",
      },
      {
        question: "How should I take creatine?",
        answer:
          "Follow the directions on the package. It is usually taken daily with water or another drink; consistency matters more than timing.",
      },
      {
        question: "Do I need a loading phase?",
        answer:
          "No. Taking it consistently every day also works, it just takes longer.",
      },
    ],
  },
  "pre-workout": {
    hy: [
      {
        question: "Ի՞նչ է նախամարզումային համալիրը։",
        answer:
          "Մարզումից առաջ ընդունվող հավելում է, որը սովորաբար պարունակում է կոֆեին և այլ բաղադրիչներ։ Կազմը տարբեր է, ուստի ստուգեք փաթեթը։",
      },
      {
        question: "Ե՞րբ ընդունել։",
        answer:
          "Սովորաբար մարզումից 20–30 րոպե առաջ։ Մի ընդունեք քնից քիչ առաջ, քանի որ կոֆեինը կարող է խանգարել քնին։",
      },
      {
        question: "Ո՞ւմ պետք է նախապես խորհրդակցել բժշկի հետ։",
        answer:
          "Կոֆեինի նկատմամբ զգայունության, հղիության, սրտանոթային խնդիրների կամ դեղորայք ընդունելու դեպքում։ Չի նախատեսված 18 տարեկանից ցածրերի համար։",
      },
    ],
    ru: [
      {
        question: "Что такое предтренировочный комплекс?",
        answer:
          "Это добавка, которую принимают перед тренировкой; обычно она содержит кофеин и другие компоненты. Составы различаются, поэтому проверьте упаковку.",
      },
      {
        question: "Когда принимать?",
        answer:
          "Обычно за 20–30 минут до тренировки. Не принимайте незадолго до сна: кофеин может мешать сну.",
      },
      {
        question: "Кому нужно сначала проконсультироваться с врачом?",
        answer:
          "При чувствительности к кофеину, беременности, проблемах с сердцем и сосудами или приёме лекарств. Не предназначено для лиц младше 18 лет.",
      },
    ],
    en: [
      {
        question: "What is a pre-workout?",
        answer:
          "A supplement taken before training that usually contains caffeine and other ingredients. Formulas differ, so check the label.",
      },
      {
        question: "When should I take it?",
        answer:
          "Usually 20–30 minutes before training. Avoid it close to bedtime, as caffeine can disturb sleep.",
      },
      {
        question: "Who should talk to a doctor first?",
        answer:
          "Anyone sensitive to caffeine, pregnant, with heart or blood-pressure conditions, or taking medication. Not intended for people under 18.",
      },
    ],
  },
  vitamins: {
    hy: [
      {
        question: "Վիտամինները փոխարինո՞ւմ են սննդին։",
        answer:
          "Ոչ։ Դրանք հավասարակշռված սննդակարգի լրացում են, ոչ թե փոխարինող։",
      },
      {
        question: "Ինչպե՞ս ընտրել։",
        answer:
          "Ստուգեք, թե որ վիտամիններն ու հանքանյութերն է պարունակում ապրանքը և որքան՝ մեկ չափաբաժնում։ Առողջական խնդիրների կամ դեղորայք ընդունելու դեպքում նախապես խորհրդակցեք բժշկի հետ։",
      },
      {
        question: "Ե՞րբ ընդունել։",
        answer:
          "Հետևեք փաթեթի ցուցումներին։ Շատ վիտամիններ խորհուրդ է տրվում ընդունել ուտելու ժամանակ։",
      },
    ],
    ru: [
      {
        question: "Заменяют ли витамины еду?",
        answer: "Нет. Это дополнение к сбалансированному питанию, а не замена.",
      },
      {
        question: "Как выбрать?",
        answer:
          "Проверьте, какие витамины и минералы содержит продукт и сколько их в одной порции. При проблемах со здоровьем или приёме лекарств сначала проконсультируйтесь с врачом.",
      },
      {
        question: "Когда принимать?",
        answer:
          "Следуйте инструкции на упаковке. Многие витамины рекомендуют принимать во время еды.",
      },
    ],
    en: [
      {
        question: "Do vitamins replace food?",
        answer: "No. They add to a balanced diet; they don't replace it.",
      },
      {
        question: "How do I choose?",
        answer:
          "Check which vitamins and minerals a product contains and how much is in one serving. If you have a health condition or take medication, talk to a doctor first.",
      },
      {
        question: "When should I take them?",
        answer:
          "Follow the directions on the package. Many vitamins are best taken with a meal.",
      },
    ],
  },
};

export function categorySeo(
  slug: string | null | undefined,
  locale: Locale,
): CategorySeo | undefined {
  return slug ? seo[slug]?.[locale] : undefined;
}

export function categoryFaq(
  slug: string | null | undefined,
  locale: Locale,
): readonly FaqItem[] {
  return (slug && faq[slug]?.[locale]) || [];
}

export function faqSchema(items: readonly FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
