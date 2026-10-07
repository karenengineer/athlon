import { Injectable, signal } from "@angular/core";

export const supportedLocales = ["hy", "ru", "en"] as const;
export type Locale = (typeof supportedLocales)[number];

type Copy = {
  announcement: string;
  home: string;
  catalog: string;
  nutrition: string;
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
  noResultsTitle: string;
  noResultsText: string;
  errorTitle: string;
  errorText: string;
  retry: string;
  filters: string;
  allBrands: string;
  allAvailability: string;
  allCategories: string;
  allProductTypes: string;
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
  basket: string;
  addToBasket: string;
  inBasket: string;
  quantity: string;
  remove: string;
  clearBasket: string;
  emptyBasket: string;
  continueShopping: string;
  orderCustomerName: string;
  orderCustomerEmail: string;
  orderCustomerPhone: string;
  orderDeliveryAddress: string;
  orderPaymentMethod: string;
  orderPayOnDelivery: string;
  orderPayByCard: string;
  orderPaymentOnDelivery: string;
  orderPaymentPending: string;
  orderPaymentConfirmed: string;
  orderPaymentFailed: string;
  orderPaymentCancelled: string;
  orderPaymentExpired: string;
  orderPaymentTimeout: string;
  orderPlace: string;
  orderSending: string;
  orderSuccess: string;
  orderFailure: string;
  orderConflict: string;
  orderRequired: string;
  basketTotal: string;
};

