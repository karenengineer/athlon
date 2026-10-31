# ATHLON technical SEO fixes

## Purpose and authority

The owner requests fixes to improve search visibility after finding ATHLON on page seven for a general sports-nutrition search. Some product pages are confirmed indexed. This implements the identified technical defects and necessary metadata/discovery improvements; it does not promise rankings, purchase links, redesign the storefront, or manufacture business facts. HY/RU/EN remain aligned.

## Constraints

- Canonical public origin is `https://athlon.am`; never derive SEO URLs from request Host or arbitrary forwarded headers.
- Preserve current purchase/payment, prices, inventory, product content, existing taxonomy and visual design. No database writes, migrations or credentials.
- Confirmed business facts: online sports-nutrition shop in Armenia, unconditional free delivery throughout Armenia, courier cash/card payment, phone `041 44 88 55` (`tel:+37441448855`), email `athlonsportgoods@gmail.com`, existing public social URLs. No fabricated address, hours, reviews, ratings, medical claims, dealer status, delivery timelines or return terms.
- Preserve SSR/hydration, client-only/noindex admin and card-test routes, host/proxy/prefix security and health checks.
- Use a new branch in this checkout, no worktree. No production/DNS/account changes, Search Console ownership verification, paid services, live transactions, merge or deployment without separate authorization. Prepare code and evidence for review.

## Discovery endpoints

Add read-only `GET /api/v1/public/seo/sitemap` returning `{ productSlugs: string[], categorySlugs: string[] }`. Products use the same published predicate as public product detail; categories mirror published roots and their published direct children. Select only slugs, deterministically sort/deduplicate; never expose private records. No fabricated lastmod.

Express serves `/robots.txt` as text and `/sitemap.xml` as XML before Angular locale handling. Robots allows public crawling and advertises `https://athlon.am/sitemap.xml`; protected paths may be disallowed, but do not block search/filter pages whose noindex must be read. Sitemap contains canonical home, catalog, about/contact/delivery/returns and published category/product URLs in HY/RU/EN, never search/basket/admin/payment/filter URLs. Encode path segments and escape XML. Enforce Google's 50,000-URL/50MB bounds by failing clearly if exceeded; no silent truncation.

Fetch only the fixed internal inventory endpoint from the existing trusted SSR API base, finite timeout, bounded response and schema checks, process-local short cache/single-flight. On inventory failure return503, or a bounded still-valid complete cache; never return an incomplete apparently successful sitemap. Do not let new pre-Angular endpoints bypass existing host/protocol checks. Equivalent allowed host/proto/prefix rules and tests must apply; no environment override weakening them.

## Metadata and URL policy

Extend the current metadata lifecycle helper, retaining its title/description interface and safe overlapping ownership. Use fixed-origin self canonicals and reciprocal `hy`, `ru`, `en` alternate URLs for real equivalent public routes, including self. Optional x-default uses HY. On transitions/errors/private routes clear owned canonical/alternate/OG/schema/robots tags without deleting another page's metadata. Preserve SSR serialization/hydration; no module-global mutable document state.

Homepage localized titles/descriptions clearly describe sports nutrition in Armenia and existing offers (protein, creatine, amino acids, free delivery); retain the hero slogan/H1. Known categories have meaningful localized titles/descriptions with real category names and Armenia context. Product descriptions prefer actual localized API short/long descriptions with a neutral factual fallback. Information pages retain current accurate copy. Add coherent Open Graph tags and absolute public images using existing assets only.

Clean public pages are indexable. Internal search, explicit filter/sort combinations and basket are `noindex, follow`; omit alternates/schema for nonindexable variants. Ignore tracking fragments/parameters when canonicalizing clean pages. Preserve meaningful filter parameters in self canonical URLs rather than claim materially different subsets are identical. Plain `?page=2` has its own canonical and localized title suffix; page1 normalizes to the bare URL. Exclude invalid/unknown/out-of-range pages from indexing without treating upstream failure as missing inventory.

## Structured data

Render inert JSON-LD in initial SSR HTML and update/clean it on SPA navigation. Home/about may expose truthful `OnlineStore`/Organization information from confirmed facts. Product pages use current public Product facts, real category breadcrumbs, SKU/brand/images when present and current AMD Offer only when price is valid. Availability must accurately map public states; unknown/ON_REQUEST omits the Offer rather than invent availability. No ratings, GTINs or return policies invented. Escape `<`, `>`, `&` and script-breaking sequences; use textContent, never unsafe raw HTML. Use BreadcrumbList on catalog/product routes reflecting actual links.

## Crawlable navigation and real statuses

Pagination uses real next/previous anchors with hrefs and RouterLink, preserves current query filters, has accessible boundary states and current-page context. Existing filter behavior and product requests stay unchanged.

Valid-locale unknown routes/categories and API product404 return actual HTTP404 with noindex. Published empty categories remain200. Upstream API failures return503/noindex; do not emit stale product/canonical/schema state. RESPONSE_INIT is optional during browser execution and safely handled. Preserve root/unsupported-locale redirects and private-route client rendering. A real missing product may show existing error UI; no redesign required.

## Measurement and release

Use synthetic fixtures, unit/integration tests, real built-production SSR assertions, full `pnpm verify`, focused real browser HY/RU/EN transitions/pagination at mobile/desktop and read-only security/performance review. Search Console requires an authenticated verified property; document setup, sitemap submission and URL Inspection steps, reporting actual access blockers instead of claiming submitted/indexed. No ranking guarantee or fake local business listing. Public deployment needs the owner's separate deploy instruction.
