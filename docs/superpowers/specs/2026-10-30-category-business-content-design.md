# Category, business information, and delivery heading

## Intent and scope

Implement numbered content recommendations 2 and 3 from the 2026-10-30 SEO audit:
improve existing category landing pages and publish useful business/shopping
information. Move the existing delivery announcement from the global header into
the homepage hero immediately after its H1. Support Armenian, Russian, and English.

This is not the audit table's pagination/meta-description repair project. Category
and information-page metadata belong to these new content surfaces; canonical,
hreflang, sitemap, robots, structured data, pagination, and general product SEO are
outside this change.

## Confirmed business facts

- ATHLON is an online sports-nutrition shop serving Armenia.
- Delivery is free throughout Armenia with no order-value condition.
- Public telephone: `041 44 88 55`, telephone URL `tel:+37441448855`.
- Business email: `athlonsportgoods@gmail.com`.
- Ordinary orders are paid to the courier on delivery, by cash or card.
- Public online card payments are not being enabled by this change.

Do not invent a physical address, legal-entity details, opening hours, dispatch or
delivery deadlines, authorized-dealer status, authenticity guarantees, health
claims, customer reviews, return deadlines, fees, or eligibility restrictions.
The owner was asked for actual return/exchange terms; until supplied, the returns
page is clearly contact-based assistance, not a fabricated policy.

## Category pages

Keep the current category URLs, filters, product cards, prices, availability rules,
and basket behavior. Render normal localized category navigation links using only
published categories returned by the existing categories endpoint. Never create
navigable categories merely because fallback copy exists for their slugs.

On category landing pages, show a concise localized introduction, practical
selection guidance, and related published-category links. Prefer a nonblank API
category description for the introduction. Provide neutral HY/RU/EN fallback copy
for the existing category taxonomy, and a generic fallback for newly created
categories. Guidance covers comparing package size, flavor, formats, listed price,
and package information; it does not prescribe supplement doses or promise results.

Set meaningful localized category titles and meta descriptions in server-rendered
HTML and on client navigation. Unknown categories, empty results, errors, search
queries, locale changes, and leaving the catalog must not retain stale category
metadata or display unrelated guidance. Render descriptions as text, not raw HTML.

## Business information pages

Add `/:locale/about`, `/:locale/contact`, `/:locale/delivery`, and
`/:locale/returns` before the public wildcard route. Reuse a single lightweight
information-page component and a typed localized content module. Each page has one
H1, short readable sections, localized title/description metadata, and appropriate
catalog/contact links. Footer navigation exposes all four pages on every public
route. Existing social links remain unchanged.

About explains the online store without unsupported credentials. Contact exposes
the confirmed phone/email as accessible links. Delivery explains unconditional
free delivery within Armenia and cash/card payment to the courier. Returns help
invites customers to contact ATHLON with their order reference and question; it
does not claim a complete return policy or replace statutory rights with invented
restrictions. Do not send messages or place orders during verification.

## Homepage and header

Remove the delivery announcement markup and unused announcement-specific styling
from the shared site header. Keep logo, search, language navigation, and catalog
access functional. Keep the hero H1; its immediate following element is the
localized delivery H2, making delivery the second main hero heading before the
supporting paragraph and action button. Retain the confirmed phone number in the
message. Default styling is 32px desktop and 18px mobile, with safe line wrapping.
Existing small brand/eyebrow copy need not be redesigned.

Allow the hero height to accommodate the new heading without clipping Armenian
words, crowding the button, or stretching the image. Verify 320px and 390px mobile
widths and a representative desktop width. The top bar disappears globally;
delivery information remains accessible via the new footer delivery link.

## Architecture and verification

Reuse the existing Angular routing, SSR, localization, and Category API contract.
No backend/schema/seed/production configuration changes are needed. Isolate any
new metadata helper so descriptions reset on SPA navigation and do not leak across
SSR requests or locales. Match the existing monochrome/red design language.

Use test-first regression coverage, built-production SSR checks with synthetic
category fixtures, and focused local browser QA. Security and performance reviews
are read-only. No real credentials, database mutations, orders, email, bank calls,
external navigation, commits, pushes, merges, or deployment are part of this request.
Work on a new branch in the current checkout, per the user's existing preference.

## Choices left to the implementer

Component/helper filenames, exact neutral localized prose, and restrained spacing
may follow existing feature conventions, subject to the invariants above. Keep
the implementation small and avoid adding dependencies or a new CMS.
