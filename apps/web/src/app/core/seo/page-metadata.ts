import { DOCUMENT } from "@angular/common";
import { DestroyRef, inject, RESPONSE_INIT } from "@angular/core";
import { Meta, Title } from "@angular/platform-browser";
import { Locale, supportedLocales } from "../i18n/i18n.service";

const BASELINE_ATTRIBUTE = "data-athlon-description-baseline";
const OWNED_ATTRIBUTE = "data-athlon-seo";
export const PUBLIC_ORIGIN = "https://athlon.am";

export interface PageMetadata {
  title: string;
  description: string;
  locale?: Locale;
  path?: readonly string[];
  query?: Record<string, string>;
  noindex?: boolean;
  image?: string;
  type?: "website" | "product";
  jsonLd?: readonly Record<string, unknown>[];
}

export function publicPageUrl(
  locale: Locale,
  path: readonly string[] = [],
  query: Record<string, string> = {},
): string {
  const url = new URL(
    `/${[locale, ...path].map(encodeURIComponent).join("/")}`,
    PUBLIC_ORIGIN,
  );
  for (const key of Object.keys(query).sort())
    url.searchParams.set(key, query[key]);
  return url.href;
}

export function publicImageUrl(value: string): string | undefined {
  if (!value.trim()) return undefined;
  try {
    const url = new URL(value, PUBLIC_ORIGIN);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function createPageResponseStatus(): (status: 200 | 404 | 503) => void {
  const response = inject(RESPONSE_INIT, { optional: true });
  return (status) => {
    if (response) response.status = status;
  };
}

export function createPageMetadata(): {
  set(metadata: PageMetadata): void;
  clear(): void;
} {
  const meta = inject(Meta);
  const title = inject(Title);
  const document = inject(DOCUMENT);
  let ownedElements: Element[] = [];
  let ownedDescription: HTMLMetaElement | null = null;
  let ownedTitle: string | undefined;
  let baselineDescription: string | null = null;

  const clear = (): void => {
    if (
      ownedDescription &&
      meta.getTag('name="description"') === ownedDescription
    ) {
      ownedElements.forEach((element) => element.remove());
      meta.removeTagElement(ownedDescription);
      if (baselineDescription !== null) {
        meta.addTag({ name: "description", content: baselineDescription });
      }
      if (title.getTitle() === ownedTitle) title.setTitle("ATHLON");
    }
    ownedDescription = null;
    ownedTitle = undefined;
    ownedElements = [];
  };

  inject(DestroyRef).onDestroy(clear);
  return {
    set(metadata): void {
      const previous = meta.getTag('name="description"');
      const inherited = previous?.getAttribute(BASELINE_ATTRIBUTE);
      baselineDescription =
        inherited == null
          ? (previous?.content ?? null)
          : inherited.startsWith("text:")
            ? inherited.slice(5)
            : null;
      // A fresh element identifies this handle's ownership without shared state.
      // The baseline attribute survives SSR hydration and overlapping handles.
      document.head
        .querySelectorAll(`[${OWNED_ATTRIBUTE}]`)
        .forEach((element) => element.remove());
      ownedElements = [];
      meta.removeTag('name="description"');
      ownedDescription = meta.addTag(
        {
          name: "description",
          content: metadata.description,
          [OWNED_ATTRIBUTE]: "",
          [BASELINE_ATTRIBUTE]:
            baselineDescription === null
              ? "none"
              : `text:${baselineDescription}`,
        },
        true,
      );
      ownedTitle = metadata.title;
      title.setTitle(metadata.title);
      const append = (
        tag: string,
        attributes: Record<string, string>,
        text?: string,
      ): void => {
        const element = document.createElement(tag);
        element.setAttribute(OWNED_ATTRIBUTE, "");
        for (const [key, value] of Object.entries(attributes))
          element.setAttribute(key, value);
        if (text !== undefined) element.textContent = text;
        document.head.appendChild(element);
        ownedElements.push(element);
      };
      if (metadata.noindex)
        append("meta", { name: "robots", content: "noindex, follow" });
      if (metadata.locale && metadata.path) {
        const canonical = publicPageUrl(
          metadata.locale,
          metadata.path,
          metadata.query,
        );
        append("link", { rel: "canonical", href: canonical });
        if (!metadata.noindex)
          for (const locale of supportedLocales) {
            append("link", {
              rel: "alternate",
              hreflang: locale,
              href: publicPageUrl(locale, metadata.path, metadata.query),
            });
          }
        const graph: Record<string, string> = {
          "og:title": metadata.title,
          "og:description": metadata.description,
          "og:url": canonical,
          "og:type": metadata.type ?? "website",
          "og:site_name": "ATHLON",
          "og:locale": { hy: "hy_AM", ru: "ru_RU", en: "en_US" }[
            metadata.locale
          ],
        };
        const image = publicImageUrl(
          metadata.image ?? "/brand/athlon-hero-wide.jpeg",
        );
        if (image) graph["og:image"] = image;
        for (const [property, content] of Object.entries(graph))
          append("meta", { property, content });
      }
      if (!metadata.noindex)
        for (const data of metadata.jsonLd ?? []) {
          append(
            "script",
            { type: "application/ld+json" },
            JSON.stringify(data).replace(
              /[<>&\u2028\u2029]/g,
              (character) =>
                `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
            ),
          );
        }
    },
    clear,
  };
}