const copy: Record<Locale, Copy> = {
  ru: {
    announcement: "Создай тело под стать своему духу",
    home: "Главная",
    catalog: "Каталог",
    nutrition: "Спортивное питание",
    searchPlaceholder: "Найти протеин, креатин…",
    search: "Найти",
    heroEyebrow: "ATHLON · SPORTS NUTRITION STORE",
    heroTitle: "Создай тело под стать своему духу",
    heroText: "Спортивное питание для ежедневного прогресса.",
    explore: "Смотреть товары",
    showcaseEyebrow: "Спортивное питание",
    showcaseTitle: "Популярное сейчас",
    showcaseText: "Крупные карточки и только важные факты о продукте.",
    viewAll: "Все товары",
    details: "Подробнее",
    contactPrice: "Уточнить цену",
    loading: "Загружаем товары…",
    emptyTitle: "Товары скоро появятся",
    emptyText: "Каталог обновляется. Загляните немного позже.",
    noResultsTitle: "Товары не найдены",
    noResultsText: "Попробуйте другой запрос или измените фильтры.",
    errorTitle: "Не удалось загрузить каталог",
    errorText: "Проверьте соединение и попробуйте ещё раз.",
    retry: "Повторить",
    filters: "Фильтры",
    allBrands: "Все бренды",
    allAvailability: "Любая доступность",
    allCategories: "Все категории",
    allProductTypes: "Все типы продуктов",
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
    footerText: "Спортивное питание в Армении.",
    basket: "Корзина",
    addToBasket: "В корзину",
    inBasket: "В корзине",
    quantity: "Количество",
    remove: "Удалить",
    clearBasket: "Очистить корзину",
    emptyBasket: "Корзина пуста",
    continueShopping: "Продолжить покупки",
    orderCustomerName: "Имя и фамилия",
    orderCustomerEmail: "Электронная почта",
    orderCustomerPhone: "Номер телефона",
    orderDeliveryAddress: "Адрес доставки",
    orderPaymentMethod: "Способ оплаты",
    orderPayOnDelivery: "Наличными или картой курьеру при доставке",
    orderPayByCard: "Оплатить банковской картой сейчас",
    orderPaymentOnDelivery:
      "Оплата при получении заказа — наличными или картой.",
    orderPaymentPending: "Открываем защищённую страницу оплаты банка…",
    orderPaymentConfirmed: "Оплата подтверждена.",
    orderPaymentFailed: "Оплата не прошла. Корзина сохранена — попробуйте ещё раз.",
    orderPaymentCancelled: "Оплата отменена. Корзина сохранена.",
    orderPaymentExpired: "Срок оплаты истёк. Корзина сохранена.",
    orderPaymentTimeout: "Статус оплаты пока не подтверждён. Корзина сохранена.",
    orderPlace: "Оформить заказ",
    orderSending: "Отправляем…",
    orderSuccess: "Ваш заказ зарегистрирован.",
    orderFailure: "Не удалось отправить заказ. Попробуйте ещё раз.",
    orderConflict:
      "Цена или наличие товара изменились. Проверьте корзину и повторите попытку.",
    orderRequired: "Укажите имя, корректный email, телефон и адрес доставки.",
    basketTotal: "Итого",
  },
  hy: {
    announcement: "Կառուցիր մարմինդ հոգուդ համապատասխան",
    home: "Գլխավոր",
    catalog: "Կատալոգ",
    nutrition: "Սպորտային սնունդ",
    searchPlaceholder: "Գտնել պրոտեին, կրեատին…",
    search: "Գտնել",
    heroEyebrow: "ATHLON · SPORTS NUTRITION STORE",
    heroTitle: "Կառուցիր մարմինդ հոգուդ համապատասխան",
    heroText: "Սպորտային սնունդ ամենօրյա առաջընթացի համար։",
    explore: "Դիտել ապրանքները",
    showcaseEyebrow: "Սպորտային սնունդ",
    showcaseTitle: "Հայտնի ապրանքներ",
    showcaseText: "Խոշոր քարտեր և միայն կարևոր տեղեկություն։",
    viewAll: "Տեսնել բոլոր ապրանքները",
    details: "Մանրամասն",
    contactPrice: "Ճշտել գինը",
    loading: "Բեռնում ենք ապրանքները…",
    emptyTitle: "Ապրանքները շուտով կլինեն",
    emptyText: "Կատալոգը թարմացվում է։ Այցելեք մի փոքր ուշ։",
    noResultsTitle: "Ապրանքներ չեն գտնվել",
    noResultsText: "Փորձեք այլ որոնում կամ փոխեք զտիչները։",
    errorTitle: "Չհաջողվեց բեռնել կատալոգը",
    errorText: "Ստուգեք կապը և կրկին փորձեք։",
    retry: "Կրկնել",
    filters: "Զտիչներ",
    allBrands: "Բոլոր ապրանքանիշերը",
    allAvailability: "Ցանկացած հասանելիություն",
    allCategories: "Բոլոր կատեգորիաները",
    allProductTypes: "Բոլոր տեսակները",
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
    footerText: "Սպորտային սնունդ Հայաստանում։",
    basket: "Զամբյուղ",
    addToBasket: "Ավելացնել",
    inBasket: "Զամբյուղում",
    quantity: "Քանակ",
    remove: "Հեռացնել",
    clearBasket: "Մաքրել զամբյուղը",
    emptyBasket: "Զամբյուղը դատարկ է",
    continueShopping: "Շարունակել գնումները",
    orderCustomerName: "Անուն Ազգանուն",
    orderCustomerEmail: "Էլ. փոստ",
    orderCustomerPhone: "Հեռախոսահամար",
    orderDeliveryAddress: "Առաքման հասցե",
    orderPaymentMethod: "Վճարման եղանակը",
    orderPayOnDelivery: "Կանխիկ կամ քարտով՝ առաքման պահին",
    orderPayByCard: "Վճարել բանկային քարտով հիմա",
    orderPaymentOnDelivery: "Վճարումը՝ պատվերը ստանալիս․ կանխիկ կամ քարտով։",
    orderPaymentPending: "Բացում ենք բանկի անվտանգ վճարման էջը…",
    orderPaymentConfirmed: "Վճարումը հաստատվել է։",
    orderPaymentFailed: "Վճարումը չկատարվեց։ Զամբյուղը պահպանված է․ կրկին փորձեք։",
    orderPaymentCancelled: "Վճարումը չեղարկվել է։ Զամբյուղը պահպանված է։",
    orderPaymentExpired: "Վճարման ժամկետը լրացել է։ Զամբյուղը պահպանված է։",
    orderPaymentTimeout: "Վճարման կարգավիճակը դեռ հաստատված չէ։ Զամբյուղը պահպանված է։",
    orderPlace: "Պատվիրել",
    orderSending: "Ուղարկվում է…",
    orderSuccess: "Ձեր պատվերը գրանցված է",
    orderFailure: "Չհաջողվեց ուղարկել պատվերը։ Խնդրում ենք կրկին փորձել։",
    orderConflict:
      "Ապրանքի գինը կամ առկայությունը փոխվել է։ Ստուգեք զամբյուղը և կրկին փորձեք։",
    orderRequired: "Լրացրեք անունը, ճիշտ էլ. փոստը, հեռախոսահամարը և առաքման հասցեն։",
    basketTotal: "Ընդամենը",
  },
  en: {
    announcement: "Build a body to match your spirit",
    home: "Home",
    catalog: "Catalog",
    nutrition: "Sports nutrition",
    searchPlaceholder: "Find protein, creatine…",
    search: "Search",
    heroEyebrow: "ATHLON · SPORTS NUTRITION STORE",
    heroTitle: "Build a body to match your spirit",
    heroText: "Sports nutrition for everyday progress.",
    explore: "Explore products",
    showcaseEyebrow: "Sports nutrition",
    showcaseTitle: "Popular right now",
    showcaseText: "Large product cards with the facts that matter.",
    viewAll: "See all products",
    details: "Details",
    contactPrice: "Ask for price",
    loading: "Loading products…",
    emptyTitle: "Products are coming soon",
    emptyText: "The catalog is being updated. Please check again later.",
    noResultsTitle: "No products found",
    noResultsText: "Try a different search or adjust the filters.",
    errorTitle: "Could not load the catalog",
    errorText: "Check your connection and try again.",
    retry: "Try again",
    filters: "Filters",
    allBrands: "All brands",
    allAvailability: "Any availability",
    allCategories: "All categories",
    allProductTypes: "All product types",
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
    footerText: "Sports nutrition in Armenia.",
    basket: "Basket",
    addToBasket: "Add to basket",
    inBasket: "In basket",
    quantity: "Quantity",
    remove: "Remove",
    clearBasket: "Clear basket",
    emptyBasket: "Basket is empty",
    continueShopping: "Continue shopping",
    orderCustomerName: "Full name",
    orderCustomerEmail: "Email address",
    orderCustomerPhone: "Phone number",
    orderDeliveryAddress: "Delivery address",
    orderPaymentMethod: "Payment method",
    orderPayOnDelivery: "Cash or card when the courier delivers",
    orderPayByCard: "Pay by bank card now",
    orderPaymentOnDelivery: "Pay the courier on delivery by cash or card.",
    orderPaymentPending: "Opening the bank’s secure payment page…",
    orderPaymentConfirmed: "Payment confirmed.",
    orderPaymentFailed: "Payment failed. Your basket is saved—please try again.",
    orderPaymentCancelled: "Payment was cancelled. Your basket is saved.",
    orderPaymentExpired: "The payment session expired. Your basket is saved.",
    orderPaymentTimeout: "Payment is not confirmed yet. Your basket is saved.",
    orderPlace: "Place order",
    orderSending: "Sending…",
    orderSuccess: "Your order has been registered.",
    orderFailure: "Could not submit your order. Please try again.",
    orderConflict:
      "An item’s price or availability changed. Review your basket and try again.",
    orderRequired: "Enter your name, a valid email, phone number, and delivery address.",
    basketTotal: "Total",
  },
};

export function parseLocale(value: string | null | undefined): Locale {
  return supportedLocales.includes(value as Locale) ? (value as Locale) : "hy";
}

@Injectable({ providedIn: "root" })
export class I18nService {
  readonly locale = signal<Locale>("hy");

  setLocale(value: string | null | undefined): void {
    this.locale.set(parseLocale(value));
  }

  t<K extends keyof Copy>(key: K): Copy[K] {
    return copy[this.locale()][key];
  }

  productCountLabel(count: number): string {
    if (this.locale() === "ru") {
      const lastTwo = count % 100;
      const lastDigit = count % 10;
      const noun =
        lastTwo >= 11 && lastTwo <= 14
          ? "товаров"
          : lastDigit === 1
            ? "товар"
            : lastDigit >= 2 && lastDigit <= 4
              ? "товара"
              : "товаров";
      return `${count} ${noun}`;
    }
    if (this.locale() === "en") {
      return `${count} ${count === 1 ? "product" : "products"}`;
    }
    return `${count} ${this.t("productsFound")}`;
  }
}
