import { Product } from "../api/catalog.models";
import { Locale } from "../i18n/i18n.service";
import { FACEBOOK_PROFILE_URL, INSTAGRAM_PROFILE_URL } from "../social-links";
import { publicImageUrl, publicPageUrl, PUBLIC_ORIGIN } from "./page-metadata";

export const seoCopy = {
  hy: {
    homeTitle: "Սպորտային սնունդ Հայաստանում | ATHLON",
    homeDescription:
      "Սպորտային սննդի առցանց խանութ Հայաստանում․ պրոտեին, կրեատին և ամինաթթուներ։ Անվճար առաքում ողջ Հայաստանում։",
    armenia: "Հայաստան",
    delivery: "Անվճար առաքում ողջ Հայաստանում։",
    page: "Էջ",
    unavailableTitle: "Ծառայությունը ժամանակավորապես անհասանելի է",
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
    unavailableTitle: "Сервис временно недоступен",
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
    unavailableTitle: "Service temporarily unavailable",
    productDescription:
      "Product details, price and availability at ATHLON, an online sports-nutrition shop in Armenia.",
  },
} as const;

export function localProductDescription(
  product: Product,
  locale: Locale,
): string {
  return (
    product.shortDescription?.trim() ||
    product.description?.trim() ||
    seoCopy[locale].productDescription
  );
}

export function storeSchema(locale: Locale): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${PUBLIC_ORIGIN}/#store`,
    name: "ATHLON",
    url: publicPageUrl(locale),
    description: seoCopy[locale].homeDescription,
    telephone: "+37441448855",
    email: "athlonsportgoods@gmail.com",
    areaServed: { "@type": "Country", name: "Armenia" },
    sameAs: [INSTAGRAM_PROFILE_URL, FACEBOOK_PROFILE_URL],
  };
}

export function breadcrumbSchema(
  items: readonly { name: string; url: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function productSchema(
  product: Product,
  locale: Locale,
): Record<string, unknown> {
  const url = publicPageUrl(locale, ["product", product.slug]);
  const images = product.images
    .map((image) => publicImageUrl(image.detailUrl))
    .filter((image): image is string => !!image);
  const availability =
    product.availability === "IN_STOCK"
      ? "InStock"
      : product.availability === "OUT_OF_STOCK"
        ? "OutOfStock"
        : product.availability === "PREORDER"
          ? "PreOrder"
          : undefined;
  const price = product.price?.trim();
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url,
    description: localProductDescription(product, locale),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.brand?.name
      ? { brand: { "@type": "Brand", name: product.brand.name } }
      : {}),
    ...(images.length ? { image: images } : {}),
    ...(availability &&
    product.currency === "AMD" &&
    price &&
    /^\d+(?:\.\d+)?$/.test(price) &&
    Number.isFinite(Number(price))
      ? {
          offers: {
            "@type": "Offer",
            url,
            price,
            priceCurrency: "AMD",
            availability: `https://schema.org/${availability}`,
          },
        }
      : {}),
  };
}
