/**
 * Published guide slugs. Kept free of Angular imports so the server-side
 * sitemap can list the guides without loading article copy.
 */
export const guideSlugs = [
  "how-to-choose-protein",
  "creatine-guide",
  "pre-workout-guide",
  "original-vs-fake-supplements",
] as const;

export type GuideSlug = (typeof guideSlugs)[number];

/** First publication date, used for Article structured data and lastmod. */
export const GUIDES_PUBLISHED = "2026-11-23";
