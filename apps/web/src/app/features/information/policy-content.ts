import { businessDetails } from "../../core/business-details";
import { Locale } from "../../core/i18n/i18n.service";
import type { InformationContent } from "./information-content";

const contact = "041 44 88 55 · athlonsportgoods@gmail.com";

export const policyContent: Record<
  Locale,
  Record<"terms" | "privacy", InformationContent>
> = {
  hy: {
    terms: {
      heading: "Օգտագործման և գնման պայմաններ",
      description:
        "ATHLON-ի օգտագործման և գնման պայմանները․ պատվերներ, գներ, առաքում, վճարում և կապ վաճառողի հետ։",
      introduction:
        "Այս պայմանները վերաբերում են athlon.am կայքից օգտվելուն և ATHLON-ից գնումներին։ Թարմացվել է՝ 4 նոյեմբերի 2026 թ․։",
      sections: [
        {
          heading: "Վաճառող և կապ",
          text: `${businessDetails.hy.seller} · ${businessDetails.hy.address}։ ${businessDetails.hy.contactOnly} ${contact}։`,
        },
        {
          heading: "Ապրանքներ և գներ",
          text: "Ապրանքի էջում ներկայացված են դրա նկարագրությունը, գինը և հասանելիությունը։ Գները նշված են ՀՀ դրամով (AMD)։ Պատվերը ներկայացնելուց առաջ ստուգեք ապրանքը, համը, փաթեթի չափը, քանակը և ընդհանուր գումարը։ Անհամապատասխանության դեպքում կապվեք մեզ հետ։",
        },
        {
          heading: "Պատվերի ներկայացում",
          text: "Պատվերի համար տրամադրեք ճիշտ անուն, էլեկտրոնային փոստ, հեռախոսահամար և առաքման հասցե։ Պատվերի հաստատման և առաքման վերաբերյալ կապը կատարվում է այդ տվյալներով։ Փոփոխության կամ սխալի դեպքում հնարավորինս շուտ տեղեկացրեք մեզ՝ նշելով պատվերի համարը։",
        },
        {
          heading: "Առաքում և վճարում",
          text: "Առաքումն անվճար է ողջ Հայաստանում՝ անկախ պատվերի գումարից։ Պատվերը ստանալիս կարող եք վճարել կանխիկ կամ քարտով՝ առաքիչին։ Առաքման մանրամասները ճշտեք մեզ հետ։ Եթե պատվերի ձևակերպման էջում հասանելի է առցանց քարտային վճարում, քարտի տվյալները մուտքագրվում են բանկի վճարման էջում։ ATHLON-ը չի հավաքում և չի պահպանում քարտի ամբողջական համարը կամ CVV կոդը։",
        },
        {
          heading: "Փոփոխություն, չեղարկում և վերադարձ",
          text: "Պատվերի փոփոխման, չեղարկման, վերադարձի կամ փոխանակման հարցերով կապվեք մեզ հետ՝ նշելով պատվերի համարը և խնդիրը։ Այս էջը չի սահմանում կամ սահմանափակում օրենքով նախատեսված վերադարձի, փոխհատուցման կամ այլ պարտադիր սպառողական իրավունքները։",
        },
        {
          heading: "Անձնական տվյալներ և ձեր իրավունքները",
          text: "Անձնական տվյալների մշակումը նկարագրված է Գաղտնիության քաղաքականությունում։ Գնումների նկատմամբ կիրառվում են Հայաստանի Հանրապետության օրենսդրության պարտադիր պահանջները։ Հարցերի կամ բողոքների համար դիմեք վաճառողին վերը նշված կապի միջոցներով։ Այս պայմանները չեն սահմանափակում օրենքով նախատեսված պաշտպանության միջոցներից օգտվելու ձեր իրավունքը։",
        },
      ],
    },
    privacy: {
      heading: "Գաղտնիության քաղաքականություն",
      description:
        "Ինչպես է ATHLON-ը մշակում պատվերի և կապի տվյալները, օգտագործում դիտարկչի պահոցը և ընդունում տվյալների վերաբերյալ հարցումները։",
      introduction:
        "Այս էջը բացատրում է athlon.am կայքի միջոցով տրամադրված տվյալների մշակումը։ Թարմացվել է՝ 4 նոյեմբերի 2026 թ․։",
      sections: [
        {
          heading: "Տվյալների համար պատասխանատուն և կապը",
          text: `${businessDetails.hy.seller} · ${businessDetails.hy.address}։ ${businessDetails.hy.contactOnly} Տվյալների վերաբերյալ հարցերի համար՝ ${contact}։`,
        },
        {
          heading: "Ինչ տվյալներ են մշակվում և ինչ նպատակով",
          text: "Պատվերի ձևակերպման ժամանակ մշակում ենք ձեր անունը, էլեկտրոնային փոստը, հեռախոսահամարը, առաքման հասցեն, ընտրված ապրանքներն ու քանակները, ինչպես նաև պատվերի և վճարման հղումներն ու կարգավիճակները։ Դրանք օգտագործվում են պատվերը մշակելու, առաքելու, վճարման և պատվերի հաղորդագրություններ ուղարկելու ու ձեր հարցերին պատասխանելու համար։",
        },
        {
          heading: "Ծառայություններ մատուցողներ",
          text: "Կայքի և տվյալների բազայի հոսթինգի համար օգտագործվում է AWS-ը, պատվերի նամակների ուղարկման համար՝ Resend-ը, իսկ բիզնեսի փոստարկղը գործում է Google Gmail-ում։ Առաքումն իրականացնողին տրամադրվում են դրա համար անհրաժեշտ կապի և հասցեի տվյալները։ Այս ծառայությունները կարող են տվյալներ մշակել Հայաստանից դուրս։ Սոցիալական հղումով կամ բանկի էջ անցնելիս գործում է համապատասխան ծառայության գաղտնիության քաղաքականությունը։",
        },
        {
          heading: "Քարտային տվյալներ",
          text: "Երբ հասանելի է բանկի միջոցով առցանց քարտային վճարումը, քարտի տվյալները մուտքագրվում են բանկի հյուրընկալած էջում։ ATHLON-ը չի ստանում և չի պահպանում քարտի ամբողջական համարը կամ CVV կոդը։ Մեր համակարգում կարող են պահպանվել գործարքի հղումը, գումարը, արժույթը և վճարման կարգավիճակը։",
        },
        {
          heading: "Դիտարկչի պահոց և անհրաժեշտ cookie-ներ",
          text: "Զամբյուղի տվյալներն ու ավարտված վճարման որոշ հղումներ պահվում են դիտարկչի տեղային պահոցում (localStorage)։ Հաճախորդի ձևի սևագիրը, վճարման ընտրությունը և կրկնվող հարցումները կանխող նույնացուցիչները պահվում են ընթացիկ ներդիրի նստաշրջանի պահոցում (sessionStorage)։ Անվտանգության cookie-ները կիրառվում են սահմանափակ հասանելիությամբ վճարման թեստի և կառավարման մուտքի համար։ Դիտարկչի կայքի տվյալները մաքրելով կարող եք հեռացնել տեղային տվյալները․ դա չի ջնջում արդեն ուղարկված պատվերը։",
        },
        {
          heading: "Պահպանում և ձեր հարցումները",
          text: "Պատվերի տվյալներն ու հաղորդագրությունները պահպանվում են տվյալների բազայում, բիզնեսի փոստում և պահուստային պատճեններում։ Ավտոմատ ջնջման ֆիքսված ժամկետ ներկայում սահմանված չէ։ Պահպանման ժամկետի և նպատակի մասին տեղեկություն ստանալու, ձեր տվյալներին ծանոթանալու, դրանք ուղղելու կամ ջնջելու, ինչպես նաև կիրառելի դեպքում համաձայնությունը հետ վերցնելու համար դիմեք մեզ։ Հարցումները դիտարկվում են կիրառելի օրենսդրության և պարտադիր պահպանման պահանջների համաձայն․ համաձայնության հետկանչը չի վերացնում մինչ այդ օրինական մշակումը։",
        },
        {
          heading: "Հարցեր և բողոքներ",
          text: `Տվյալների պաշտպանության հարցերով գրեք athlonsportgoods@gmail.com հասցեին կամ զանգահարեք 041 44 88 55։ Կարող եք նաև դիմել Հայաստանի Հանրապետության անձնական տվյալների պաշտպանության լիազոր մարմնին կամ օգտվել օրենքով նախատեսված պաշտպանության այլ միջոցներից։`,
        },
      ],
    },
  },
  ru: {
    terms: {
      heading: "Условия использования и покупки",
      description:
        "Условия использования и покупки в ATHLON: заказы, цены, доставка, оплата и связь с продавцом.",
      introduction:
        "Эти условия относятся к использованию сайта athlon.am и покупкам в ATHLON. Обновлено: 4 ноября 2026 года.",
      sections: [
        {
          heading: "Продавец и контакты",
          text: `${businessDetails.ru.seller} · ${businessDetails.ru.address}. ${businessDetails.ru.contactOnly} ${contact}.`,
        },
        {
          heading: "Товары и цены",
          text: "На странице товара указаны его описание, цена и наличие. Цены указаны в армянских драмах (AMD). Перед отправкой заказа проверьте товар, вкус, размер упаковки, количество и итоговую сумму. При обнаружении несоответствия свяжитесь с нами.",
        },
        {
          heading: "Оформление заказа",
          text: "Для заказа укажите достоверные имя, электронную почту, телефон и адрес доставки. Эти данные используются для связи по подтверждению и доставке заказа. При изменении данных или ошибке сообщите нам как можно скорее, указав номер заказа.",
        },
        {
          heading: "Доставка и оплата",
          text: "Доставка бесплатна по всей Армении независимо от суммы заказа. При получении можно оплатить заказ наличными или картой курьеру. Детали доставки уточняйте у нас. Если при оформлении доступна онлайн-оплата картой, реквизиты вводятся на платежной странице банка. ATHLON не собирает и не хранит полный номер карты или код CVV.",
        },
        {
          heading: "Изменение, отмена и возврат",
          text: "По вопросам изменения, отмены, возврата или обмена свяжитесь с нами, указав номер заказа и суть обращения. Эта страница не устанавливает и не ограничивает предусмотренные законом права на возврат, возмещение или другие обязательные права потребителя.",
        },
        {
          heading: "Персональные данные и ваши права",
          text: "Обработка персональных данных описана в Политике конфиденциальности. К покупкам применяются обязательные требования законодательства Республики Армения. С вопросами и претензиями обращайтесь к продавцу по указанным выше контактам. Эти условия не ограничивают право использовать предусмотренные законом способы защиты.",
        },
      ],
    },
    privacy: {
      heading: "Политика конфиденциальности",
      description:
        "Как ATHLON обрабатывает данные заказов и контактов, использует хранилище браузера и принимает обращения о персональных данных.",
      introduction:
        "Эта страница объясняет обработку данных, предоставленных через athlon.am. Обновлено: 4 ноября 2026 года.",
      sections: [
        {
          heading: "Ответственный за данные и контакты",
          text: `${businessDetails.ru.seller} · ${businessDetails.ru.address}. ${businessDetails.ru.contactOnly} По вопросам о данных: ${contact}.`,
        },
        {
          heading: "Какие данные и для чего обрабатываются",
          text: "При оформлении заказа мы обрабатываем имя, электронную почту, телефон, адрес доставки, выбранные товары и их количество, а также идентификаторы и статусы заказа и платежа. Они используются для обработки и доставки заказа, сообщений о заказе и оплате и ответов на ваши обращения.",
        },
        {
          heading: "Поставщики услуг",
          text: "Для размещения сайта и базы данных используется AWS, для отправки писем о заказах — Resend, а рабочий почтовый ящик находится в Google Gmail. Исполнителю доставки передаются необходимые для доставки контактные данные и адрес. Эти сервисы могут обрабатывать данные за пределами Армении. При переходе по социальной ссылке или на страницу банка применяется политика конфиденциальности соответствующего сервиса.",
        },
        {
          heading: "Данные карты",
          text: "Когда доступна онлайн-оплата через банк, реквизиты карты вводятся на странице, размещенной банком. ATHLON не получает и не хранит полный номер карты или код CVV. В нашей системе могут сохраняться идентификатор операции, сумма, валюта и статус платежа.",
        },
        {
          heading: "Хранилище браузера и необходимые cookie",
          text: "Данные корзины и некоторые ссылки на завершенные платежи сохраняются в локальном хранилище браузера (localStorage). Черновик контактной формы, способ оплаты и идентификаторы для предотвращения повторных запросов сохраняются в хранилище сеанса вкладки (sessionStorage). Cookie безопасности используются для тестирования оплаты с ограниченным доступом и входа в панель управления. Очистка данных сайта в браузере удаляет локальные сведения, но не удаляет уже отправленный заказ.",
        },
        {
          heading: "Хранение и ваши обращения",
          text: "Данные заказов и сообщения хранятся в базе данных, рабочей почте и резервных копиях. Фиксированный срок автоматического удаления сейчас не установлен. Свяжитесь с нами, чтобы узнать срок и цель хранения, запросить доступ, исправление или удаление своих данных, а также отозвать согласие, когда оно применимо. Обращения рассматриваются с учетом действующего законодательства и обязательных требований к хранению; отзыв согласия не отменяет предшествующую законную обработку.",
        },
        {
          heading: "Вопросы и жалобы",
          text: "По вопросам защиты данных пишите на athlonsportgoods@gmail.com или звоните 041 44 88 55. Вы также можете обратиться в уполномоченный орган Республики Армения по защите персональных данных или воспользоваться другими предусмотренными законом способами защиты.",
        },
      ],
    },
  },
  en: {
    terms: {
      heading: "Terms and conditions",
      description:
        "ATHLON terms for using the website and shopping: orders, prices, delivery, payment and seller contact details.",
      introduction:
        "These terms concern use of athlon.am and purchases from ATHLON. Updated: 4 November 2026.",
      sections: [
        {
          heading: "Seller and contact details",
          text: `${businessDetails.en.seller} · ${businessDetails.en.address}. ${businessDetails.en.contactOnly} ${contact}.`,
        },
        {
          heading: "Products and prices",
          text: "The product page shows its description, price and availability. Prices are in Armenian drams (AMD). Before submitting an order, check the product, flavor, package size, quantity and total. Contact us if you notice a discrepancy.",
        },
        {
          heading: "Placing an order",
          text: "Provide an accurate name, email address, phone number and delivery address for your order. These details are used for order confirmation and delivery communication. Tell us as soon as possible about any change or mistake, quoting your order reference.",
        },
        {
          heading: "Delivery and payment",
          text: "Delivery is free throughout Armenia, regardless of order value. You can pay cash or card to the courier on delivery. Contact us to confirm delivery details. If online card payment is offered at checkout, card details are entered on the bank's payment page. ATHLON does not collect or store full card numbers or CVV codes.",
        },
        {
          heading: "Changes, cancellation and returns",
          text: "Contact us about order changes, cancellation, returns or exchanges, quoting your order reference and explaining the issue. This page does not establish or restrict statutory return, reimbursement or other mandatory consumer rights.",
        },
        {
          heading: "Personal data and your rights",
          text: "Our handling of personal data is described in the Privacy policy. Purchases are subject to the mandatory requirements of the laws of the Republic of Armenia. Contact the seller using the details above with questions or complaints. These terms do not limit your right to use remedies available under applicable law.",
        },
      ],
    },
    privacy: {
      heading: "Privacy policy",
      description:
        "How ATHLON handles order and contact data, uses browser storage and receives requests about personal data.",
      introduction:
        "This page explains the handling of data provided through athlon.am. Updated: 4 November 2026.",
      sections: [
        {
          heading: "Who is responsible and how to contact us",
          text: `${businessDetails.en.seller} · ${businessDetails.en.address}. ${businessDetails.en.contactOnly} For data questions: ${contact}.`,
        },
        {
          heading: "Data and purposes",
          text: "When you place an order, we process your name, email address, phone number, delivery address, selected products and quantities, and order/payment references and statuses. They are used to process and deliver the order, send order and payment messages, and respond to your enquiries.",
        },
        {
          heading: "Service providers",
          text: "AWS hosts the website and database, Resend sends order emails, and the business inbox uses Google Gmail. The delivery provider receives the contact and address details needed to deliver your order. These services may process data outside Armenia. If you follow a social link or open a bank payment page, that service's privacy policy applies.",
        },
        {
          heading: "Card details",
          text: "When online card payment through the bank is available, card details are entered on a page hosted by the bank. ATHLON does not receive or store full card numbers or CVV codes. Our system may retain the transaction reference, amount, currency and payment status.",
        },
        {
          heading: "Browser storage and necessary cookies",
          text: "Basket data and some references to completed payments are saved in the browser's local storage (localStorage). The customer form draft, payment choice and identifiers used to prevent repeat requests are saved in the tab's session storage (sessionStorage). Security cookies are used for the restricted payment test and administration sign-in. Clearing the browser's site data removes local records; it does not delete an order already submitted.",
        },
        {
          heading: "Retention and your requests",
          text: "Order records and messages remain in the database, business email and backups. A fixed automatic-deletion period is not currently configured. Contact us for information about the retention period and purpose, to request access, correction or deletion of your data, or to withdraw consent where applicable. Requests are considered under applicable law and mandatory record-retention requirements; withdrawing consent does not undo prior lawful processing.",
        },
        {
          heading: "Questions and complaints",
          text: "For data protection questions, email athlonsportgoods@gmail.com or call 041 44 88 55. You may also contact the authorised personal-data protection body of the Republic of Armenia or use other remedies provided by law.",
        },
      ],
    },
  },
};
