import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";

// Use the web project's existing parser; no scripts or remote resources execute.
const { JSDOM } = createRequire(resolve("apps/web/package.json"))("jsdom");

const locales = ["hy", "ru", "en"];
const seoCopy = {
  hy: {
    homeTitle: "Սպորտային սնունդ Հայաստանում | ATHLON",
    homeDescription:
      "Սպորտային սննդի առցանց խանութ Հայաստանում․ պրոտեին, կրեատին և ամինաթթուներ։ Անվճար առաքում ողջ Հայաստանում։",
    armenia: "Հայաստան",
    delivery: "Անվճար առաքում ողջ Հայաստանում։",
    page: "Էջ",
    productDescription:
      "Ապրանքի տվյալները, գինը և առկայությունը ATHLON սպորտային սննդի առցանց խանութում Հայաստանում։",
  },
  ru: {
    homeTitle: "Спортивное питание в Армении | ATHLON",
    homeDescription:
      "Интернет-магазин спортивного питания в Армении: протеин, креатин и аминокислоты. Бесплатная доставка по всей Армении.",
    armenia: "Армения",
    delivery: "Бесплатная доставка по всей Армении.",
    page: "Страница",
    productDescription:
      "Информация о товаре, цене и наличии в интернет-магазине спортивного питания ATHLON в Армении.",
  },
  en: {
    homeTitle: "Sports nutrition in Armenia | ATHLON",
    homeDescription:
      "Online sports-nutrition shop in Armenia: protein, creatine and amino acids. Free delivery throughout Armenia.",
    armenia: "Armenia",
    delivery: "Free delivery throughout Armenia.",
    page: "Page",
    productDescription:
      "Product details, price and availability at ATHLON, an online sports-nutrition shop in Armenia.",
  },
};
const categoryCopy = {
  hy: {
    root: "Տեղական SSR սպորտային սնունդ",
    child: "Տեղական SSR սպիտակուցներ",
    accessories: "Տեղական SSR աքսեսուարներ",
    rootDescription:
      "Տեղական կատեգորիայի նկարագրություն՝ փաթեթների համեմատության համար։",
    childDescription:
      "Տեղական սպիտակուցների նկարագրություն՝ <b>SSR</b> տեքստով։",
    fallback:
      "Դիտեք աքսեսուարները և համեմատեք ապրանքների ներկայացված չափերն ու ձևաչափերը։",
    guidance:
      "Համեմատեք նշված գինն ու փաթեթի տեղեկությունները։ Ուշադրություն դարձրեք փաթեթի չափին, համին և ձևաչափին, եթե դրանք նշված են ապրանքի էջում։",
    announcement: "ԱՆՎՃԱՐ ԱՌԱՔՈՒՄ ՈՂՋ ՀԱՅԱՍՏԱՆՈՒՄ · 041 44 88 55",
    catalogTitle: "Կատալոգ | ATHLON",
    catalogDescription:
      "Դիտեք ATHLON-ի սպորտային սննդի և աքսեսուարների առցանց կատալոգը Հայաստանում։",
    searchTitle: "Որոնման արդյունքներ: “fixture” | ATHLON",
    searchDescription:
      "Որոնեք ATHLON-ի կատալոգում և համեմատեք ապրանքների տվյալներն ու նշված գները։",
  },
  ru: {
    root: "Локальное SSR спортивное питание",
    child: "Локальный SSR протеин",
    accessories: "Локальные SSR аксессуары",
    rootDescription: "Локальное описание категории для сравнения упаковок.",
    childDescription: "Локальное описание протеина с текстом <b>SSR</b>.",
    fallback:
      "Посмотрите аксессуары и сравните указанные размеры и форматы товаров.",
    guidance:
      "Сравните указанную цену и сведения на упаковке. Обратите внимание на размер упаковки, вкус и формат, если они указаны на странице товара.",
    announcement: "БЕСПЛАТНАЯ ДОСТАВКА ПО ВСЕЙ АРМЕНИИ · 041 44 88 55",
    catalogTitle: "Каталог | ATHLON",
    catalogDescription:
      "Посмотрите онлайн-каталог спортивного питания и аксессуаров ATHLON в Армении.",
    searchTitle: "Результаты поиска: “fixture” | ATHLON",
    searchDescription:
      "Ищите в каталоге ATHLON и сравнивайте сведения о товарах и указанные цены.",
  },
  en: {
    root: "Local SSR sports nutrition",
    child: "Local SSR protein category",
    accessories: "Local SSR accessories",
    rootDescription: "Local category description for comparing packages.",
    childDescription: "Local protein description with <b>SSR</b> text.",
    fallback:
      "Browse accessories and compare the listed product sizes and formats.",
    guidance:
      "Compare the listed price and package information. Check package size, flavor and format where these are shown on the product page.",
    announcement: "FREE DELIVERY THROUGHOUT ARMENIA · 041 44 88 55",
    catalogTitle: "Catalog | ATHLON",
    catalogDescription:
      "Browse ATHLON's online sports nutrition and accessories catalog in Armenia.",
    searchTitle: "Search results: “fixture” | ATHLON",
    searchDescription:
      "Search the ATHLON catalog and compare product information and listed prices.",
  },
};

