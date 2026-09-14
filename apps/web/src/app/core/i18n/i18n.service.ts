import { Injectable, signal } from "@angular/core";

export const supportedLocales = ["hy", "ru", "en"] as const;
export type Locale = (typeof supportedLocales)[number];

type Copy = {
  announcement: string;
  home: string;
  catalog: string;
  nutrition: string;
  accessories: string;
  searchPlaceholder: string;
  search: string;
  heroEyebrow: string;
  heroTitle: string;
  heroText: string;
  explore: string;
  showcaseEyebrow: string;
  showcaseTitle: string;
  showcaseText: string;
  viewAll: string;
  details: string;
  contactPrice: string;
  loading: string;
  emptyTitle: string;
  emptyText: string;
  errorTitle: string;
  errorText: string;
  retry: string;
  filters: string;
  allBrands: string;
  allAvailability: string;
  allCategories: string;
  priceFrom: string;
  priceTo: string;
  available: string;
  preorder: string;
  onRequest: string;
  unavailable: string;
  recommended: string;
  newest: string;
  priceAsc: string;
  priceDesc: string;
  apply: string;
  previous: string;
  next: string;
  characteristics: string;
  searchResults: string;
  productsFound: string;
  checkAvailability: string;
  relatedProducts: string;
  backToCatalog: string;
  footerText: string;
};

