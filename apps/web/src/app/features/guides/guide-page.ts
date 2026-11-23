import { Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { combineLatest } from "rxjs";
import { I18nService, Locale, parseLocale } from "../../core/i18n/i18n.service";
import {
  createPageMetadata,
  createPageResponseStatus,
  PUBLIC_ORIGIN,
  publicPageUrl,
} from "../../core/seo/page-metadata";
import { breadcrumbSchema } from "../../core/seo/seo-content";
import { GUIDES_PUBLISHED, GuideSlug, guideSlugs } from "./guide-slugs";
import { Guide, guides, guidesCopy } from "./guides-content";

/** Guides index (/:locale/guides) and articles (/:locale/guides/:slug). */
@Component({
  selector: "app-guide-page",
  imports: [RouterLink],
  templateUrl: "./guide-page.html",
  styleUrl: "./guide-page.scss",
})
export class GuidePage {
  readonly i18n = inject(I18nService);
  readonly slug = signal<GuideSlug | null>(null);
  readonly guide = signal<Guide | null>(null);
  readonly category = signal<string | null>(null);
  readonly notFound = signal(false);
  readonly slugs = guideSlugs;
  private readonly route = inject(ActivatedRoute);
  private readonly metadata = createPageMetadata();
  private readonly responseStatus = createPageResponseStatus();

  constructor() {
    combineLatest([this.route.paramMap, this.route.parent!.paramMap])
      .pipe(takeUntilDestroyed())
      .subscribe(([params, parentParams]) => {
        const locale = parseLocale(parentParams.get("locale"));
        this.i18n.setLocale(locale);
        const slug = params.get("slug");
        if (slug === null) return this.showIndex(locale);
        if (!(guideSlugs as readonly string[]).includes(slug))
          return this.showNotFound();
        this.showGuide(locale, slug as GuideSlug);
      });
  }

  copy() {
    return guidesCopy[this.i18n.locale()];
  }

  entry(slug: GuideSlug): Guide {
    return guides[slug].copy[this.i18n.locale()];
  }

  /** The default category is served at /catalog. */
  categoryLink(category: string): string[] {
    const catalog = ["/", this.i18n.locale(), "catalog"];
    return category === "sports-nutrition" ? catalog : [...catalog, category];
  }

  private showIndex(locale: Locale): void {
    const copy = guidesCopy[locale];
    this.responseStatus(200);
    this.notFound.set(false);
    this.slug.set(null);
    this.guide.set(null);
    this.category.set(null);
    this.metadata.set({
      title: `${copy.title} | ATHLON`,
      description: copy.description,
      locale,
      path: ["guides"],
      jsonLd: [
        breadcrumbSchema([
          { name: this.i18n.t("home"), url: publicPageUrl(locale) },
          { name: copy.heading, url: publicPageUrl(locale, ["guides"]) },
        ]),
      ],
    });
  }

  private showGuide(locale: Locale, slug: GuideSlug): void {
    const copy = guidesCopy[locale];
    const guide = guides[slug].copy[locale];
    const url = publicPageUrl(locale, ["guides", slug]);
    this.responseStatus(200);
    this.notFound.set(false);
    this.slug.set(slug);
    this.guide.set(guide);
    this.category.set(guides[slug].category);
    this.metadata.set({
      title: `${guide.title} | ATHLON`,
      description: guide.description,
      locale,
      path: ["guides", slug],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.heading,
          description: guide.description,
          inLanguage: locale,
          url,
          mainEntityOfPage: url,
          datePublished: GUIDES_PUBLISHED,
          dateModified: GUIDES_PUBLISHED,
          image: `${PUBLIC_ORIGIN}/brand/athlon-hero-wide.jpeg`,
          author: { "@type": "Organization", name: "ATHLON" },
          publisher: { "@id": `${PUBLIC_ORIGIN}/#store` },
        },
        breadcrumbSchema([
          { name: this.i18n.t("home"), url: publicPageUrl(locale) },
          { name: copy.heading, url: publicPageUrl(locale, ["guides"]) },
          { name: guide.heading, url },
        ]),
      ],
    });
  }

  private showNotFound(): void {
    this.responseStatus(404);
    this.notFound.set(true);
    this.slug.set(null);
    this.guide.set(null);
    this.category.set(null);
    this.metadata.set({
      title: `${this.i18n.t("notFoundTitle")} | ATHLON`,
      description: this.i18n.t("notFoundText"),
      noindex: true,
    });
  }
}
