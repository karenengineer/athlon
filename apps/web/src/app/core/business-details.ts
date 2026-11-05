import { Locale } from "./i18n/i18n.service";

/** Owner-confirmed seller and correspondence address; not a public shop. */
export const businessDetails: Record<
  Locale,
  {
    seller: string;
    address: string;
    street: string;
    city: string;
    label: string;
    contactOnly: string;
  }
> = {
  hy: {
    seller: "Կարեն Գևորգյան",
    address: "Եղբայրության 5, Երևան, Հայաստան",
    street: "Եղբայրության 5",
    city: "Երևան",
    label: "Վաճառող և կապի հասցե",
    contactOnly:
      "Միայն գործարար կապի հասցե․ այցերի կամ ապրանքն ինքնուրույն վերցնելու համար նախատեսված չէ։",
  },
  ru: {
    seller: "Карен Геворгян",
    address: "ул. Ехбайрутян, 5, Ереван, Армения",
    street: "ул. Ехбайрутян, 5",
    city: "Ереван",
    label: "Продавец и адрес для связи",
    contactOnly:
      "Только адрес для деловой связи; не предназначен для посещений или самовывоза.",
  },
  en: {
    seller: "Karen Gevorgyan",
    address: "Yeghbayrutyan 5, Yerevan, Armenia",
    street: "Yeghbayrutyan 5",
    city: "Yerevan",
    label: "Seller and contact address",
    contactOnly:
      "Business/contact address only; not open for visits or pickup.",
  },
};
