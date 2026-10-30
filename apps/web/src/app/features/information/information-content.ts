import { Locale } from "../../core/i18n/i18n.service";
import { InformationPageId } from "../../core/i18n/information-navigation";

export interface InformationContent {
  heading: string;
  description: string;
  introduction: string;
  sections: { heading: string; text: string }[];
}

export const informationContent: Record<
  Locale,
  Record<InformationPageId, InformationContent>
> = {
  hy: {
    about: {
      heading: "ATHLON-ի մասին",
      description:
        "Սպորտային սննդի առցանց խանութ Հայաստանում։ Ծանոթացեք ATHLON-ի կատալոգին և կապվեք մեզ հետ ապրանքների ու պատվերների հարցերով։",
      introduction:
        "ATHLON-ը սպորտային սննդի առցանց խանութ է, որը սպասարկում է հաճախորդներին Հայաստանում։",
      sections: [
        {
          heading: "Ընտրեք կատալոգից",
          text: "Դիտեք ապրանքների նկարագրությունները, փաթեթի տվյալները, գներն ու հասանելիությունը։ Ապրանքի կամ պատվերի վերաբերյալ հարցերի դեպքում կապվեք մեզ հետ։",
        },
      ],
    },
    contact: {
      heading: "Կապ",
      description:
        "Կապվեք ATHLON-ի հետ՝ 041 44 88 55 հեռախոսահամարով կամ athlonsportgoods@gmail.com հասցեով՝ ապրանքների և պատվերների հարցերով։",
      introduction:
        "Ապրանքի, պատվերի, առաքման կամ վերադարձի վերաբերյալ հարցերի դեպքում զանգահարեք կամ գրեք մեզ։",
      sections: [
        {
          heading: "Հեռախոս և էլեկտրոնային փոստ",
          text: "Ընտրեք կապի հարմար եղանակը։",
        },
      ],
    },
    delivery: {
      heading: "Առաքում և վճարում",
      description:
        "Անվճար առաքում ողջ Հայաստանում՝ անկախ պատվերի գումարից։ Վճարեք կանխիկ կամ քարտով՝ առաքիչին, պատվերը ստանալիս։",
      introduction: "Անվճար առաքում ողջ Հայաստանում՝ անկախ պատվերի գումարից։",
      sections: [
        {
          heading: "Վճարում ստանալիս",
          text: "Պատվերը ստանալիս վճարեք կանխիկ կամ քարտով՝ առաքիչին։",
        },
        {
          heading: "Առաքման հարցեր",
          text: "Ձեր պատվերի առաքման մանրամասները ճշտելու համար կապվեք մեզ հետ։",
        },
      ],
    },
    returns: {
      heading: "Վերադարձ և փոխանակում",
      description:
        "Վերադարձի կամ փոխանակման հարցերով կապվեք ATHLON-ի հետ։ Նշեք պատվերի համարը և ձեր հարցը։",
      introduction:
        "Վերադարձի կամ փոխանակման հարցով օգնության համար կապվեք մեզ հետ։",
      sections: [
        {
          heading: "Ինչպես դիմել",
          text: "Նշեք պատվերի համարը և ձեր հարցը։ Մենք կօգնենք պարզել ձեր պատվերի հետ կապված հետագա քայլերը։",
        },
      ],
    },
  },
  ru: {
    about: {
      heading: "Об ATHLON",
      description:
        "Интернет-магазин спортивного питания в Армении. Посмотрите каталог ATHLON и свяжитесь с нами по вопросам товаров и заказов.",
      introduction:
        "ATHLON — интернет-магазин спортивного питания, который обслуживает покупателей в Армении.",
      sections: [
        {
          heading: "Выбирайте в каталоге",
          text: "Изучите описания товаров, информацию на упаковке, цены и наличие. Если у вас есть вопрос о товаре или заказе, свяжитесь с нами.",
        },
      ],
    },
    contact: {
      heading: "Контакты",
      description:
        "Свяжитесь с ATHLON по телефону 041 44 88 55 или почте athlonsportgoods@gmail.com по вопросам товаров и заказов.",
      introduction:
        "Позвоните или напишите нам, если у вас есть вопрос о товаре, заказе, доставке или возврате.",
      sections: [
        {
          heading: "Телефон и электронная почта",
          text: "Выберите удобный способ связи.",
        },
      ],
    },
    delivery: {
      heading: "Доставка и оплата",
      description:
        "Бесплатная доставка по всей Армении независимо от суммы заказа. Оплата наличными или картой курьеру при получении.",
      introduction:
        "Бесплатная доставка по всей Армении независимо от суммы заказа.",
      sections: [
        {
          heading: "Оплата при получении",
          text: "Оплатите заказ наличными или картой курьеру при получении.",
        },
        {
          heading: "Вопросы о доставке",
          text: "Свяжитесь с нами, чтобы уточнить детали доставки вашего заказа.",
        },
      ],
    },
    returns: {
      heading: "Возврат и обмен",
      description:
        "Помощь по вопросам возврата и обмена в ATHLON. Свяжитесь с нами, укажите номер заказа и ваш вопрос.",
      introduction:
        "Свяжитесь с нами, если вам нужна помощь по вопросу возврата или обмена.",
      sections: [
        {
          heading: "Как обратиться",
          text: "Укажите номер заказа и ваш вопрос. Мы поможем разобраться с дальнейшими действиями по вашему заказу.",
        },
      ],
    },
  },
  en: {
    about: {
      heading: "About ATHLON",
      description:
        "Online sports-nutrition shop in Armenia. Explore the ATHLON catalog and contact us with product and order questions.",
      introduction:
        "ATHLON is an online sports-nutrition shop serving customers in Armenia.",
      sections: [
        {
          heading: "Choose from the catalog",
          text: "Browse product descriptions, package information, prices, and availability. Contact us if you have a question about a product or an order.",
        },
      ],
    },
    contact: {
      heading: "Contact",
      description:
        "Contact ATHLON at 041 44 88 55 or athlonsportgoods@gmail.com with product and order questions.",
      introduction:
        "Call or email us with questions about products, orders, delivery, or returns.",
      sections: [
        {
          heading: "Phone and email",
          text: "Choose a convenient way to contact us.",
        },
      ],
    },
    delivery: {
      heading: "Delivery and payment",
      description:
        "Free delivery throughout Armenia, regardless of order value. Pay with cash or card to the courier on delivery.",
      introduction:
        "Free delivery throughout Armenia, regardless of order value.",
      sections: [
        {
          heading: "Payment on delivery",
          text: "Pay for your order with cash or card to the courier on delivery.",
        },
        {
          heading: "Delivery questions",
          text: "Contact us to discuss the delivery details of your order.",
        },
      ],
    },
    returns: {
      heading: "Returns and exchanges",
      description:
        "Help with return and exchange questions at ATHLON. Contact us with your order reference and question.",
      introduction:
        "Contact us if you need help with a return or exchange question.",
      sections: [
        {
          heading: "How to get help",
          text: "Include your order reference and question. We will help you work out the next steps for your order.",
        },
      ],
    },
  },
};
