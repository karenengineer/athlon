import { Locale } from "../../core/i18n/i18n.service";
import { GuideSlug } from "./guide-slugs";

export interface GuideSection {
  heading: string;
  paragraphs: readonly string[];
}

export interface Guide {
  /** Page title without the "| ATHLON" suffix. */
  title: string;
  heading: string;
  description: string;
  introduction: string;
  sections: readonly GuideSection[];
}

export interface GuideEntry {
  /** Catalog category the guide links to, and is linked from. */
  category: string;
  copy: Record<Locale, Guide>;
}

export const guidesCopy: Record<
  Locale,
  {
    title: string;
    heading: string;
    description: string;
    introduction: string;
    readMore: string;
    related: string;
    shop: string;
    all: string;
  }
> = {
  hy: {
    title: "Սպորտային սննդի ուղեցույցներ",
    heading: "Ուղեցույցներ",
    description:
      "Ինչպես ընտրել պրոտեին, կրեատին և նախամարզումային համալիր, ինչպես տարբերել օրիգինալ ապրանքը կեղծից։ Գործնական խորհուրդներ ATHLON-ից։",
    introduction:
      "Գործնական խորհուրդներ սպորտային սննդի ընտրության և օգտագործման վերաբերյալ։ Դրանք չեն փոխարինում բժշկի խորհրդատվությանը։",
    readMore: "Կարդալ",
    related: "Օգտակար հոդվածներ",
    shop: "Դիտել ապրանքները",
    all: "Բոլոր ուղեցույցները",
  },
  ru: {
    title: "Статьи о спортивном питании",
    heading: "Полезные статьи",
    description:
      "Как выбрать протеин, креатин и предтренировочный комплекс и как отличить оригинал от подделки. Практические советы от ATHLON.",
    introduction:
      "Практические советы по выбору и приёму спортивного питания. Они не заменяют консультацию врача.",
    readMore: "Читать",
    related: "Полезные статьи",
    shop: "Смотреть товары",
    all: "Все статьи",
  },
  en: {
    title: "Sports nutrition guides",
    heading: "Guides",
    description:
      "How to choose protein, creatine and pre-workout, and how to tell original supplements from fakes. Practical advice from ATHLON.",
    introduction:
      "Practical advice on choosing and using sports nutrition. It doesn't replace advice from a doctor.",
    readMore: "Read",
    related: "Helpful guides",
    shop: "Shop the products",
    all: "All guides",
  },
};

