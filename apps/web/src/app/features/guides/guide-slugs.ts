/**
 * Published guides and their publication dates. Kept free of Angular imports
 * so the server-side sitemap can list the guides without loading copy.
 */
export const guidePublished = {
  "how-to-choose-protein": "2026-11-23",
  "creatine-guide": "2026-11-23",
  "pre-workout-guide": "2026-11-23",
  "original-vs-fake-supplements": "2026-11-23",
  "gainer-guide": "2026-11-24",
  "bcaa-amino-acids-guide": "2026-11-24",
  "l-carnitine-guide": "2026-11-24",
} as const;

export type GuideSlug = keyof typeof guidePublished;

export const guideSlugs = Object.keys(guidePublished) as GuideSlug[];

/** Date the guides index last changed: the newest guide. */
export const GUIDES_UPDATED = Object.values(guidePublished).sort().at(-1)!;