// Expectations are literal, reviewed business copy, independent of app helpers.
const informationCopy = {
  hy: {
    about: [
      "ATHLON-ի մասին",
      "Սպորտային սննդի առցանց խանութ Հայաստանում։ Ծանոթացեք ATHLON-ի կատալոգին և կապվեք մեզ հետ ապրանքների ու պատվերների հարցերով։",
      "ATHLON-ը սպորտային սննդի առցանց խանութ է, որը սպասարկում է հաճախորդներին Հայաստանում։",
      "Ընտրեք կատալոգից",
    ],
    contact: [
      "Կապ",
      "Կապվեք ATHLON-ի հետ՝ 041 44 88 55 հեռախոսահամարով կամ athlonsportgoods@gmail.com հասցեով՝ ապրանքների և պատվերների հարցերով։",
      "Ապրանքի, պատվերի, առաքման կամ վերադարձի վերաբերյալ հարցերի դեպքում զանգահարեք կամ գրեք մեզ։",
      "Հեռախոս և էլեկտրոնային փոստ",
    ],
    delivery: [
      "Առաքում և վճարում",
      "Անվճար առաքում ողջ Հայաստանում՝ անկախ պատվերի գումարից։ Վճարեք կանխիկ կամ քարտով՝ առաքիչին, պատվերը ստանալիս։",
      "Անվճար առաքում ողջ Հայաստանում՝ անկախ պատվերի գումարից։",
      "կանխիկ կամ քարտով՝ առաքիչին",
    ],
    returns: [
      "Վերադարձ և փոխանակում",
      "Վերադարձի կամ փոխանակման հարցերով կապվեք ATHLON-ի հետ։ Նշեք պատվերի համարը և ձեր հարցը։",
      "Վերադարձի կամ փոխանակման հարցով օգնության համար կապվեք մեզ հետ։",
      "Նշեք պատվերի համարը և ձեր հարցը։ Մենք կօգնենք պարզել ձեր պատվերի հետ կապված հետագա քայլերը։",
    ],
  },
  ru: {
    about: [
      "Об ATHLON",
      "Интернет-магазин спортивного питания в Армении. Посмотрите каталог ATHLON и свяжитесь с нами по вопросам товаров и заказов.",
      "ATHLON — интернет-магазин спортивного питания, который обслуживает покупателей в Армении.",
      "Выбирайте в каталоге",
    ],
    contact: [
      "Контакты",
      "Свяжитесь с ATHLON по телефону 041 44 88 55 или почте athlonsportgoods@gmail.com по вопросам товаров и заказов.",
      "Позвоните или напишите нам, если у вас есть вопрос о товаре, заказе, доставке или возврате.",
      "Телефон и электронная почта",
    ],
    delivery: [
      "Доставка и оплата",
      "Бесплатная доставка по всей Армении независимо от суммы заказа. Оплата наличными или картой курьеру при получении.",
      "Бесплатная доставка по всей Армении независимо от суммы заказа.",
      "наличными или картой курьеру",
    ],
    returns: [
      "Возврат и обмен",
      "Помощь по вопросам возврата и обмена в ATHLON. Свяжитесь с нами, укажите номер заказа и ваш вопрос.",
      "Свяжитесь с нами, если вам нужна помощь по вопросу возврата или обмена.",
      "Укажите номер заказа и ваш вопрос. Мы поможем разобраться с дальнейшими действиями по вашему заказу.",
    ],
  },
  en: {
    about: [
      "About ATHLON",
      "Online sports-nutrition shop in Armenia. Explore the ATHLON catalog and contact us with product and order questions.",
      "ATHLON is an online sports-nutrition shop serving customers in Armenia.",
      "Choose from the catalog",
    ],
    contact: [
      "Contact",
      "Contact ATHLON at 041 44 88 55 or athlonsportgoods@gmail.com with product and order questions.",
      "Call or email us with questions about products, orders, delivery, or returns.",
      "Phone and email",
    ],
    delivery: [
      "Delivery and payment",
      "Free delivery throughout Armenia, regardless of order value. Pay with cash or card to the courier on delivery.",
      "Free delivery throughout Armenia, regardless of order value.",
      "cash or card to the courier",
    ],
    returns: [
      "Returns and exchanges",
      "Help with return and exchange questions at ATHLON. Contact us with your order reference and question.",
      "Contact us if you need help with a return or exchange question.",
      "Include your order reference and question. We will help you work out the next steps for your order.",
    ],
  },
};

