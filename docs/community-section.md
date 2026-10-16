# Homepage community section

The Instagram community section replaces the old packaging panel on the
Armenian, Russian, and English homepages. It does not change the product
showcase, footer, basket, orders, or payment routes.

## Content and behavior

- Desktop: three square photographs in a row, with TREC Creatine on the left,
  training in the middle, and chocolate TREC Whey 100 on the right.
- Mobile: the same photographs stack in that order. Text, links, and controls
  are HTML, not part of a screenshot.
- Destinations use the shared ATHLON Instagram profile URL. These are curated
  illustrations, not a live feed or individual Instagram posts. No Instagram
  SDK, tracking embed, or remote image dependency is added.
- The heading, supporting copy, call to action, and image descriptions are
  localized in HY/RU/EN. The approved `ATHLON / COMMUNITY` brand label is shared.

## Asset provenance

The photos in `apps/web/public/community/` are AI-generated illustrations
derived from the community mockup approved on 2026-10-16. TREC packaging was
referenced against the existing public ATHLON catalog images. They are not
customer photos, testimonials, or evidence of an endorsement by TREC.

The generation briefs reconstructed only the corresponding photo tile:
creatine and shaker on a gym bench; an anonymous athlete gripping a dumbbell;
and a chocolate protein bag alongside a chocolate shake, towel, and scoop.
No website text, buttons, icons, or borders were baked into these assets.

Built-in ImageGen was used. Opaque square sources were encoded as WebP at
quality 82 in 480px and 960px variants. The original generated sources remain
outside the repository; the storefront references only repository-owned files.
Keep product packaging accurate when replacing assets. Do not derive product
specifications or nutrition claims from an illustrative photo.

## Focused verification

Check `/hy`, `/ru`, and `/en` locally. Confirm the new section is immediately
before the unchanged footer; all images load and remain square; links target
the configured profile; keyboard focus is visible; and 320px, 393px, 768px,
1440px, and 1920px layouts have no horizontal overflow. Use component tests,
the web test suite, lint, production build, and SSR checks before release.

Native iPhone Safari still requires a device smoke test; Chromium viewport
testing alone is not equivalent to that browser.
