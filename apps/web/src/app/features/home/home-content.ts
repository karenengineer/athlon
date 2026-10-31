import { Locale } from "../../core/i18n/i18n.service";

interface HomeContent {
  heading: string;
  introduction: string;
  catalogHeading: string;
  categories: readonly { slug: string; name: string; text: string }[];
  choosingHeading: string;
  choosing: readonly string[];
  deliveryHeading: string;
  delivery: string;
}

export const homeContent: Record<Locale, HomeContent> = {
  hy: {
    heading: "Սպորտային սնունդ Հայաստանում",
    introduction:
      "ATHLON-ը սպորտային սննդի առցանց խանութ է Հայաստանում։ Մեր կատալոգում կգտնեք սպիտակուց (պրոտեին), կրեատին, վիտամիններ, նախավարժանքային ապրանքներ և մարզման աքսեսուարներ։ Յուրաքանչյուր ապրանքի էջում ներկայացված են նկարագրությունը, գինը և առկայությունը, որպեսզի հեշտությամբ համեմատեք տարբերակները և ընտրեք ձեզ անհրաժեշտը։ Մեր բոլոր ապրանքները օրիգինալ են։",
    catalogHeading: "Ինչ կգտնեք կատալոգում",
    categories: [
      {
        slug: "protein",
        name: "Սպիտակուց",
        text: "սպիտակուցային հավելումներ՝ տարբեր համերով և փաթեթների չափերով։",
      },
      {
        slug: "creatine",
        name: "Կրեատին",
        text: "տարբեր ձևաչափերով ապրանքներ ուժային մարզումներով զբաղվողների համար։",
      },
      {
        slug: "pre-workout",
        name: "Նախավարժանքային ապրանքներ",
        text: "համալիրներ, որոնք օգտագործվում են մարզումից առաջ։",
      },
      {
        slug: "vitamins",
        name: "Վիտամիններ",
        text: "ամենօրյա սննդակարգը լրացնող ապրանքներ։",
      },
      {
        slug: "accessories",
        name: "Աքսեսուարներ",
        text: "մարզումների համար անհրաժեշտ պարագաներ։",
      },
    ],
    choosingHeading: "Ինչպես ընտրել ըստ նպատակի",
    choosing: [
      "Ընտրությունը սկսեք ձեր նպատակից և մարզումների ռեժիմից։ Եթե ցանկանում եք սննդակարգը լրացնել սպիտակուցով, սկսեք սպիտակուցի բաժնից։ Եթե կենտրոնացած եք ուժային մարզումների վրա, ծանոթացեք կրեատինի տարբերակներին։ Վիտամինները և մյուս հավելումները դիտարկեք որպես հավասարակշռված սննդակարգի լրացում, ոչ թե դրա փոխարինող։",
      "Գնելուց առաջ կարդացեք փաթեթի կազմը, չափաբաժինը և օգտագործման ցուցումները։ Համեմատեք նաև չափաբաժինների թիվը, քանի որ նույն գնով փաթեթները կարող են տարբեր քանակ պարունակել։ Առողջական խնդիրների դեպքում նախապես խորհրդակցեք բժշկի հետ։",
      "Եթե դժվարանում եք ընտրել, մեր ֆիթնես մարզիչը անվճար խորհրդատվություն կտրամադրի։",
    ],
    deliveryHeading: "Առաքում և կապ",
    delivery:
      "Ընտրեք ապրանքը, ավելացրեք այն զամբյուղում և լրացրեք պատվերի տվյալները։ Առաքումը ողջ Հայաստանում անվճար է, իսկ վճարումը կատարվում է առաքիչին՝ կանխիկ կամ քարտով։ Ապրանքների և պատվերների վերաբերյալ հարցերի դեպքում զանգահարեք 041 44 88 55 հեռախոսահամարով կամ գրեք athlonsportgoods@gmail.com հասցեին։",
  },
  ru: {
    heading: "Спортивное питание в Армении",
    introduction:
      "ATHLON — интернет-магазин спортивного питания в Армении. В нашем каталоге есть протеин, креатин, витамины, предтренировочные продукты и аксессуары для тренировок. На странице каждого товара указаны описание, цена и наличие, поэтому варианты легко сравнить и выбрать то, что вам нужно. Все наши товары оригинальные.",
    catalogHeading: "Что есть в каталоге",
    categories: [
      {
        slug: "protein",
        name: "Протеин",
        text: "белковые добавки разных вкусов и размеров упаковки.",
      },
      {
        slug: "creatine",
        name: "Креатин",
        text: "товары разных форматов для тех, кто занимается силовыми тренировками.",
      },
      {
        slug: "pre-workout",
        name: "Предтренировочные продукты",
        text: "комплексы, которые принимают перед тренировкой.",
      },
      {
        slug: "vitamins",
        name: "Витамины",
        text: "продукты, дополняющие ежедневный рацион.",
      },
      {
        slug: "accessories",
        name: "Аксессуары",
        text: "всё необходимое для тренировок.",
      },
    ],
    choosingHeading: "Как выбрать по своей цели",
    choosing: [
      "Начните со своей цели и режима тренировок. Если хотите дополнить рацион белком, начните с раздела протеина. Если вы сосредоточены на силовых тренировках, посмотрите варианты креатина. Витамины и другие добавки рассматривайте как дополнение к сбалансированному питанию, а не как его замену.",
      "Перед покупкой прочитайте на упаковке состав, размер порции и инструкцию по применению. Сравните и количество порций: упаковки по одной цене могут содержать разное количество продукта. При проблемах со здоровьем сначала проконсультируйтесь с врачом.",
      "Если сложно выбрать, наш фитнес-тренер бесплатно вас проконсультирует.",
    ],
    deliveryHeading: "Доставка и контакты",
    delivery:
      "Выберите товар, добавьте его в корзину и заполните данные заказа. Доставка по всей Армении бесплатна, а оплатить заказ можно курьеру наличными или картой. По вопросам о товарах и заказах звоните по номеру 041 44 88 55 или пишите на athlonsportgoods@gmail.com.",
  },
  en: {
    heading: "Sports nutrition in Armenia",
    introduction:
      "ATHLON is an online sports nutrition shop in Armenia. Our catalog includes protein, creatine, vitamins, pre-workout products and training accessories. Each product page shows the description, price and availability, so you can compare the options and choose what you need. All our products are original.",
    catalogHeading: "What you will find in the catalog",
    categories: [
      {
        slug: "protein",
        name: "Protein",
        text: "protein supplements in a range of flavors and package sizes.",
      },
      {
        slug: "creatine",
        name: "Creatine",
        text: "products in different formats for people who do strength training.",
      },
      {
        slug: "pre-workout",
        name: "Pre-workout products",
        text: "formulas taken before a training session.",
      },
      {
        slug: "vitamins",
        name: "Vitamins",
        text: "products that complement your daily diet.",
      },
      {
        slug: "accessories",
        name: "Accessories",
        text: "gear for your training.",
      },
    ],
    choosingHeading: "How to choose for your goal",
    choosing: [
      "Start with your goal and your training routine. If you want to add protein to your diet, begin with the protein section. If you focus on strength training, look at the creatine options. Treat vitamins and other supplements as an addition to a balanced diet, not a replacement for it.",
      "Before you buy, read the ingredients, serving size and directions on the package. Compare the number of servings too, because packages at the same price can contain different amounts. If you have a health condition, talk to a doctor first.",
      "If you're not sure what to choose, our fitness coach offers free advice.",
    ],
    deliveryHeading: "Delivery and contact",
    delivery:
      "Choose a product, add it to your basket and fill in your order details. Delivery is free throughout Armenia, and you pay the courier by cash or card. For questions about products and orders, call 041 44 88 55 or email athlonsportgoods@gmail.com.",
  },
};
