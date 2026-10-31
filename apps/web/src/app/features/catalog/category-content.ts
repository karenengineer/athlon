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

const guidance: Record<string, Record<Locale, string>> = {
  "sports-nutrition": {
    hy: "Սկսեք ձեր մարզման նպատակից և սովորական սննդակարգից, ապա ընտրեք համապատասխան բաժինը՝ սպիտակուց, կրեատին, վիտամիններ կամ նախավարժանքային ապրանքներ։ Յուրաքանչյուր ապրանքի էջում համեմատեք չափաբաժինը, չափաբաժինների թիվն ու գինը և հետևեք փաթեթի ցուցումներին։",
    ru: "Начните со своей цели и обычного рациона, затем выберите подходящий раздел: протеин, креатин, витамины или предтренировочные продукты. На странице каждого товара сравните размер порции, количество порций и цену и следуйте инструкции на упаковке.",
    en: "Start with your training goal and usual diet, then choose the section that fits: protein, creatine, vitamins or pre-workout products. On each product page, compare the serving size, number of servings and price, and follow the directions on the package.",
  },
  protein: {
    hy: "Համեմատեք մեկ չափաբաժնի սպիտակուցի քանակը, փաթեթի չափաբաժինների թիվը և առկա համերը։ Հաշվի առեք, թե որքան սպիտակուց եք արդեն ստանում սովորական սննդից, և կազմում ստուգեք ձեզ համար անցանկալի բաղադրիչները, օրինակ՝ լակտոզը։",
    ru: "Сравните количество белка в порции, число порций в упаковке и доступные вкусы. Учитывайте, сколько белка вы уже получаете с обычной едой, и проверьте в составе нежелательные для вас компоненты, например лактозу.",
    en: "Compare the protein per serving, the number of servings in the package and the available flavors. Consider how much protein you already get from regular meals, and check the ingredients for anything you avoid, such as lactose.",
  },
  performance: {
    hy: "Ստուգեք յուրաքանչյուր ապրանքի կազմը և մարզման որ փուլի համար է այն նախատեսված, ապա համեմատեք չափաբաժինն ու փաթեթի պարունակությունը։ Նման բաղադրիչներով ապրանքներ մի համակցեք՝ առանց դրանց փաթեթները կարդալու։",
    ru: "Проверьте состав каждого товара и для какого этапа тренировки он предназначен, затем сравните размер порции и содержимое упаковки. Не сочетайте продукты с похожими компонентами, не прочитав их упаковки.",
    en: "Check what each product contains and which part of your training it is meant for, then compare the serving size and package contents. Don't combine products with similar ingredients without reading their labels.",
  },
  creatine: {
    hy: "Համեմատեք փաթեթին նշված կրեատինի ձևը, մեկ չափաբաժնի քանակը և չափաբաժինների թիվը։ Հաճախ ավելի օգտակար է համեմատել մեկ չափաբաժնի, այլ ոչ թե ամբողջ փաթեթի գինը։ Հետևեք փաթեթի ցուցումներին։",
    ru: "Сравните указанную на упаковке форму креатина, количество в порции и число порций. Часто полезнее сравнивать цену порции, а не всей упаковки. Следуйте инструкции на упаковке.",
    en: "Compare the form of creatine on the label, the amount per serving and the number of servings. Price per serving is often more useful to compare than the price of the whole package. Follow the directions on the package.",
  },
  vitamins: {
    hy: "Ստուգեք, թե որ վիտամիններն ու հանքանյութերն է պարունակում ապրանքը և որքան՝ մեկ չափաբաժնում։ Դիտարկեք դրանք որպես հավասարակշռված սննդակարգի լրացում, ոչ թե փոխարինող։ Առողջական խնդիրների կամ դեղորայք ընդունելու դեպքում նախապես խորհրդակցեք բժշկի հետ։",
    ru: "Проверьте, какие витамины и минералы содержит продукт и сколько их в одной порции. Рассматривайте их как дополнение к сбалансированному питанию, а не как замену. При проблемах со здоровьем или приёме лекарств сначала проконсультируйтесь с врачом.",
    en: "Check which vitamins and minerals a product contains and how much is in one serving. Treat them as an addition to a balanced diet, not a replacement. If you have a health condition or take medication, talk to a doctor first.",
  },
  "pre-workout": {
    hy: "Փաթեթին ստուգեք մեկ չափաբաժնի կոֆեինի և մյուս ակտիվ բաղադրիչների քանակը և հաշվի առեք օրվա ընթացքում ստացվող մնացած կոֆեինը։ Հետևեք փաթեթի ցուցումներին և մի գերազանցեք նշված չափաբաժինը։",
    ru: "Проверьте на упаковке количество кофеина и других активных компонентов в порции и учитывайте остальной кофеин, который получаете за день. Следуйте инструкции на упаковке и не превышайте указанную порцию.",
    en: "Check the label for the caffeine and other active ingredients per serving, and count any other caffeine you have during the day. Follow the directions on the package and don't exceed the stated serving.",
  },
  "other-nutrition": {
    hy: "Կարդացեք ապրանքի նկարագրությունն ու կազմը՝ հասկանալու համար, թե ինչի համար է այն նախատեսված։ Համեմատեք չափաբաժինը, փաթեթի պարունակությունն ու գինը։",
    ru: "Прочитайте описание и состав товара, чтобы понять, для чего он предназначен. Сравните размер порции, содержимое упаковки и цену.",
    en: "Read the description and ingredients to see what a product is for, then compare the serving size, package contents and price.",
  },
  accessories: {
    hy: "Ընտրեք՝ հաշվի առնելով, թե ինչպես և որտեղ եք մարզվում։ Համեմատեք ապրանքի էջում նշված չափը, նյութը և տարողությունը, եթե դրանք նշված են։",
    ru: "Выбирайте с учётом того, как и где вы тренируетесь. Сравните размер, материал и вместимость, если они указаны на странице товара.",
    en: "Choose based on how and where you train. Compare the size, material and capacity where they are listed on the product page.",
  },
  "training-accessories": {
    hy: "Մտածեք, թե որ վարժությունների համար է ձեզ անհրաժեշտ պարագան։ Համեմատեք ապրանքի էջում նշված չափն ու նյութը և ընտրեք ձեր մարզումներին համապատասխան տարբերակը։",
    ru: "Подумайте, для каких упражнений вам нужен аксессуар. Сравните размер и материал, указанные на странице товара, и выберите вариант под свои тренировки.",
    en: "Think about which exercises you need the item for. Compare the size and material on the product page, and choose the option that suits your training.",
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

export function categoryGuidance(
  category: PublishedCategory | null,
  locale: Locale,
): string {
  return (
    (category && guidance[category.slug]?.[locale]) ||
    catalogContentCopy[locale].guidance
  );
}
