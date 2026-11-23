import { Locale } from "../../core/i18n/i18n.service";

export const reviewsCopy: Record<
  Locale,
  {
    title: string;
    empty: string;
    count: (count: number) => string;
    write: string;
    name: string;
    rating: string;
    text: string;
    textHint: string;
    submit: string;
    sending: string;
    thanks: string;
    error: string;
    tooMany: string;
    stars: (rating: number) => string;
  }
> = {
  hy: {
    title: "Կարծիքներ",
    empty: "Դեռ կարծիքներ չկան։ Եղեք առաջինը։",
    count: (count) => `${count} կարծիք`,
    write: "Թողնել կարծիք",
    name: "Անուն",
    rating: "Գնահատական",
    text: "Կարծիք",
    textHint: "Առնվազն 10 նիշ",
    submit: "Ուղարկել",
    sending: "Ուղարկվում է…",
    thanks: "Շնորհակալություն։ Ձեր կարծիքը կհրապարակվի ստուգումից հետո։",
    error: "Չհաջողվեց ուղարկել։ Փորձեք կրկին։",
    tooMany: "Չափազանց շատ փորձեր։ Փորձեք մեկ րոպեից։",
    stars: (rating) => `${rating} աստղ 5-ից`,
  },
  ru: {
    title: "Отзывы",
    empty: "Отзывов пока нет. Будьте первым.",
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
    write: "Оставить отзыв",
    name: "Имя",
    rating: "Оценка",
    text: "Отзыв",
    textHint: "Не менее 10 символов",
    submit: "Отправить",
    sending: "Отправка…",
    thanks: "Спасибо! Отзыв появится после проверки.",
    error: "Не удалось отправить. Попробуйте ещё раз.",
    tooMany: "Слишком много попыток. Попробуйте через минуту.",
    stars: (rating) => `${rating} из 5 звёзд`,
  },
  en: {
    title: "Reviews",
    empty: "No reviews yet. Be the first.",
    count: (count) => `${count} ${count === 1 ? "review" : "reviews"}`,
    write: "Write a review",
    name: "Name",
    rating: "Rating",
    text: "Review",
    textHint: "At least 10 characters",
    submit: "Submit",
    sending: "Sending…",
    thanks: "Thank you! Your review will appear after moderation.",
    error: "Couldn't send your review. Please try again.",
    tooMany: "Too many attempts. Please try again in a minute.",
    stars: (rating) => `${rating} out of 5 stars`,
  },
};
