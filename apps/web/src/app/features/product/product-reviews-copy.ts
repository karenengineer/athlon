import { Locale } from "../../core/i18n/i18n.service";

export interface ReviewsCopy {
  title: string;
  empty: string;
  count: (count: number) => string;
  verified: string;
  onlyBuyers: string;
  stars: (rating: number) => string;
}

export const reviewsCopy: Record<Locale, ReviewsCopy> = {
  hy: {
    title: "Կարծիքներ",
    empty: "Դեռ կարծիքներ չկան։",
    count: (count) => `${count} կարծիք`,
    verified: "Հաստատված գնում",
    onlyBuyers:
      "Կարծիք կարող են թողնել միայն այս ապրանքը գնած հաճախորդները։ Պատվերը ստանալուց հետո մենք ձեզ էլ. փոստով կուղարկենք անձնական հղում։",
    stars: (rating) => `${rating} աստղ 5-ից`,
  },
  ru: {
    title: "Отзывы",
    empty: "Отзывов пока нет.",
    count: (count) => {
      const mod10 = count % 10;
      const mod100 = count % 100;
      const word =
        mod10 === 1 && mod100 !== 11
          ? "отзыв"
          : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
            ? "отзыва"
            : "отзывов";
      return `${count} ${word}`;
    },
    verified: "Подтверждённая покупка",
    onlyBuyers:
      "Отзыв могут оставить только покупатели этого товара. После получения заказа мы пришлём вам персональную ссылку на почту.",
    stars: (rating) => `${rating} из 5 звёзд`,
  },
  en: {
    title: "Reviews",
    empty: "No reviews yet.",
    count: (count) => `${count} ${count === 1 ? "review" : "reviews"}`,
    verified: "Verified purchase",
    onlyBuyers:
      "Only customers who bought this product can review it. After your order is delivered, we email you a personal review link.",
    stars: (rating) => `${rating} out of 5 stars`,
  },
};