const copy: Record<Locale, Copy> = {
  ru: {
    announcement: "Сила начинается с правильного выбора",
    home: "Главная",
    catalog: "Каталог",
    nutrition: "Спортивное питание",
    accessories: "Аксессуары",
    searchPlaceholder: "Найти протеин, креатин…",
    search: "Найти",
    heroEyebrow: "ATHLON · SPORTS NUTRITION STORE",
    heroTitle: "Топливо для сильной версии себя",
    heroText: "Спортивное питание и экипировка для ежедневного прогресса.",
    explore: "Смотреть товары",
    showcaseEyebrow: "Спортивное питание",
    showcaseTitle: "Популярное сейчас",
    showcaseText: "Крупные карточки и только важные факты о продукте.",
    viewAll: "Весь каталог",
    details: "Подробнее",
    contactPrice: "Уточнить цену",
    loading: "Загружаем товары…",
    emptyTitle: "Товары скоро появятся",
    emptyText: "Каталог обновляется. Загляните немного позже.",
    errorTitle: "Не удалось загрузить каталог",
    errorText: "Проверьте соединение и попробуйте ещё раз.",
    retry: "Повторить",
    filters: "Фильтры",
    allBrands: "Все бренды",
    allAvailability: "Любая доступность",
    allCategories: "Все категории",
    priceFrom: "Цена от",
    priceTo: "Цена до",
    available: "В наличии",
    preorder: "Предзаказ",
    onRequest: "Под заказ",
    unavailable: "Нет в наличии",
    recommended: "Рекомендуемые",
    newest: "Новинки",
    priceAsc: "Сначала дешевле",
    priceDesc: "Сначала дороже",
    apply: "Применить",
    previous: "Назад",
    next: "Далее",
    characteristics: "Характеристики",
    searchResults: "Результаты поиска",
    productsFound: "товаров",
    checkAvailability: "Уточнить наличие",
    relatedProducts: "Похожие товары",
    backToCatalog: "Вернуться в каталог",
    footerText: "Спортивное питание и аксессуары в Армении.",
  },
  hy: {
    announcement: "Ուժը սկսվում է ճիշտ ընտրությունից",
    home: "Գլխավոր",
    catalog: "Կատալոգ",
    nutrition: "Սպորտային սնունդ",
    accessories: "Աքսեսուարներ",
    searchPlaceholder: "Գտնել պրոտեին, կրեատին…",
    search: "Գտնել",
    heroEyebrow: "ATHLON · SPORTS NUTRITION STORE",
    heroTitle: "Վառելիք քո ուժեղ տարբերակի համար",
    heroText: "Սպորտային սնունդ և հանդերձանք ամենօրյա առաջընթացի համար։",
    explore: "Դիտել ապրանքները",
    showcaseEyebrow: "Սպորտային սնունդ",
    showcaseTitle: "Հայտնի ապրանքներ",
    showcaseText: "Խոշոր քարտեր և միայն կարևոր տեղեկություն։",
    viewAll: "Ամբողջ կատալոգը",
    details: "Մանրամասն",
    contactPrice: "Ճշտել գինը",
    loading: "Բեռնում ենք ապրանքները…",
    emptyTitle: "Ապրանքները շուտով կլինեն",
    emptyText: "Կատալոգը թարմացվում է։ Այցելեք մի փոքր ուշ։",
    errorTitle: "Չհաջողվեց բեռնել կատալոգը",
    errorText: "Ստուգեք կապը և կրկին փորձեք։",
    retry: "Կրկնել",
    filters: "Զտիչներ",
    allBrands: "Բոլոր ապրանքանիշերը",
    allAvailability: "Ցանկացած հասանելիություն",
    allCategories: "Բոլոր կատեգորիաները",
    priceFrom: "Գինը՝ սկսած",
    priceTo: "Գինը՝ մինչև",
    available: "Առկա է",
    preorder: "Նախնական պատվեր",
    onRequest: "Պատվերով",
    unavailable: "Առկա չէ",
    recommended: "Առաջարկվող",
    newest: "Նորույթներ",
    priceAsc: "Գինը՝ ցածրից",
    priceDesc: "Գինը՝ բարձրից",
    apply: "Կիրառել",
    previous: "Հետ",
    next: "Առաջ",
    characteristics: "Բնութագրեր",
    searchResults: "Որոնման արդյունքներ",
    productsFound: "ապրանք",
    checkAvailability: "Ճշտել առկայությունը",
    relatedProducts: "Նմանատիպ ապրանքներ",
    backToCatalog: "Վերադառնալ կատալոգ",
    footerText: "Սպորտային սնունդ և աքսեսուարներ Հայաստանում։",
  },
  en: {
    announcement: "Strength starts with the right choice",
    home: "Home",
    catalog: "Catalog",
    nutrition: "Sports nutrition",
    accessories: "Accessories",
    searchPlaceholder: "Find protein, creatine…",
    search: "Search",
    heroEyebrow: "ATHLON · SPORTS NUTRITION STORE",
    heroTitle: "Fuel your stronger self",
    heroText: "Sports nutrition and equipment for everyday progress.",
    explore: "Explore products",
    showcaseEyebrow: "Sports nutrition",
    showcaseTitle: "Popular right now",
    showcaseText: "Large product cards with the facts that matter.",
    viewAll: "View catalog",
    details: "Details",
    contactPrice: "Ask for price",
    loading: "Loading products…",
    emptyTitle: "Products are coming soon",
    emptyText: "The catalog is being updated. Please check again later.",
    errorTitle: "Could not load the catalog",
    errorText: "Check your connection and try again.",
    retry: "Try again",
    filters: "Filters",
    allBrands: "All brands",
    allAvailability: "Any availability",
    allCategories: "All categories",
    priceFrom: "Price from",
    priceTo: "Price to",
    available: "In stock",
    preorder: "Preorder",
    onRequest: "On request",
    unavailable: "Out of stock",
    recommended: "Recommended",
    newest: "Newest",
    priceAsc: "Lowest price",
    priceDesc: "Highest price",
    apply: "Apply",
    previous: "Previous",
    next: "Next",
    characteristics: "Characteristics",
    searchResults: "Search results",
    productsFound: "products",
    checkAvailability: "Check availability",
    relatedProducts: "Related products",
    backToCatalog: "Back to catalog",
    footerText: "Sports nutrition and accessories in Armenia.",
  },
};

export function parseLocale(value: string | null | undefined): Locale {
  return supportedLocales.includes(value as Locale) ? (value as Locale) : "ru";
}

@Injectable({ providedIn: "root" })
export class I18nService {
  readonly locale = signal<Locale>("ru");

  setLocale(value: string | null | undefined): void {
    this.locale.set(parseLocale(value));
  }

  t<K extends keyof Copy>(key: K): Copy[K] {
    return copy[this.locale()][key];
  }
}