// Test the built production manifest and actual Node handler, not an allowed-host
// QA override or a 200 response that could be Angular's CSR fallback.
async function main() {
  delete process.env.NG_ALLOWED_HOSTS;
  delete process.env.NG_TRUST_PROXY_HEADERS;
  const names = {
    hy: "Տեղական SSR սպիտակուց",
    ru: "Локальный SSR протеин",
    en: "Local SSR protein",
  };
  const calls = [];
  const categories = (locale) => {
    const copy = categoryCopy[locale];
    return [
      {
        id: "ssr-root",
        code: "SSR_ROOT",
        slug: "sports-nutrition",
        name: copy.root,
        description: `  ${copy.rootDescription}  `,
        displayOrder: 0,
        children: [
          {
            id: "ssr-child",
            code: "SSR_CHILD",
            slug: "protein",
            name: copy.child,
            description: copy.childDescription,
            displayOrder: 0,
          },
        ],
      },
      {
        id: "ssr-accessories",
        code: "SSR_ACCESSORIES",
        slug: "accessories",
        name: copy.accessories,
        description: "  ",
        displayOrder: 1,
        children: [],
      },
    ];
  };
  const product = (locale) => ({
    id: "24d3f1a3-8413-4bc6-b32d-437871a22b54",
    sku: "SSR-FIXTURE",
    slug: "ssr-fixture",
    name: names[locale],
    shortDescription: null,
    description: null,
    price: "15000",
    currency: "AMD",
    availability: "IN_STOCK",
    featured: true,
    isNew: false,
    characteristics: {},
    category: { slug: "sports-nutrition", name: "SSR category" },
    brand: null,
    images: [],
  });
  const api = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    calls.push({
      method: req.method,
      path: url.pathname,
      locale: url.searchParams.get("locale"),
    });
    if (req.method !== "GET") {
      res.writeHead(405, { allow: "GET" });
      res.end();
      return;
    }
    const locale = url.searchParams.get("locale") ?? "hy";
    if (!locales.includes(locale)) {
      res.writeHead(400);
      res.end();
      return;
    }
    let body;
    if (url.pathname === "/api/v1/public/seo/sitemap")
      body = {
        productSlugs: ["ssr-fixture", "ssr-fixture", 'encoded<&"'],
        categorySlugs: ["sports-nutrition", "protein", "accessories"],
      };
    else if (url.pathname === "/api/v1/products/ssr-fixture")
      body = product(locale);
    else if (url.pathname === "/api/v1/products/ssr-outage") {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Synthetic product failure" }));
      return;
    } else if (url.pathname === "/api/v1/products") {
      if (url.searchParams.get("brand") === "fixture-error") {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "Synthetic catalog failure" }));
        return;
      }
      const empty = url.searchParams.get("brand") === "fixture-empty";
      const page = Number(url.searchParams.get("page") ?? 1);
      body = {
        items:
          empty || page > 2
            ? []
            : Array.from({ length: page === 2 ? 1 : 24 }, () =>
                product(locale),
              ),
        meta: {
          page,
          pageSize: 24,
          total: empty ? 0 : 25,
          totalPages: empty ? 0 : 2,
        },
      };
    } else if (url.pathname === "/api/v1/categories") body = categories(locale);
    else if (url.pathname === "/api/v1/brands") body = [];
    else if (url.pathname === "/api/v1/public/settings")
      body = { cardPaymentsEnabled: false };
    else {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  const listen = (server) =>
    new Promise((done) => server.listen(0, "127.0.0.1", done));
  const close = (server) =>
    new Promise((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  await listen(api);
  process.env.SSR_API_BASE_URL = `http://127.0.0.1:${api.address().port}/api/v1`;
  let web;
  try {
    const { reqHandler } = await import(
      pathToFileURL(resolve("apps/web/dist/web/server/server.mjs"))
    );
    web = createServer((req, res) =>
      reqHandler(req, res, (error) => {
        res.writeHead(error ? 500 : 404);
        res.end(String(error ?? "Not found"));
      }),
    );
    await listen(web);
    const get = (path, headers = {}) =>
      new Promise((done, reject) => {
        const req = request(
          { hostname: "127.0.0.1", port: web.address().port, path, headers },
          (res) => {
            let html = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => (html += chunk));
            res.on("end", () =>
              done({ status: res.statusCode, headers: res.headers, html }),
            );
          },
        );
        req.on("error", reject);
        req.setTimeout(8000, () =>
          req.destroy(new Error("SSR request timeout")),
        );
        req.end();
      });
    const forwarded = (host) => ({
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": "https",
      "x-forwarded-for": "192.0.2.42",
    });
    const visible = (html) =>
      html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    const text = (element) => element?.textContent.trim();
    const metadata = (document, title, description) => {
      assert.equal(document.title, title);
      const descriptions = document.querySelectorAll(
        'meta[name="description"]',
      );
      assert.equal(descriptions.length, 1, "exactly one page description");
      assert.equal(descriptions[0].getAttribute("content"), description);
    };
    const footer = (document, locale) => {
      assert.deepEqual(
        [...document.querySelectorAll("footer .footer-information a")].map(
          (link) => [link.getAttribute("href"), text(link)],
        ),
        Object.entries(informationCopy[locale]).map(([page, [heading]]) => [
          `/${locale}/${page}`,
          heading,
        ]),
        `localized footer links: ${locale}`,
      );
      assert.equal(document.querySelector("app-header .announcement"), null);
    };
    const initialDocument = (response, selector, check, status = 200) => {
      assert.equal(response.status, status);
      assert.match(response.html, /ng-server-context="ssr"/);
      const { window } = new JSDOM(response.html);
      try {
        assert.ok(
          window.document.querySelector(selector),
          `initial HTML: ${selector}`,
        );
        check(window.document);
      } finally {
        window.close();
      }
    };
    const structuredData = (document) =>
      [
        ...document.querySelectorAll(
          'script[type="application/ld+json"][data-athlon-seo]',
        ),
      ].map((script) => JSON.parse(script.textContent));
    const discovery = (document, path, indexable = true) => {
      const canonical = document.querySelectorAll('link[rel="canonical"]');
      assert.equal(canonical.length, 1, `one canonical: ${path}`);
      assert.equal(
        canonical[0].getAttribute("href"),
        `https://athlon.am${path}`,
      );
      const alternates = [
        ...document.querySelectorAll('link[rel="alternate"][hreflang]'),
      ].map((link) => [
        link.getAttribute("hreflang"),
        link.getAttribute("href"),
      ]);
      assert.deepEqual(
        alternates,
        indexable
          ? locales.map((locale) => [
              locale,
              `https://athlon.am${path.replace(/^\/(hy|ru|en)/, `/${locale}`)}`,
            ])
          : [],
      );
      assert.equal(
        document
          .querySelector('meta[property="og:url"]')
          ?.getAttribute("content"),
        `https://athlon.am${path}`,
      );
      assert.match(
        document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute("content") ?? "",
        /^https:\/\//,
      );
      assert.equal(
        document
          .querySelector('meta[name="robots"]')
          ?.getAttribute("content") ?? null,
        indexable ? null : "noindex, follow",
      );
      if (!indexable) assert.deepEqual(structuredData(document), []);
    };
    const failedMetadata = (document) => {
      assert.equal(
        document.querySelector('meta[name="robots"]')?.getAttribute("content"),
        "noindex, follow",
      );
      assert.equal(
        document.querySelector(
          'link[rel="canonical"], link[rel="alternate"], meta[property^="og:"]',
        ),
        null,
      );
      assert.deepEqual(structuredData(document), []);
    };
    // Direct HTTP crawler responses bypass locale redirects, while retaining
    // equivalent production host/protocol/prefix validation before Angular.
    for (const path of ["/robots.txt", "/sitemap.xml"]) {
      const response = await get(path, forwarded("athlon.am"));
      assert.equal(response.status, 200);
      assert.equal(response.headers.location, undefined);
      assert.doesNotMatch(response.html, /<app-root|ng-server-context/);
      if (path === "/robots.txt") {
        assert.match(response.headers["content-type"], /text\/plain/);
        assert.match(
          response.html,
          /Sitemap: https:\/\/athlon.am\/sitemap.xml/,
        );
        assert.doesNotMatch(response.html, /Disallow:.*[?*]/);
      } else {
        assert.match(response.headers["content-type"], /application\/xml/);
        const xml = new JSDOM(response.html, {
          contentType: "application/xml",
        });
        const urls = [...xml.window.document.querySelectorAll("loc")].map(
          (node) => node.textContent,
        );
        assert.deepEqual(urls, [...new Set(urls)].sort());
        for (const locale of locales)
          for (const suffix of [
            "",
            "/catalog",
            "/about",
            "/contact",
            "/delivery",
            "/returns",
            "/catalog/protein",
            "/product/ssr-fixture",
            "/product/encoded%3C%26%22",
          ])
            assert.ok(urls.includes(`https://athlon.am/${locale}${suffix}`));
        assert.doesNotMatch(
          response.html,
          /lastmod|basket|search|admin|card-payment/,
        );
        xml.window.close();
      }
      for (const headers of [
        { host: "unknown.example" },
        { host: "localhost" },
        { ...forwarded("athlon.am"), "x-forwarded-host": "evil.example" },
        { ...forwarded("athlon.am"), host: "evil.example" },
        { ...forwarded("athlon.am"), "x-forwarded-proto": "ftp" },
        { ...forwarded("athlon.am"), "x-forwarded-prefix": "/injected" },
        { ...forwarded("athlon.am"), "x-forwarded-port": "443" },
      ]) {
        const before = calls.length;
        assert.equal((await get(path, headers)).status, 400);
        assert.equal(calls.length, before);
      }
    }
    for (const host of ["athlon.am"]) {
      for (const locale of ["hy", "ru", "en"]) {
        const before = calls.length;
        const response = await get(
          `/${locale}/product/ssr-fixture`,
          forwarded(host),
        );
        assert.equal(response.status, 200, `${host}/${locale}`);
        assert.match(response.html, /ng-server-context="ssr"/);
        assert.match(visible(response.html), /<app-product-page\b/);
        assert.ok(
          visible(response.html).includes(names[locale]),
          `visible localized product: ${host}/${locale}`,
        );
        // Preserve scripts when parsing inert JSON-LD; JSDOM never executes them.
        const parsed = new JSDOM(response.html);
        try {
          metadata(
            parsed.window.document,
            `${names[locale]} — ${seoCopy[locale].armenia} | ATHLON`,
            seoCopy[locale].productDescription,
          );
          discovery(parsed.window.document, `/${locale}/product/ssr-fixture`);
          const schema = structuredData(parsed.window.document);
          const item = schema.find((entry) => entry["@type"] === "Product");
          assert.equal(item.name, names[locale]);
          assert.equal(item.sku, "SSR-FIXTURE");
          assert.equal(item.offers.priceCurrency, "AMD");
          assert.equal(item.offers.price, "15000");
          assert.equal(item.offers.availability, "https://schema.org/InStock");
          assert.ok(
            schema.some((entry) => entry["@type"] === "BreadcrumbList"),
          );
          assert.equal(item.aggregateRating, undefined);
        } finally {
          parsed.window.close();
        }
        assert.ok(
          calls
            .slice(before)
            .some(
              (call) =>
                call.path === "/api/v1/products/ssr-fixture" &&
                call.locale === locale,
            ),
        );
        console.log(
          `PASS ${host}/${locale}: actual localized product SSR with Caddy host/proto/for`,
        );
      }
      for (const locale of locales) {
        const copy = categoryCopy[locale];
        const categories = [
          ["sports-nutrition", copy.root, copy.rootDescription],
          ["protein", copy.child, copy.childDescription],
          ["accessories", copy.accessories, copy.fallback],
        ];
        for (const [slug, name, description] of categories) {
          const before = calls.length;
          const response = await get(
            `/${locale}/catalog/${slug}`,
            forwarded(host),
          );
          initialDocument(response, "app-catalog-page", (document) => {
            assert.deepEqual(
              [...document.querySelectorAll(".category-navigation a")].map(
                (link) => [link.getAttribute("href"), text(link)],
              ),
              categories.map(([categorySlug, categoryName]) => [
                `/${locale}/catalog/${categorySlug}`,
                categoryName,
              ]),
              "navigation contains only API-published roots and children",
            );
            const introduction = document.querySelector(
              ".category-content .category-introduction",
            );
            assert.equal(text(introduction), description);
            assert.equal(
              introduction.children.length,
              0,
              "API markup stays plain text",
            );
            assert.equal(
              text(document.querySelector(".category-guidance")),
              copy.guidance,
            );
            assert.deepEqual(
              [...document.querySelectorAll(".related-categories a")].map(
                (link) => link.getAttribute("href"),
              ),
              categories
                .filter(([categorySlug]) => categorySlug !== slug)
                .map(([categorySlug]) => `/${locale}/catalog/${categorySlug}`),
            );
            assert.equal(
              document
                .querySelector('.category-navigation a[aria-current="page"]')
                ?.getAttribute("href"),
              `/${locale}/catalog/${slug}`,
            );
            metadata(
              document,
              `${name} — ${seoCopy[locale].armenia} | ATHLON`,
              `${description} ${seoCopy[locale].delivery}`,
            );
            discovery(document, `/${locale}/catalog/${slug}`);
            assert.ok(
              structuredData(document).some(
                (entry) => entry["@type"] === "BreadcrumbList",
              ),
            );
            footer(document, locale);
          });
          assert.ok(
            calls
              .slice(before)
              .some(
                (call) =>
                  call.path === "/api/v1/categories" && call.locale === locale,
              ),
          );
        }
        console.log(
          `PASS ${host}/${locale}: category roots/child anchors, API/fallback text, guidance, related links and metadata in initial SSR HTML`,
        );

        const empty = await get(
          `/${locale}/catalog/protein?brand=fixture-empty`,
          forwarded(host),
        );
        initialDocument(empty, "app-catalog-page", (document) => {
          assert.equal(document.querySelectorAll("app-product-card").length, 0);
          assert.equal(
            text(document.querySelector(".category-introduction")),
            copy.childDescription,
          );
          metadata(
            document,
            `${copy.child} — ${seoCopy[locale].armenia} | ATHLON`,
            `${copy.childDescription} ${seoCopy[locale].delivery}`,
          );
          discovery(
            document,
            `/${locale}/catalog/protein?brand=fixture-empty`,
            false,
          );
        });
        for (const [path, title, description, status] of [
          [
            `/${locale}/catalog/unpublished-fixture`,
            copy.catalogTitle.replace(
              " | ATHLON",
              ` — ${seoCopy[locale].armenia} | ATHLON`,
            ),
            `${copy.catalogDescription} ${seoCopy[locale].delivery}`,
            404,
          ],
          [
            `/${locale}/catalog/protein?brand=fixture-error`,
            copy.catalogTitle.replace(
              " | ATHLON",
              ` — ${seoCopy[locale].armenia} | ATHLON`,
            ),
            `${copy.catalogDescription} ${seoCopy[locale].delivery}`,
            503,
          ],
          [
            `/${locale}/catalog/protein?q=fixture`,
            copy.searchTitle,
            copy.searchDescription,
            200,
          ],
          [
            `/${locale}/search?q=fixture`,
            copy.searchTitle,
            copy.searchDescription,
            200,
          ],
        ]) {
          const response = await get(path, forwarded(host));
          initialDocument(
            response,
            "app-catalog-page",
            (document) => {
              assert.equal(
                document.querySelector(".category-content"),
                null,
                `no unrelated guidance: ${path}`,
              );
              metadata(document, title, description);
              if (status !== 200) failedMetadata(document);
              else discovery(document, path, false);
            },
            status,
          );
        }
        console.log(
          `PASS ${host}/${locale}: empty category retains relevant content; unknown/error/search have no unrelated guidance or metadata`,
        );

        const pageTwo = await get(
          `/${locale}/catalog/protein?page=2`,
          forwarded(host),
        );
        initialDocument(pageTwo, "app-catalog-page", (document) => {
          discovery(document, `/${locale}/catalog/protein?page=2`);
          assert.equal(
            document.title,
            `${copy.child} — ${seoCopy[locale].armenia} — ${seoCopy[locale].page} 2 | ATHLON`,
          );
          assert.equal(document.querySelectorAll("app-product-card").length, 1);
          assert.ok(
            document.querySelector(
              `.pagination a[href="/${locale}/catalog/protein"]`,
            ),
            "real previous-page anchor",
          );
          assert.ok(
            document.querySelector('.pagination [aria-current="page"]'),
            "current page context",
          );
        });
        const pageOne = await get(
          `/${locale}/catalog/protein?page=1&utm_source=fixture`,
          forwarded(host),
        );
        initialDocument(pageOne, "app-catalog-page", (document) => {
          discovery(document, `/${locale}/catalog/protein`);
          const href = document.querySelector('.pagination a[rel="next"]')?.getAttribute("href");
          assert.ok(href, "real next-page anchor");
          const next = new URL(href, "https://athlon.am");
          assert.equal(next.pathname, `/${locale}/catalog/protein`);
          assert.equal(next.searchParams.get("page"), "2");
          assert.equal(next.searchParams.get("utm_source"), "fixture", "next-page anchor preserves query");
        });
        const filtered = await get(
          `/${locale}/catalog/protein?brand=fixture&page=2`,
          forwarded(host),
        );
        initialDocument(filtered, "app-catalog-page", (document) => {
          discovery(
            document,
            `/${locale}/catalog/protein?brand=fixture&page=2`,
            false,
          );
          assert.ok(
            document.querySelector(
              `.pagination a[href="/${locale}/catalog/protein?brand=fixture"]`,
            ),
            "previous-page anchor preserves filter",
          );
        });
        for (const page of ["0", "999", "bad"]) {
          initialDocument(
            await get(
              `/${locale}/catalog/protein?page=${page}`,
              forwarded(host),
            ),
            "app-catalog-page",
            (document) =>
              discovery(
                document,
                `/${locale}/catalog/protein?page=${page}`,
                false,
              ),
          );
        }
        for (const [path, status, selector] of [
          [`/${locale}/product/missing-fixture`, 404, "app-product-page"],
          [`/${locale}/product/ssr-outage`, 503, "app-product-page"],
          [`/${locale}/unknown-fixture`, 404, "app-not-found-page"],
        ]) {
          initialDocument(
            await get(path, forwarded(host)),
            selector,
            failedMetadata,
            status,
          );
        }
        console.log(
          `PASS ${host}/${locale}: self-canonical page2 with real filtered anchors, page1 normalization, invalid pagination noindex, true404 and upstream503`,
        );

        for (const [
          page,
          [heading, description, introduction, section],
        ] of Object.entries(informationCopy[locale])) {
          const response = await get(`/${locale}/${page}`, forwarded(host));
          initialDocument(
            response,
            "app-information-page article.information-page",
            (document) => {
              const article = document.querySelector("app-information-page");
              assert.equal(article.querySelectorAll("h1").length, 1);
              assert.equal(text(article.querySelector("h1")), heading);
              assert.equal(
                text(article.querySelector(".information-introduction")),
                introduction,
              );
              assert.ok(
                text(article.querySelector(".information-section"))?.includes(
                  section,
                ),
              );
              assert.ok(
                article.querySelector(
                  `.information-actions a[href="/${locale}/catalog"]`,
                ),
              );
              if (page !== "contact")
                assert.ok(
                  article.querySelector(
                    `.information-actions a[href="/${locale}/contact"]`,
                  ),
                );
              if (page === "contact") {
                assert.equal(
                  text(
                    article.querySelector(
                      '.information-contacts a[href="tel:+37441448855"]',
                    ),
                  ),
                  "041 44 88 55",
                );
                assert.equal(
                  text(
                    article.querySelector(
                      '.information-contacts a[href="mailto:athlonsportgoods@gmail.com"]',
                    ),
                  ),
                  "athlonsportgoods@gmail.com",
                );
              }
              if (page === "returns") {
                const sections = article.querySelectorAll(
                  ".information-section",
                );
                assert.equal(
                  sections.length,
                  1,
                  "contact assistance only, without invented policy sections",
                );
                assert.equal(
                  text(sections[0].querySelector("p")),
                  section,
                  "returns assistance adds no deadline, fee or restrictions",
                );
              }
              metadata(document, `${heading} | ATHLON`, description);
              discovery(document, `/${locale}/${page}`);
              if (page === "about")
                assert.equal(
                  structuredData(document).find(
                    (entry) => entry["@type"] === "OnlineStore",
                  )?.email,
                  "athlonsportgoods@gmail.com",
                );
              footer(document, locale);
            },
          );
        }
        console.log(
          `PASS ${host}/${locale}: all four information routes, localized title/description, contact links, delivery/returns facts and footer in initial SSR HTML`,
        );

        const home = await get(`/${locale}`, forwarded(host));
        initialDocument(home, "app-home-page", (document) => {
          assert.equal(document.querySelectorAll("app-home-page h1").length, 1);
          const heading = document.querySelector(".hero-copy h1");
          assert.equal(heading?.nextElementSibling?.tagName, "H2");
          assert.ok(
            heading.nextElementSibling.classList.contains("hero-delivery"),
          );
          assert.equal(text(heading.nextElementSibling), copy.announcement);
          assert.equal(
            heading.nextElementSibling.nextElementSibling?.tagName,
            "P",
          );
          footer(document, locale);
          metadata(
            document,
            seoCopy[locale].homeTitle,
            seoCopy[locale].homeDescription,
          );
          discovery(document, `/${locale}`);
          const store = structuredData(document).find(
            (entry) => entry["@type"] === "OnlineStore",
          );
          assert.equal(store.telephone, "+37441448855");
          assert.equal(store.areaServed.name, "Armenia");
          assert.equal(store.address, undefined);
          assert.equal(store.aggregateRating, undefined);
        });
        console.log(
          `PASS ${host}/${locale}: home H1 immediately followed by localized delivery H2/phone; no global announcement`,
        );
      }
      for (const [path, target] of [
        ["/", "/hy"],
        ["/de/catalog", "/hy/catalog"],
      ]) {
        const response = await get(path, forwarded(host));
        assert.equal(response.status, 302, `preserved redirect: ${path}`);
        assert.equal(
          new URL(response.headers.location, `https://${host}`).pathname,
          target,
        );
      }
      for (const path of [
        "/admin/login",
        "/admin/categories/example/edit",
        "/admin/brands/example/edit",
        "/admin/products/example/edit",
      ]) {
        const before = calls.length;
        const response = await get(path, {
          ...forwarded(host),
          cookie: "athlon_access=private-SSR-test-only",
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
        assert.doesNotMatch(
          response.html,
          /ng-server-context="ssr"|SSR-FIXTURE|private-SSR-test-only|app-admin-shell/,
        );
        assert.equal(
          calls.length,
          before,
          `${path} must make zero public/private API calls`,
        );
      }
      for (const locale of locales) {
        for (const suffix of [
          "",
          "/payment/ssr-test-only",
          "/success/ssr-test-only",
        ]) {
          const before = calls.length;
          const path = `/card-payment-test/${locale}${suffix}`;
          const response = await get(path, forwarded(host));
          assert.equal(response.status, 200);
          assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
          assert.doesNotMatch(
            response.html,
            /ng-server-context="ssr"|SSR-FIXTURE|app-basket-page|app-mock-card-checkout-page|app-payment-success-page/,
          );
          assert.equal(
            calls.length,
            before,
            `${path} must make zero API calls`,
          );
        }
      }
      console.log(
        "PASS payment-test GET routes: client-only/noindex/zero API; no forms or transactions",
      );
    }
    for (const headers of [
      { host: "unknown.example" },
      { host: "www.athlon.am" },
      { host: "athlonsport.am" },
      { host: "www.athlonsport.am" },
      { host: "evil.athlon.am" },
      { host: "localhost" },
      { ...forwarded("athlon.am"), "x-forwarded-host": "unknown.example" },
      { ...forwarded("athlon.am"), host: "unknown.example" },
      { ...forwarded("athlon.am"), "x-forwarded-proto": "ftp" },
    ]) {
      const before = calls.length;
      const response = await get("/hy/product/ssr-fixture", headers);
      assert.equal(response.status, 400, JSON.stringify(headers));
      assert.doesNotMatch(
        response.html,
        /ng-server-context="ssr"|Տեղական SSR սպիտակուց/,
      );
      assert.equal(calls.length, before);
    }
    const prefix = await get("/hy/product/ssr-fixture", {
      ...forwarded("athlon.am"),
      "x-forwarded-prefix": "/injected",
    });
    assert.doesNotMatch(
      prefix.html,
      /ng-server-context="ssr"|app-product-page/,
    );
    const health = await get("/hy");
    assert.equal(health.status, 200);
    assert.match(health.html, /ng-server-context="ssr"/);
    assert.match(visible(health.html), /<app-home-page\b/);
    assert.ok(visible(health.html).includes(names.hy));
    // Execute the actual Compose health command, changing only the test's random
    // loopback port. Decode this string-only YAML flow sequence (including
    // Prettier's doubled-quote scalars); no daemon or environment file is read.
    const compose = await readFile(
      "infrastructure/docker-compose.production.yml",
      "utf8",
    );
    const sequence = compose.match(
      /  web:\n[\s\S]*?healthcheck:\n\s+test:\n\s*(\[[\s\S]*?\n\s*\])/,
    )[1];
    const command = JSON.parse(
      sequence
        .replace(/'((?:[^']|'')*)'/g, (_match, scalar) =>
          JSON.stringify(scalar.replace(/''/g, "'")),
        )
        .replace(/,\s*\]/, "]"),
    );
    assert.deepEqual(command.slice(0, 3), ["CMD", "node", "-e"]);
    const check = (port) =>
      promisify(execFile)(
        process.execPath,
        ["-e", command[3].replace("127.0.0.1:4000", `127.0.0.1:${port}`)],
        { timeout: 8000 },
      );
    await check(web.address().port);
    const fallback = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><app-root></app-root>");
    });
    await listen(fallback);
    try {
      await assert.rejects(
        check(fallback.address().port),
        (error) => error.code === 1,
      );
    } finally {
      await close(fallback);
    }
    console.log(
      "PASS actual Compose health command: SSR home succeeds, HTTP 200 CSR fallback fails",
    );
    assert.ok(
      calls.every((call) => call.method === "GET"),
      "SSR makes only GET fixture requests",
    );
    console.log(
      "PASS root/unsupported HY; admin client/noindex/zero API; unknown and forged host/unsafe proto 400; prefix untrusted; loopback HY SSR health",
    );
  } finally {
    try {
      if (web) await close(web);
    } finally {
      await close(api);
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
