import { Locale } from "./i18n.service";

export const informationPageIds = [
  "about",
  "contact",
  "delivery",
  "returns",
] as const;

export type InformationPageId = (typeof informationPageIds)[number];

export const informationNavigation: Record<
  Locale,
  { label: string; pages: Record<InformationPageId, string> }
> = {
  hy: {
    label: "Խանութի մասին տեղեկություններ",
    pages: {
      about: "ATHLON-ի մասին",
      contact: "Կապ",
      delivery: "Առաքում և վճարում",
      returns: "Վերադարձ և փոխանակում",
    },
  },
  ru: {
    label: "Информация о магазине",
    pages: {
      about: "Об ATHLON",
      contact: "Контакты",
      delivery: "Доставка и оплата",
      returns: "Возврат и обмен",
    },
  },
  en: {
    label: "Store information",
    pages: {
      about: "About ATHLON",
      contact: "Contact",
      delivery: "Delivery and payment",
      returns: "Returns and exchanges",
    },
  },
};
