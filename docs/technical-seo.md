# Technical SEO operations

The canonical public origin is `https://athlon.am`. The code serves `/robots.txt`
directly as text and `/sitemap.xml` directly as XML. The sitemap lists home, catalog,
about, contact, delivery and returns pages in HY/RU/EN, plus the API's published
category and product inventory. It excludes private, search, basket and filtered
URLs. Every URL carries `xhtml:link` HY/RU/EN/x-default alternates (x-default is
HY). `lastmod` comes from the record's `updatedAt`; home and catalog use the newest
record. Information pages have no recorded date, so they carry no `lastmod`.

The web process reads only `GET /api/v1/public/seo/sitemap` using its existing
`SSR_API_BASE_URL`. The base must be the internal `http://api:3000/api/v1` or a
loopback development API, with no credentials, query or fragment. It never uses
request headers to choose the upstream or canonical origin. Requests time out
after three seconds, inventory is limited to 16 MiB, and complete XML is cached in
memory for 60 seconds with one shared in-flight request. A failed refresh after
expiry returns HTTP 503 and `Retry-After: 60`; it never publishes a partial list or
expired inventory. The sitemap fails closed above 50,000 URLs or 50 MiB of XML.
If inventory grows beyond those limits, add a reviewed sitemap index/sharding
implementation before increasing catalog size; there is no silent truncation.

Crawler endpoints retain the production host boundary (`athlon.am`, and
`127.0.0.1` for internal health checks), HTTP/HTTPS validation and trusted proxy
header policy. Caddy remains the public boundary. Search/filter pages remain
crawlable so crawlers can read their `noindex, follow` metadata. Admin, the isolated
payment test paths, basket/checkout and the private API paths are disallowed in
robots; these directives do not replace authentication or route security.

Never add a blanket `Disallow: /api/`. Crawlers render JavaScript, and a page that
cannot reach the public catalog API falls into its error state, which is `noindex`.
SSR hands API responses to the browser through the HTTP transfer cache
(`core/api/api-transfer-origin.ts`), so a hydrated page normally makes no API call;
keep the public reads crawlable as the fallback. A `Cache-Control: no-store` on
public API responses would disable that cache.

## Local evidence

Run `pnpm --filter @athlon/web test --include=src/seo-crawler.middleware.spec.ts`
for isolated loopback crawler tests. Run `pnpm --filter @athlon/web build`, then
`pnpm test:ssr` for actual built HTML, metadata, JSON-LD, pagination, status codes,
security guards and the Compose health command. These use synthetic read-only
API fixtures and require local loopback listeners. Do not set `NG_ALLOWED_HOSTS`
for production SSR verification.

Initial HTML contains one fixed-origin canonical and reciprocal HY/RU/EN
alternates for indexable equivalent routes. Plain pagination is self-canonical;
search/filter/basket variants are `noindex, follow`. A true missing public product
or category, an unknown route and an unsupported first path segment are HTTP 404
with `noindex`, while required upstream failures are HTTP 503. Only `/` redirects
to `/hy`. Inert
JSON-LD describes confirmed store/product/breadcrumb facts without fabricated
ratings, addresses or return policies.

## Search Console: external owner tasks

No Search Console account was authenticated, property verified, sitemap submitted
or indexing requested by this repository change. Deployment also requires a
separate owner instruction. After an approved deployment:

1. An owner signs into [Google Search Console](https://search.google.com/search-console)
   and selects an existing verified ATHLON property. If no property is verified,
   follow Google's [ownership verification instructions](https://support.google.com/webmasters/answer/9008080).
   Domain-property verification requires a DNS TXT record, which is a separate
   explicitly authorized external account/DNS task. Never publish verification
   credentials in source, chat or logs.
2. Check that `https://athlon.am/robots.txt` and `https://athlon.am/sitemap.xml`
   return HTTP 200 in the live deployment, with the expected content types and
   complete published inventory. A local fixture pass does not establish live
   availability or account access.
3. Use the property's Sitemaps report to submit `https://athlon.am/sitemap.xml`;
   record the actual submission date and processing result. Follow Google's
   [sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
   Submission does not guarantee indexing.
4. Use [URL Inspection](https://support.google.com/webmasters/answer/9012289) on
   representative HY/RU/EN home, category, product and page-two URLs. Inspect the
   fetched HTML, HTTP status, declared/selected canonical and indexability; use
   live testing where available. Request indexing only for approved public URLs.
5. Record a baseline of impressions, clicks, indexed pages and relevant queries;
   compare subsequent periods using consistent country/language/device filters.
   Monitor sitemap errors and unexpected 404/503 responses. Search ranking changes
   take time and are not guaranteed by technical fixes.

If authenticated ownership access is unavailable, record that blocker and leave
verification/submission pending. Do not claim the property was verified or pages
were indexed based on code tests alone.