export const guides: Record<GuideSlug, GuideEntry> = {
  "how-to-choose-protein": {
    category: "protein",
    copy: {
      hy: {
        title: "Ինչպես ընտրել պրոտեին․ ուղեցույց սկսնակների համար",
        heading: "Ինչպես ընտրել պրոտեին",
        description:
          "Շիճուկային կոնցենտրատ, իզոլատ թե գեյներ․ ինչին նայել պիտակի վրա, ինչպես հաշվել մեկ չափաբաժնի գինը և ինչպես ընդունել պրոտեինը։",
        introduction:
          "Պրոտեինը (սպիտակուցային փոշին) սննդակարգում սպիտակուցի քանակը լրացնելու հարմար միջոց է։ Այս ուղեցույցում կպատմենք, թե ինչ տեսակներ կան և ինչպես ընտրել ձեզ համապատասխանը։",
        sections: [
          {
            heading: "Ում է պետք պրոտեինը",
            paragraphs: [
              "Պրոտեինը պարտադիր չէ․ եթե սովորական սննդից բավարար սպիտակուց եք ստանում, այն ընդամենը հարմարություն է։ Այն օգտակար է, երբ դժվար է սննդով ստանալ անհրաժեշտ քանակը, օրինակ՝ զբաղված օրերին կամ ակտիվ մարզումների շրջանում։",
              "Կանոնավոր մարզվողների համար հաճախ նշվում է օրական մոտ 1,4–2 գ սպիտակուց մարմնի քաշի յուրաքանչյուր կիլոգրամի համար։ Հաշվեք, թե որքան եք արդեն ստանում սննդից, և պրոտեինով լրացրեք պակասը։",
            ],
          },
          {
            heading: "Պրոտեինի տեսակները",
            paragraphs: [
              "Շիճուկային կոնցենտրատ․ ամենատարածված տարբերակն է՝ լավ համով և մատչելի գնով։ Իզոլատ․ ավելի մաքրված է, պարունակում է ավելի քիչ ճարպ և լակտոզա, սովորաբար մի փոքր ավելի թանկ է։ Գեյներ․ սպիտակուցի և ածխաջրերի խառնուրդ է այն մարդկանց համար, ովքեր դժվարությամբ են քաշ հավաքում։",
            ],
          },
          {
            heading: "Ինչին նայել պիտակի վրա",
            paragraphs: [
              "Սպիտակուցի քանակը մեկ չափաբաժնում․ 20–25 գրամը լավ ցուցանիշ է։ Չափաբաժինների թիվը փաթեթում։ Մեկ չափաբաժնի գինը՝ փաթեթի գինը բաժանած չափաբաժինների թվի վրա․ այդպես ավելի ճիշտ եք համեմատում տարբեր փաթեթներ։ Կազմը՝ շաքարի, քաղցրացուցիչների և ալերգենների առկայությունը։",
            ],
          },
          {
            heading: "Ինչպես ընդունել",
            paragraphs: [
              "Մեկ չափաբաժինը խառնեք ջրի կամ կաթի հետ։ Շատերն այն ընդունում են մարզումից հետո կամ նախաճաշին, բայց ավելի կարևոր է օրվա ընթացքում ստացվող սպիտակուցի ընդհանուր քանակը։ Հետևեք փաթեթի ցուցումներին, իսկ առողջական խնդիրների դեպքում նախապես խորհրդակցեք բժշկի հետ։",
            ],
          },
          {
            heading: "Պրոտեին ATHLON-ում",
            paragraphs: [
              "Մեր կատալոգում կգտնեք Optimum Nutrition Gold Standard 100% Whey (մեկ չափաբաժնում 24 գ սպիտակուց) և Trec Nutrition շիճուկային պրոտեին՝ տարբեր համերով։ Առաքումը ողջ Հայաստանում անվճար է։",
            ],
          },
        ],
      },
      ru: {
        title: "Как выбрать протеин: гид для начинающих",
        heading: "Как выбрать протеин",
        description:
          "Сывороточный концентрат, изолят или гейнер: на что смотреть на этикетке, как посчитать цену порции и как принимать протеин.",
        introduction:
          "Протеин (белковый порошок) — удобный способ добрать белок в рационе. Рассказываем, какие бывают виды и как выбрать подходящий.",
        sections: [
          {
            heading: "Кому нужен протеин",
            paragraphs: [
              "Протеин не обязателен: если вы получаете достаточно белка из обычной еды, это просто удобство. Он полезен, когда сложно добрать нужное количество едой, например в загруженные дни или в период активных тренировок.",
              "Для регулярно тренирующихся людей часто называют около 1,4–2 г белка на килограмм массы тела в день. Посчитайте, сколько вы уже получаете с едой, и добирайте разницу протеином.",
            ],
          },
          {
            heading: "Виды протеина",
            paragraphs: [
              "Сывороточный концентрат — самый популярный вариант с хорошим вкусом и доступной ценой. Изолят сильнее очищен, содержит меньше жира и лактозы и обычно стоит немного дороже. Гейнер — смесь белка и углеводов для тех, кому трудно набирать вес.",
            ],
          },
          {
            heading: "На что смотреть на этикетке",
            paragraphs: [
              "Количество белка в порции: 20–25 г — хороший показатель. Число порций в упаковке. Цена порции — цена упаковки, делённая на число порций: так честнее сравнивать разные фасовки. Состав — сахар, подсластители и аллергены.",
            ],
          },
          {
            heading: "Как принимать",
            paragraphs: [
              "Размешайте порцию в воде или молоке. Многие пьют протеин после тренировки или на завтрак, но важнее общее количество белка за день. Следуйте инструкции на упаковке, а при проблемах со здоровьем сначала проконсультируйтесь с врачом.",
            ],
          },
          {
            heading: "Протеин в ATHLON",
            paragraphs: [
              "В нашем каталоге есть Optimum Nutrition Gold Standard 100% Whey (24 г белка в порции) и сывороточный протеин Trec Nutrition разных вкусов. Доставка по всей Армении бесплатная.",
            ],
          },
        ],
      },
      en: {
        title: "How to choose protein powder: a beginner's guide",
        heading: "How to choose protein powder",
        description:
          "Whey concentrate, isolate or mass gainer: what to check on the label, how to work out price per serving and how to take protein.",
        introduction:
          "Protein powder is a convenient way to add protein to your diet. This guide covers the main types and how to pick the right one.",
        sections: [
          {
            heading: "Who needs protein powder",
            paragraphs: [
              "Protein powder isn't essential: if you get enough protein from regular food, it is simply a convenience. It helps when it's hard to reach your target with meals, for example on busy days or during heavy training.",
              "For people who train regularly, around 1.4–2 g of protein per kilogram of body weight per day is often cited. Work out how much you already get from food and use protein powder to cover the gap.",
            ],
          },
          {
            heading: "Types of protein",
            paragraphs: [
              "Whey concentrate is the most popular option, with good taste and a fair price. Isolate is more refined, with less fat and lactose, and usually costs a little more. A mass gainer combines protein and carbohydrates for people who struggle to gain weight.",
            ],
          },
          {
            heading: "What to check on the label",
            paragraphs: [
              "Protein per serving: 20–25 g is a good figure. The number of servings in the pack. Price per serving — the pack price divided by the number of servings — is the fairest way to compare sizes. The ingredients: sugar, sweeteners and allergens.",
            ],
          },
          {
            heading: "How to take it",
            paragraphs: [
              "Mix one serving with water or milk. Many people have it after training or with breakfast, but your total protein across the day matters more. Follow the directions on the package, and if you have a health condition, talk to a doctor first.",
            ],
          },
          {
            heading: "Protein at ATHLON",
            paragraphs: [
              "Our catalog includes Optimum Nutrition Gold Standard 100% Whey (24 g protein per serving) and Trec Nutrition whey in several flavors. Delivery is free throughout Armenia.",
            ],
          },
        ],
      },
    },
  },
  "creatine-guide": {
    category: "creatine",
    copy: {
      hy: {
        title: "Կրեատին․ ինչ է, ինչպես և երբ ընդունել",
        heading: "Կրեատին․ ինչպես և երբ ընդունել",
        description:
          "Ինչ է կրեատին մոնոհիդրատը, որքան ընդունել, պետք է արդյոք բեռնման փուլը և ինչ է իրականում տեղի ունենում ջրի պահման հետ։",
        introduction:
          "Կրեատինը սպորտային սննդի ամենաշատ ուսումնասիրված հավելումներից է։ Պատմում ենք, թե ինչպես է այն աշխատում և ինչպես ճիշտ ընդունել։",
        sections: [
          {
            heading: "Ինչ է կրեատինը",
            paragraphs: [
              "Կրեատինը բնականորեն առկա է մկաններում և մասնակցում է կարճ ու ինտենսիվ ծանրաբեռնվածության համար էներգիայի արտադրությանը, օրինակ՝ ծանրություն բարձրացնելիս կամ սպրինտի ժամանակ։ Կրեատին մոնոհիդրատը նրա ամենաշատ ուսումնասիրված ձևն է։",
            ],
          },
          {
            heading: "Որքան ընդունել",
            paragraphs: [
              "Սովորաբար ընդունում են օրական 3–5 գ։ Կարելի է սկսել բեռնման փուլով՝ օրական մոտ 20 գ՝ բաժանված 4 ընդունման, 5–7 օրվա ընթացքում, բայց դա պարտադիր չէ․ ամենօրյա կանոնավոր ընդունումը նույն արդյունքին է հասցնում, պարզապես ավելի դանդաղ։ Հետևեք փաթեթի ցուցումներին։",
            ],
          },
          {
            heading: "Երբ ընդունել",
            paragraphs: [
              "Ժամը մեծ նշանակություն չունի․ կարևորը կանոնավորությունն է։ Կրեատինը կարելի է խառնել ջրի, հյութի կամ պրոտեինային կոկտեյլի հետ և ընդունել ամեն օր, այդ թվում՝ հանգստի օրերին։",
            ],
          },
          {
            heading: "Տարածված հարցեր",
            paragraphs: [
              "Առաջին շաբաթներին քաշը կարող է ավելանալ 1–2 կգ-ով․ դա հիմնականում մկաններում պահվող ջուրն է, ոչ թե ճարպը։ Առողջ մարդկանց մոտ առաջարկվող չափաբաժիններով ընդունումը համարվում է անվտանգ, իսկ երիկամների հիվանդության կամ այլ առողջական խնդիրների դեպքում նախապես խորհրդակցեք բժշկի հետ։",
            ],
          },
          {
            heading: "Կրեատին ATHLON-ում",
            paragraphs: [
              "Մեր կատալոգում կան Optimum Nutrition, Trec Nutrition և Rule 1 կրեատին մոնոհիդրատներ՝ տարբեր փաթեթներով։ Համեմատեք մեկ չափաբաժնի գինը․ մեծ փաթեթը հաճախ ավելի շահավետ է։",
            ],
          },
        ],
      },
      ru: {
        title: "Креатин: что это, как и когда принимать",
        heading: "Креатин: как и когда принимать",
        description:
          "Что такое креатин моногидрат, сколько принимать, нужна ли загрузка и что на самом деле происходит с задержкой воды.",
        introduction:
          "Креатин — одна из самых изученных спортивных добавок. Рассказываем, как он работает и как его правильно принимать.",
        sections: [
          {
            heading: "Что такое креатин",
            paragraphs: [
              "Креатин естественно присутствует в мышцах и участвует в выработке энергии для коротких интенсивных нагрузок — например, при подъёме веса или спринте. Креатин моногидрат — его наиболее изученная форма.",
            ],
          },
          {
            heading: "Сколько принимать",
            paragraphs: [
              "Обычно принимают 3–5 г в день. Можно начать с загрузки — около 20 г в день, разделённых на 4 приёма, в течение 5–7 дней, — но это не обязательно: регулярный ежедневный приём даёт тот же результат, просто медленнее. Следуйте инструкции на упаковке.",
            ],
          },
          {
            heading: "Когда принимать",
            paragraphs: [
              "Время приёма почти не важно — важна регулярность. Креатин можно размешать в воде, соке или протеиновом коктейле и принимать каждый день, включая дни отдыха.",
            ],
          },
          {
            heading: "Частые вопросы",
            paragraphs: [
              "В первые недели вес может вырасти на 1–2 кг: в основном это вода в мышцах, а не жир. У здоровых людей приём в рекомендуемых дозах считается безопасным, а при болезнях почек или других проблемах со здоровьем сначала проконсультируйтесь с врачом.",
            ],
          },
          {
            heading: "Креатин в ATHLON",
            paragraphs: [
              "В нашем каталоге есть креатин моногидрат Optimum Nutrition, Trec Nutrition и Rule 1 в разных фасовках. Сравнивайте цену за порцию: большая упаковка часто выгоднее.",
            ],
          },
        ],
      },
      en: {
        title: "Creatine: what it is, how and when to take it",
        heading: "Creatine: how and when to take it",
        description:
          "What creatine monohydrate is, how much to take, whether you need a loading phase and what water retention really means.",
        introduction:
          "Creatine is one of the most researched sports supplements. Here is how it works and how to take it properly.",
        sections: [
          {
            heading: "What creatine is",
            paragraphs: [
              "Creatine occurs naturally in muscle and helps produce energy for short, intense efforts such as lifting or sprinting. Creatine monohydrate is its most researched form.",
            ],
          },
          {
            heading: "How much to take",
            paragraphs: [
              "The usual amount is 3–5 g a day. You can start with a loading phase — about 20 g a day split into 4 doses for 5–7 days — but it isn't necessary: taking it daily reaches the same result, just more slowly. Follow the directions on the package.",
            ],
          },
          {
            heading: "When to take it",
            paragraphs: [
              "Timing matters little; consistency matters most. Mix it with water, juice or a protein shake and take it every day, including rest days.",
            ],
          },
          {
            heading: "Common questions",
            paragraphs: [
              "Your weight may rise by 1–2 kg in the first weeks: that is mostly water held in the muscles, not fat. For healthy people, recommended doses are considered safe; if you have kidney disease or another health condition, talk to a doctor first.",
            ],
          },
          {
            heading: "Creatine at ATHLON",
            paragraphs: [
              "We stock creatine monohydrate from Optimum Nutrition, Trec Nutrition and Rule 1 in several sizes. Compare the price per serving: a larger pack is often better value.",
            ],
          },
        ],
      },
    },
  },
  "pre-workout-guide": {
    category: "pre-workout",
    copy: {
      hy: {
        title:
          "Նախամարզումային համալիր (pre-workout)․ ինչպես ընտրել և ընդունել",
        heading: "Նախամարզումային համալիր․ ինչպես ընտրել և ընդունել",
        description:
          "Ինչ է պարունակում pre-workout-ը, որքան կոֆեին է անվտանգ, երբ ընդունել և ում պետք է նախապես խորհրդակցել բժշկի հետ։",
        introduction:
          "Նախամարզումային համալիրն ընդունում են մարզումից առաջ՝ էներգիայի և կենտրոնացման համար։ Պատմում ենք, թե ինչին ուշադրություն դարձնել։",
        sections: [
          {
            heading: "Ինչ է պարունակում",
            paragraphs: [
              "Կազմը տարբեր է, բայց հաճախ հանդիպում են կոֆեին (էներգիա և կենտրոնացում), բետա-ալանին (կարող է առաջացնել անվնաս ծակծկոց մաշկի վրա) և ցիտրուլին։ Միշտ կարդացեք պիտակը և ստուգեք յուրաքանչյուր բաղադրիչի քանակը։",
            ],
          },
          {
            heading: "Կոֆեին․ որքանն է շատ",
            paragraphs: [
              "Ստուգեք, թե քանի միլիգրամ կոֆեին կա մեկ չափաբաժնում։ Առողջ չափահասների համար սովորաբար նշվում է օրական մինչև 400 մգ կոֆեին բոլոր աղբյուրներից միասին, ուստի հաշվի առեք նաև սուրճը և էներգետիկ ըմպելիքները։",
            ],
          },
          {
            heading: "Ինչպես ընդունել",
            paragraphs: [
              "Սովորաբար՝ մարզումից 20–30 րոպե առաջ։ Առաջին անգամ սկսեք կես չափաբաժնից՝ ստուգելու, թե ինչպես է օրգանիզմն արձագանքում։ Մի ընդունեք երեկոյան ուշ, քանի որ կոֆեինը կարող է խանգարել քնին, և մի գերազանցեք փաթեթին նշված չափաբաժինը։",
            ],
          },
          {
            heading: "Ում պետք է նախապես խորհրդակցել բժշկի հետ",
            paragraphs: [
              "Հղիության կամ կրծքով կերակրման, սրտի կամ արյան ճնշման խնդիրների, կոֆեինի նկատմամբ զգայունության կամ դեղորայք ընդունելու դեպքում։ Նախամարզումային համալիրները նախատեսված չեն 18 տարեկանից ցածրերի համար։",
            ],
          },
          {
            heading: "Pre-workout ATHLON-ում",
            paragraphs: [
              "Մեր կատալոգում կգտնեք Cellucor C4 նախամարզումային համալիրներ։ Համեմատեք համերը և չափաբաժինների թիվը ապրանքի էջում։",
            ],
          },
        ],
      },
      ru: {
        title:
          "Предтренировочный комплекс (pre-workout): как выбрать и принимать",
        heading: "Предтренировочный комплекс: как выбрать и принимать",
        description:
          "Что входит в pre-workout, сколько кофеина безопасно, когда принимать и кому стоит сначала проконсультироваться с врачом.",
        introduction:
          "Предтренировочный комплекс принимают перед тренировкой для энергии и концентрации. Рассказываем, на что обратить внимание.",
        sections: [
          {
            heading: "Что в составе",
            paragraphs: [
              "Составы различаются, но часто встречаются кофеин (энергия и концентрация), бета-аланин (может вызывать безвредное покалывание кожи) и цитруллин. Всегда читайте этикетку и проверяйте количество каждого компонента.",
            ],
          },
          {
            heading: "Кофеин: сколько — это много",
            paragraphs: [
              "Проверьте, сколько миллиграммов кофеина в одной порции. Для здоровых взрослых обычно называют до 400 мг кофеина в день из всех источников вместе, поэтому учитывайте кофе и энергетики.",
            ],
          },
          {
            heading: "Как принимать",
            paragraphs: [
              "Обычно за 20–30 минут до тренировки. В первый раз начните с половины порции, чтобы проверить реакцию. Не принимайте поздно вечером — кофеин может мешать сну — и не превышайте порцию, указанную на упаковке.",
            ],
          },
          {
            heading: "Кому сначала нужно к врачу",
            paragraphs: [
              "При беременности или кормлении грудью, проблемах с сердцем или давлением, чувствительности к кофеину или приёме лекарств. Предтренировочные комплексы не предназначены для лиц младше 18 лет.",
            ],
          },
          {
            heading: "Pre-workout в ATHLON",
            paragraphs: [
              "В нашем каталоге есть предтренировочные комплексы Cellucor C4. Сравните вкусы и число порций на странице товара.",
            ],
          },
        ],
      },
      en: {
        title: "Pre-workout: how to choose and take it",
        heading: "Pre-workout: how to choose and take it",
        description:
          "What goes into a pre-workout, how much caffeine is safe, when to take it and who should talk to a doctor first.",
        introduction:
          "A pre-workout is taken before training for energy and focus. Here is what to look out for.",
        sections: [
          {
            heading: "What's inside",
            paragraphs: [
              "Formulas vary, but common ingredients are caffeine (energy and focus), beta-alanine (which can cause a harmless tingling of the skin) and citrulline. Always read the label and check the amount of each ingredient.",
            ],
          },
          {
            heading: "Caffeine: how much is too much",
            paragraphs: [
              "Check how many milligrams of caffeine one serving contains. For healthy adults, up to 400 mg of caffeine a day from all sources combined is usually cited, so count coffee and energy drinks too.",
            ],
          },
          {
            heading: "How to take it",
            paragraphs: [
              "Usually 20–30 minutes before training. The first time, start with half a serving to see how you react. Avoid it late in the evening, as caffeine can disturb sleep, and don't exceed the serving on the package.",
            ],
          },
          {
            heading: "Who should talk to a doctor first",
            paragraphs: [
              "Anyone pregnant or breastfeeding, with heart or blood-pressure problems, sensitive to caffeine or taking medication. Pre-workouts are not intended for people under 18.",
            ],
          },
          {
            heading: "Pre-workout at ATHLON",
            paragraphs: [
              "Our catalog includes Cellucor C4 pre-workouts. Compare flavors and the number of servings on the product page.",
            ],
          },
        ],
      },
    },
  },
  "original-vs-fake-supplements": {
    category: "sports-nutrition",
    copy: {
      hy: {
        title: "Ինչպես տարբերել օրիգինալ սպորտային սնունդը կեղծից",
        heading: "Ինչպես տարբերել օրիգինալ սպորտային սնունդը կեղծից",
        description:
          "Ինչ ստուգել փաթեթի, պիտակի, ապրանքի և վաճառողի վրա, որպեսզի չգնեք կեղծ պրոտեին կամ կրեատին։",
        introduction:
          "Հայտնի բրենդների սպորտային սնունդը հաճախ կեղծում են։ Կեղծ ապրանքը կարող է պարունակել ավելի քիչ սպիտակուց կամ անհայտ բաղադրիչներ։ Ահա թե ինչ ստուգել գնելիս։",
        sections: [
          {
            heading: "Փաթեթ և պիտակ",
            paragraphs: [
              "Կափարիչի տակ պաշտպանիչ թաղանթը պետք է ամբողջական լինի։ Ուշադրություն դարձրեք տպագրության որակին, տառասխալներին և լոգոյի անհամապատասխանություններին։ Խմբաքանակի համարը և պիտանիության ժամկետը պետք է հստակ տպված լինեն և համընկնեն պիտակի ու տարայի վրա։",
            ],
          },
          {
            heading: "Արտադրողի ստուգում",
            paragraphs: [
              "Որոշ արտադրողներ ապրանքի վրա տեղադրում են ստուգման կոդ, QR կոդ կամ հոլոգրամ։ Եթե այդպիսին կա, ստուգեք այն արտադրողի պաշտոնական կայքում։",
            ],
          },
          {
            heading: "Ապրանքը",
            paragraphs: [
              "Անսովոր հոտը, գույնը, համը կամ գնդիկները, որոնք չեն լուծվում, պատճառ են զգուշանալու։ Եթե նախկինում օգտագործել եք նույն ապրանքը, համեմատեք։",
            ],
          },
          {
            heading: "Գինը և վաճառողը",
            paragraphs: [
              "Շուկայականից զգալիորեն ցածր գինը ահազանգ է։ Գնեք այն վաճառողներից, ովքեր կարող են ասել, թե որտեղից է ապրանքը, և պատասխանում են հարցերին։ Կասկածի դեպքում հարցրեք ապրանքի ծագման մասին։",
            ],
          },
          {
            heading: "ATHLON-ում",
            paragraphs: [
              "Մենք վաճառում ենք միայն օրիգինալ ապրանքներ, որոնք ստանում ենք արտադրողից։ Ապրանքի վերաբերյալ ցանկացած հարցով զանգահարեք 041 44 88 55 հեռախոսահամարով։",
            ],
          },
        ],
      },
      ru: {
        title: "Как отличить оригинальное спортивное питание от подделки",
        heading: "Как отличить оригинальное спортивное питание от подделки",
        description:
          "Что проверить на упаковке, этикетке, в самом продукте и у продавца, чтобы не купить поддельный протеин или креатин.",
        introduction:
          "Спортивное питание известных брендов часто подделывают. В подделке может быть меньше белка или неизвестные компоненты. Вот что проверить при покупке.",
        sections: [
          {
            heading: "Упаковка и этикетка",
            paragraphs: [
              "Защитная плёнка под крышкой должна быть целой. Обратите внимание на качество печати, опечатки и несоответствия логотипа. Номер партии и срок годности должны быть чётко напечатаны и совпадать на этикетке и банке.",
            ],
          },
          {
            heading: "Проверка у производителя",
            paragraphs: [
              "Некоторые производители размещают на продукте код проверки, QR-код или голограмму. Если он есть, проверьте его на официальном сайте производителя.",
            ],
          },
          {
            heading: "Сам продукт",
            paragraphs: [
              "Необычный запах, цвет, вкус или комки, которые не размешиваются, — повод насторожиться. Если вы уже пользовались этим продуктом, сравните.",
            ],
          },
          {
            heading: "Цена и продавец",
            paragraphs: [
              "Цена заметно ниже рыночной — тревожный сигнал. Покупайте у продавцов, которые могут сказать, откуда товар, и отвечают на вопросы. При сомнениях спросите о происхождении продукта.",
            ],
          },
          {
            heading: "В ATHLON",
            paragraphs: [
              "Мы продаём только оригинальную продукцию, которую получаем от производителя. С любыми вопросами о товаре звоните по номеру 041 44 88 55.",
            ],
          },
        ],
      },
      en: {
        title: "How to tell original sports supplements from fakes",
        heading: "How to tell original sports supplements from fakes",
        description:
          "What to check on the packaging, the label, the product itself and the seller so you don't buy fake protein or creatine.",
        introduction:
          "Big-brand sports supplements are often counterfeited. A fake may contain less protein or unknown ingredients. Here is what to check when you buy.",
        sections: [
          {
            heading: "Packaging and label",
            paragraphs: [
              "The safety seal under the lid should be intact. Look at the print quality, typos and any mismatch in the logo. The batch number and expiry date should be clearly printed and match on the label and the tub.",
            ],
          },
          {
            heading: "Manufacturer verification",
            paragraphs: [
              "Some manufacturers put a verification code, QR code or hologram on the product. If there is one, check it on the manufacturer's official website.",
            ],
          },
          {
            heading: "The product itself",
            paragraphs: [
              "An unusual smell, color or taste, or clumps that won't mix, are reasons to be cautious. If you have used the same product before, compare.",
            ],
          },
          {
            heading: "Price and seller",
            paragraphs: [
              "A price well below the market is a warning sign. Buy from sellers who can tell you where the product comes from and who answer questions. If in doubt, ask about its origin.",
            ],
          },
          {
            heading: "At ATHLON",
            paragraphs: [
              "We sell only original products that we receive from the manufacturer. For any question about a product, call 041 44 88 55.",
            ],
          },
        ],
      },
    },
  },
};

export function guidesForCategory(
  category: string | null | undefined,
): GuideSlugAndEntry[] {
  return category
    ? (Object.entries(guides) as GuideSlugAndEntry[]).filter(
        ([, entry]) => entry.category === category,
      )
    : [];
}

export type GuideSlugAndEntry = [GuideSlug, GuideEntry];
