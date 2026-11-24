/**
 * Full article copy. Imported only by the lazily loaded guide page; links,
 * headings and categories live in guide-index.ts so pages that link to guides
 * do not ship article text in the initial bundle.
 */
import { Locale } from "../../core/i18n/i18n.service";
import { GuideSlug } from "./guide-slugs";

export interface GuideSection {
  heading: string;
  paragraphs: readonly string[];
}

export interface Guide {
  /** Page title without the "| ATHLON" suffix. */
  title: string;
  description: string;
  introduction: string;
  sections: readonly GuideSection[];
}

export interface GuideEntry {
  copy: Record<Locale, Guide>;
}

const originalGuides: Omit<
  Record<GuideSlug, GuideEntry>,
  "gainer-guide" | "bcaa-amino-acids-guide" | "l-carnitine-guide"
> = {
  "how-to-choose-protein": {
    copy: {
      hy: {
        title: "Ինչպես ընտրել պրոտեին․ ուղեցույց սկսնակների համար",
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
    copy: {
      hy: {
        title: "Կրեատին․ ինչ է, ինչպես և երբ ընդունել",
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
    copy: {
      hy: {
        title:
          "Նախամարզումային համալիր (pre-workout)․ ինչպես ընտրել և ընդունել",
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
    copy: {
      hy: {
        title: "Ինչպես տարբերել օրիգինալ սպորտային սնունդը կեղծից",
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

const newGuides: Pick<
  Record<GuideSlug, GuideEntry>,
  "gainer-guide" | "bcaa-amino-acids-guide" | "l-carnitine-guide"
> = {
  "gainer-guide": {
    copy: {
      hy: {
        title: "Գեյներ․ ինչ է, ում է պետք և ինչպես ընդունել",
        description:
          "Ինչով է գեյները տարբերվում պրոտեինից, ում է այն օգնում քաշ հավաքել, ինչպես ընդունել և ինչին ուշադրություն դարձնել պիտակի վրա։",
        introduction:
          "Գեյները սպիտակուցի և ածխաջրերի խառնուրդ է, որն օգնում է ստանալ ավելի շատ կալորիա։ Պատմում ենք, թե ում է այն պետք և ինչպես օգտագործել։",
        sections: [
          {
            heading: "Գեյներ թե պրոտեին",
            paragraphs: [
              "Պրոտեինը հիմնականում սպիտակուց է, իսկ գեյներում սպիտակուցից բացի շատ ածխաջրեր կան, ուստի մեկ չափաբաժինը շատ ավելի կալորիական է։ Եթե ձեր նպատակը քաշ հավաքելն է, իսկ սովորական սննդով բավարար կալորիա ստանալը դժվար է, գեյները հարմար լուծում է։",
            ],
          },
          {
            heading: "Ում է այն պետք",
            paragraphs: [
              "Գեյները նախատեսված է նրանց համար, ովքեր դժվարությամբ են քաշ հավաքում։ Այն նիհարելու համար չէ, և եթե արդեն հեշտությամբ եք քաշ հավաքում, ավելի լավ է ընտրել պրոտեին։ Քաշ հավաքելու համար ընդհանուր կալորիաների ավելցուկն է կարևոր, ոչ թե կոնկրետ հավելումը։",
            ],
          },
          {
            heading: "Ինչպես ընդունել",
            paragraphs: [
              "Որոշ գեյների մեկ ամբողջական չափաբաժինը կարող է գերազանցել 1000 կկալ-ը, ուստի նախ ստուգեք պիտակը։ Կարելի է սկսել կես չափաբաժնից կամ օրական չափաբաժինը բաժանել երկու մասի, օրինակ՝ մարզումից հետո և սննդի միջև։ Հետևեք փաթեթի ցուցումներին։",
            ],
          },
          {
            heading: "Ինչին նայել պիտակի վրա",
            paragraphs: [
              "Կալորիաներ, սպիտակուց և ածխաջրեր մեկ չափաբաժնում, շաքարի քանակը և չափաբաժինների թիվը փաթեթում։ Շաքարախտի կամ այլ առողջական խնդիրների դեպքում նախապես խորհրդակցեք բժշկի հետ։",
            ],
          },
          {
            heading: "Գեյներ ATHLON-ում",
            paragraphs: [
              "Մեր կատալոգում կան Optimum Nutrition Serious Mass՝ վանիլի և շոկոլադի համերով, և Trec Mass XXL Gainer։",
            ],
          },
        ],
      },
      ru: {
        title: "Гейнер: что это, кому нужен и как принимать",
        description:
          "Чем гейнер отличается от протеина, кому он помогает набрать вес, как его принимать и на что смотреть на этикетке.",
        introduction:
          "Гейнер — это смесь белка и углеводов, которая помогает получить больше калорий. Рассказываем, кому он нужен и как его использовать.",
        sections: [
          {
            heading: "Гейнер или протеин",
            paragraphs: [
              "Протеин — это в основном белок, а в гейнере кроме белка много углеводов, поэтому одна порция гораздо калорийнее. Если ваша цель — набрать вес, а получить достаточно калорий из обычной еды сложно, гейнер будет удобным решением.",
            ],
          },
          {
            heading: "Кому он нужен",
            paragraphs: [
              "Гейнер рассчитан на тех, кому трудно набирать вес. Он не для похудения, и если вы и так легко набираете вес, лучше выбрать протеин. Для набора веса важен общий избыток калорий, а не конкретная добавка.",
            ],
          },
          {
            heading: "Как принимать",
            paragraphs: [
              "Полная порция некоторых гейнеров может превышать 1000 ккал, поэтому сначала проверьте этикетку. Можно начать с половины порции или разделить дневную порцию на два приёма — например, после тренировки и между приёмами пищи. Следуйте инструкции на упаковке.",
            ],
          },
          {
            heading: "На что смотреть на этикетке",
            paragraphs: [
              "Калории, белки и углеводы в порции, количество сахара и число порций в упаковке. При диабете или других проблемах со здоровьем сначала проконсультируйтесь с врачом.",
            ],
          },
          {
            heading: "Гейнеры в ATHLON",
            paragraphs: [
              "В нашем каталоге есть Optimum Nutrition Serious Mass со вкусом ванили и шоколада и Trec Mass XXL Gainer.",
            ],
          },
        ],
      },
      en: {
        title: "Mass gainer: what it is, who needs it and how to take it",
        description:
          "How a mass gainer differs from protein, who it helps gain weight, how to take it and what to check on the label.",
        introduction:
          "A mass gainer combines protein and carbohydrates to help you get more calories. Here is who needs one and how to use it.",
        sections: [
          {
            heading: "Gainer or protein",
            paragraphs: [
              "Protein powder is mostly protein, while a gainer adds a lot of carbohydrates, so one serving has far more calories. If your goal is to gain weight and it's hard to eat enough calories from regular food, a gainer is a convenient option.",
            ],
          },
          {
            heading: "Who needs it",
            paragraphs: [
              "A gainer is meant for people who find it hard to gain weight. It isn't for weight loss, and if you already gain weight easily, protein is the better choice. What drives weight gain is an overall calorie surplus, not any particular supplement.",
            ],
          },
          {
            heading: "How to take it",
            paragraphs: [
              "A full serving of some gainers can exceed 1,000 kcal, so check the label first. You can start with half a serving or split the daily serving in two, for example after training and between meals. Follow the directions on the package.",
            ],
          },
          {
            heading: "What to check on the label",
            paragraphs: [
              "Calories, protein and carbohydrates per serving, the amount of sugar and the number of servings per pack. If you have diabetes or another health condition, talk to a doctor first.",
            ],
          },
          {
            heading: "Gainers at ATHLON",
            paragraphs: [
              "Our catalog includes Optimum Nutrition Serious Mass in vanilla and chocolate, and Trec Mass XXL Gainer.",
            ],
          },
        ],
      },
    },
  },
  "bcaa-amino-acids-guide": {
    copy: {
      hy: {
        title: "BCAA և ամինաթթուներ․ արդյոք պետք են և ինչպես ընդունել",
        description:
          "Ինչ են BCAA-ները, երբ են դրանք իմաստ ունենում, եթե արդեն պրոտեին եք ընդունում, և ինչին ուշադրություն դարձնել ամինաթթուային համալիրներում։",
        introduction:
          "BCAA-ները և ամինաթթուային համալիրները տարածված են մարզվողների շրջանում։ Պատմում ենք, թե երբ են դրանք օգտակար և երբ՝ ոչ։",
        sections: [
          {
            heading: "Ինչ են BCAA-ները",
            paragraphs: [
              "BCAA-ն երեք ամինաթթու է՝ լեյցին, իզոլեյցին և վալին։ Դրանք կան սպիտակուցով հարուստ ամեն սննդում՝ մսի, ձվի, կաթնամթերքի մեջ, ինչպես նաև շիճուկային պրոտեինում։",
            ],
          },
          {
            heading: "Պե՞տք են արդյոք, եթե պրոտեին եք ընդունում",
            paragraphs: [
              "Եթե օրվա ընթացքում բավարար սպիտակուց եք ստանում սննդից կամ պրոտեինից, առանձին BCAA-ների լրացուցիչ օգուտը սահմանափակ է։ Դրանք կարող են հարմար լինել երկար մարզումների ժամանակ, քաղցով մարզվելիս կամ պարզապես որպես համով ըմպելիք ջրի փոխարեն։",
            ],
          },
          {
            heading: "Ամինաթթուային համալիրներ կոֆեինով",
            paragraphs: [
              "Որոշ համալիրներ, օրինակ՝ Optimum Nutrition Amino Energy-ն, ամինաթթուներից բացի պարունակում են կոֆեին։ Ստուգեք պիտակը, հաշվի առեք օրվա ընթացքում ստացած ամբողջ կոֆեինը և մի ընդունեք երեկոյան ուշ։",
            ],
          },
          {
            heading: "Ինչպես ընդունել",
            paragraphs: [
              "Սովորաբար՝ մարզումից առաջ կամ մարզման ընթացքում՝ ջրի մեջ խառնված։ Հետևեք փաթեթի ցուցումներին, իսկ առողջական խնդիրների կամ հղիության դեպքում նախապես խորհրդակցեք բժշկի հետ։",
            ],
          },
          {
            heading: "ATHLON-ում",
            paragraphs: [
              "Մեր կատալոգում կան Optimum Nutrition Amino Energy՝ տարբեր համերով, և Trec BCAA High Speed։",
            ],
          },
        ],
      },
      ru: {
        title: "BCAA и аминокислоты: нужны ли и как принимать",
        description:
          "Что такое BCAA, когда они имеют смысл, если вы уже пьёте протеин, и на что обратить внимание в аминокислотных комплексах.",
        introduction:
          "BCAA и аминокислотные комплексы популярны среди тренирующихся. Рассказываем, когда они полезны, а когда нет.",
        sections: [
          {
            heading: "Что такое BCAA",
            paragraphs: [
              "BCAA — это три аминокислоты: лейцин, изолейцин и валин. Они есть во всех продуктах, богатых белком: мясе, яйцах, молочных продуктах, а также в сывороточном протеине.",
            ],
          },
          {
            heading: "Нужны ли они, если вы пьёте протеин",
            paragraphs: [
              "Если вы получаете достаточно белка из еды или протеина, дополнительная польза отдельных BCAA ограничена. Они могут быть удобны во время длинных тренировок, при тренировках натощак или просто как вкусный напиток вместо воды.",
            ],
          },
          {
            heading: "Аминокислотные комплексы с кофеином",
            paragraphs: [
              "Некоторые комплексы, например Optimum Nutrition Amino Energy, кроме аминокислот содержат кофеин. Проверьте этикетку, учитывайте весь кофеин за день и не принимайте поздно вечером.",
            ],
          },
          {
            heading: "Как принимать",
            paragraphs: [
              "Обычно перед тренировкой или во время неё, размешав в воде. Следуйте инструкции на упаковке, а при проблемах со здоровьем или беременности сначала проконсультируйтесь с врачом.",
            ],
          },
          {
            heading: "В ATHLON",
            paragraphs: [
              "В нашем каталоге есть Optimum Nutrition Amino Energy разных вкусов и Trec BCAA High Speed.",
            ],
          },
        ],
      },
      en: {
        title: "BCAA and amino acids: do you need them and how to take them",
        description:
          "What BCAAs are, when they make sense if you already take protein, and what to look for in amino acid blends.",
        introduction:
          "BCAAs and amino acid blends are popular with people who train. Here is when they help and when they don't.",
        sections: [
          {
            heading: "What BCAAs are",
            paragraphs: [
              "BCAAs are three amino acids: leucine, isoleucine and valine. They are present in all protein-rich food, such as meat, eggs and dairy, and in whey protein.",
            ],
          },
          {
            heading: "Do you need them if you take protein",
            paragraphs: [
              "If you get enough protein from food or protein powder, separate BCAAs add limited benefit. They can be handy during long sessions, when training on an empty stomach, or simply as a flavored drink instead of water.",
            ],
          },
          {
            heading: "Amino blends with caffeine",
            paragraphs: [
              "Some blends, such as Optimum Nutrition Amino Energy, contain caffeine as well as amino acids. Check the label, count all the caffeine you have in a day and avoid it late in the evening.",
            ],
          },
          {
            heading: "How to take them",
            paragraphs: [
              "Usually before or during training, mixed with water. Follow the directions on the package, and if you have a health condition or are pregnant, talk to a doctor first.",
            ],
          },
          {
            heading: "At ATHLON",
            paragraphs: [
              "Our catalog includes Optimum Nutrition Amino Energy in several flavors and Trec BCAA High Speed.",
            ],
          },
        ],
      },
    },
  },
  "l-carnitine-guide": {
    copy: {
      hy: {
        title: "L-կարնիտին․ ինչ է այն անում և ինչ չի անում",
        description:
          "Ինչ է L-կարնիտինը, արդյոք այն օգնում է նիհարել, ինչ ձևեր կան (հեղուկ, պատիճներ) և ինչպես ընդունել։",
        introduction:
          "L-կարնիտինը հաճախ գովազդվում է որպես «ճարպայրիչ»։ Պատմում ենք, թե իրականում ինչ կարելի է ակնկալել։",
        sections: [
          {
            heading: "Ինչ է L-կարնիտինը",
            paragraphs: [
              "L-կարնիտինը օրգանիզմում արտադրվող և մսի մեջ պարունակվող միացություն է, որը մասնակցում է ճարպաթթուները բջիջների «էներգետիկ կայաններ» տեղափոխելուն։",
            ],
          },
          {
            heading: "Արդյո՞ք այն օգնում է նիհարել",
            paragraphs: [
              "Առողջ մարդկանց մոտ L-կարնիտինի ազդեցությունը քաշի վրա, ըստ հետազոտությունների, փոքր է կամ բացակայում է։ Այն ինքնին ճարպ չի այրում․ քաշը նվազում է կալորիաների դեֆիցիտի, սննդակարգի և շարժման շնորհիվ։ Եթե որոշել եք օգտագործել, համարեք այն լրացում, ոչ թե լուծում։",
            ],
          },
          {
            heading: "Հեղուկ թե պատիճներ",
            paragraphs: [
              "Հեղուկ ձևը հարմար է ընդունել մարզումից առաջ, իսկ պատիճները՝ հեշտ է տեղափոխել։ Համեմատեք L-կարնիտինի քանակը մեկ չափաբաժնում և մեկ չափաբաժնի գինը։",
            ],
          },
          {
            heading: "Ինչպես ընդունել և ում խորհրդակցել բժշկի հետ",
            paragraphs: [
              "Հետևեք փաթեթի ցուցումներին և մի գերազանցեք նշված չափաբաժինը։ Վահանաձև գեղձի, երիկամների հիվանդությունների, դեղորայք ընդունելու կամ հղիության դեպքում նախապես խորհրդակցեք բժշկի հետ։",
            ],
          },
          {
            heading: "L-կարնիտին ATHLON-ում",
            paragraphs: [
              "Մեր կատալոգում կան Trec L-Carnitine 3000՝ հեղուկ ձևով, և Trec L-Carnitine Complex։",
            ],
          },
        ],
      },
      ru: {
        title: "L-карнитин: что он делает и чего не делает",
        description:
          "Что такое L-карнитин, помогает ли он похудеть, какие бывают формы (жидкий, капсулы) и как его принимать.",
        introduction:
          "L-карнитин часто рекламируют как «жиросжигатель». Рассказываем, чего от него можно ожидать на самом деле.",
        sections: [
          {
            heading: "Что такое L-карнитин",
            paragraphs: [
              "L-карнитин — вещество, которое вырабатывается в организме и содержится в мясе. Он участвует в переносе жирных кислот в «энергетические станции» клеток.",
            ],
          },
          {
            heading: "Помогает ли он похудеть",
            paragraphs: [
              "По данным исследований, у здоровых людей влияние L-карнитина на вес небольшое или отсутствует. Сам по себе он жир не сжигает: вес снижается за счёт дефицита калорий, питания и движения. Если вы решили его принимать, считайте его дополнением, а не решением.",
            ],
          },
          {
            heading: "Жидкий или капсулы",
            paragraphs: [
              "Жидкую форму удобно принимать перед тренировкой, а капсулы легко брать с собой. Сравнивайте количество L-карнитина в порции и цену порции.",
            ],
          },
          {
            heading: "Как принимать и кому нужен врач",
            paragraphs: [
              "Следуйте инструкции на упаковке и не превышайте указанную порцию. При заболеваниях щитовидной железы или почек, приёме лекарств или беременности сначала проконсультируйтесь с врачом.",
            ],
          },
          {
            heading: "L-карнитин в ATHLON",
            paragraphs: [
              "В нашем каталоге есть жидкий Trec L-Carnitine 3000 и Trec L-Carnitine Complex.",
            ],
          },
        ],
      },
      en: {
        title: "L-carnitine: what it does and doesn't do",
        description:
          "What L-carnitine is, whether it helps with weight loss, which forms exist (liquid, capsules) and how to take it.",
        introduction:
          "L-carnitine is often marketed as a fat burner. Here is what you can realistically expect from it.",
        sections: [
          {
            heading: "What L-carnitine is",
            paragraphs: [
              "L-carnitine is a compound your body makes and that is found in meat. It helps carry fatty acids into the cells' energy-producing mitochondria.",
            ],
          },
          {
            heading: "Does it help with weight loss",
            paragraphs: [
              "In healthy people, research shows a small effect on weight or none at all. It doesn't burn fat by itself: weight comes down through a calorie deficit, diet and activity. If you decide to take it, treat it as an extra, not the solution.",
            ],
          },
          {
            heading: "Liquid or capsules",
            paragraphs: [
              "The liquid form is easy to take before training, while capsules are easy to carry. Compare the amount of L-carnitine per serving and the price per serving.",
            ],
          },
          {
            heading: "How to take it and who should see a doctor",
            paragraphs: [
              "Follow the directions on the package and don't exceed the stated serving. If you have a thyroid or kidney condition, take medication or are pregnant, talk to a doctor first.",
            ],
          },
          {
            heading: "L-carnitine at ATHLON",
            paragraphs: [
              "Our catalog includes Trec L-Carnitine 3000 liquid and Trec L-Carnitine Complex.",
            ],
          },
        ],
      },
    },
  },
};

export const guides: Record<GuideSlug, GuideEntry> = {
  ...originalGuides,
  ...newGuides,
};
