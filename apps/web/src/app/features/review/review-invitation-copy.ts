import { Locale } from "../../core/i18n/i18n.service";

export const reviewInvitationCopy: Record<
  Locale,
  {
    title: string;
    intro: string;
    loading: string;
    notFound: string;
    expired: string;
    error: string;
    name: string;
    rating: string;
    text: string;
    textHint: string;
    submit: string;
    sending: string;
    thanks: string;
    alreadyReviewed: string;
    duplicate: string;
    allDone: string;
    stars: (rating: number) => string;
  }
> = {
  hy: {
    title: "Գնահատեք ձեր գնումը",
    intro: "Կիսվեք ձեր կարծիքով ձեր գնած ապրանքների մասին։",
    loading: "Բեռնում…",
    notFound: "Այս հղումն անվավեր է։",
    expired: "Այս հղման ժամկետն անցել է։ Գրեք մեզ, և մենք կուղարկենք նորը։",
    error: "Չհաջողվեց ուղարկել։ Փորձեք կրկին։",
    name: "Անուն",
    rating: "Գնահատական",
    text: "Կարծիք",
    textHint: "Առնվազն 10 նիշ",
    submit: "Ուղարկել",
    sending: "Ուղարկվում է…",
    thanks: "Շնորհակալություն։ Կարծիքը կհրապարակվի ստուգումից հետո։",
    alreadyReviewed: "Կարծիքն արդեն ուղարկված է",
    duplicate: "Այս ապրանքի համար կարծիքն արդեն ուղարկված է։",
    allDone: "Շնորհակալություն, դուք գնահատել եք բոլոր ապրանքները։",
    stars: (rating) => `${rating} աստղ 5-ից`,
  },
  ru: {
    title: "Оцените покупку",
    intro: "Расскажите, как вам купленные товары.",
    loading: "Загрузка…",
    notFound: "Эта ссылка недействительна.",
    expired: "Срок действия ссылки истёк. Напишите нам — пришлём новую.",
    error: "Не удалось отправить. Попробуйте ещё раз.",
    name: "Имя",
    rating: "Оценка",
    text: "Отзыв",
    textHint: "Не менее 10 символов",
    submit: "Отправить",
    sending: "Отправка…",
    thanks: "Спасибо! Отзыв появится после проверки.",
    alreadyReviewed: "Отзыв уже отправлен",
    duplicate: "Отзыв на этот товар уже отправлен.",
    allDone: "Спасибо, вы оценили все товары.",
    stars: (rating) => `${rating} из 5 звёзд`,
  },
  en: {
    title: "Rate your purchase",
    intro: "Tell other customers what you think of the products you bought.",
    loading: "Loading…",
    notFound: "This review link is not valid.",
    expired:
      "This review link has expired. Contact us and we'll send a new one.",
    error: "Couldn't send your review. Please try again.",
    name: "Name",
    rating: "Rating",
    text: "Review",
    textHint: "At least 10 characters",
    submit: "Submit",
    sending: "Sending…",
    thanks: "Thank you! Your review will appear after moderation.",
    alreadyReviewed: "Review already sent",
    duplicate: "You have already reviewed this product.",
    allDone: "Thank you, you've reviewed every product.",
    stars: (rating) => `${rating} out of 5 stars`,
  },
};
