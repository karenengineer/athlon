import type { RequestHandler } from "express";

interface InventoryEntry {
  slug: string;
  updatedAt: string;
}
interface Inventory {
  products: InventoryEntry[];
  categories: InventoryEntry[];
}
interface CrawlerOptions {
  apiBaseUrl?: string;
  fetchInventory?: typeof fetch;
  now?: () => number;
  ttlMs?: number;
  timeoutMs?: number;
  maxInventoryBytes?: number;
}
const ORIGIN = "https://athlon.am";
const LOCALES = ["hy", "ru", "en"];
const MAX_URLS = 50_000;
const MAX_XML_BYTES = 50 * 1024 * 1024;
// Public catalog API reads stay crawlable: a crawler that cannot fetch them while
// rendering sees the page's error state, which is noindex.
const ROBOTS = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/docs
Disallow: /api/v1/admin/
Disallow: /api/v1/public/card-payment-test
Disallow: /api/v1/public/orders
Disallow: /card-payment-test
Disallow: /*/basket
Disallow: /*/checkout

Sitemap: ${ORIGIN}/sitemap.xml
`;

function validEntry(entry: unknown): boolean {
  if (!entry || typeof entry !== "object") return false;
  const { slug, updatedAt } = entry as Record<string, unknown>;
  return (
    Object.keys(entry).length === 2 &&
    typeof slug === "string" &&
    !!slug.trim() &&
    slug.length <= 4096 &&
    ![...slug].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) &&
    typeof updatedAt === "string" &&
    !Number.isNaN(Date.parse(updatedAt))
  );
}

function validateInventory(value: unknown): Inventory {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid inventory");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== "categories,products")
    throw new Error("Invalid inventory fields");
  for (const key of ["products", "categories"]) {
    const entries = record[key];
    if (
      !Array.isArray(entries) ||
      entries.length > MAX_URLS ||
      !entries.every(validEntry)
    )
      throw new Error("Invalid inventory entries");
  }
  return record as unknown as Inventory;
}

function escapeXml(value: string): string {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );
}

/** Fixed-origin complete sitemap. Any bound failure discards the entire document. */
export function renderSitemap(
  inventory: Inventory,
  maxBytes = MAX_XML_BYTES,
): string {
  validateInventory(inventory);
  const newest = [...inventory.products, ...inventory.categories]
    .map((entry) => entry.updatedAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  // Listings change with their newest record. Information pages have no recorded
  // modification date, so they carry no lastmod rather than an invented one.
  const pages = new Map<string, string | undefined>();
  for (const path of ["", "/catalog"]) pages.set(path, newest);
  for (const path of ["/about", "/contact", "/delivery", "/returns"])
    pages.set(path, undefined);
  for (const { slug, updatedAt } of inventory.categories)
    pages.set(`/catalog/${encodeURIComponent(slug)}`, updatedAt);
  for (const { slug, updatedAt } of inventory.products)
    pages.set(`/product/${encodeURIComponent(slug)}`, updatedAt);
  if (pages.size * LOCALES.length > MAX_URLS)
    throw new Error("Sitemap URL limit exceeded");

  const entries: { loc: string; part: string }[] = [];
  for (const [path, lastmod] of pages) {
    const alternates = [...LOCALES, "x-default"]
      .map((hreflang) => {
        const locale = hreflang === "x-default" ? "hy" : hreflang;
        const href = escapeXml(`${ORIGIN}/${locale}${path}`);
        return `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>\n`;
      })
      .join("");
    const modified = lastmod
      ? `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`
      : "";
    for (const locale of LOCALES) {
      const loc = `${ORIGIN}/${locale}${path}`;
      entries.push({
        loc,
        part: `  <url>\n    <loc>${escapeXml(loc)}</loc>\n${modified}${alternates}  </url>\n`,
      });
    }
  }
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n',
  ];
  let bytes = Buffer.byteLength(parts[0]! + "</urlset>\n");
  for (const { part } of entries.sort((a, b) =>
    a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0,
  )) {
    bytes += Buffer.byteLength(part);
    if (bytes > Math.min(maxBytes, MAX_XML_BYTES))
      throw new Error("Sitemap XML byte limit exceeded");
    parts.push(part);
  }
  parts.push("</urlset>\n");
  return parts.join("");
}

// Matches the production Angular manifest and its trusted header policy. The
// app has no published web port; Caddy replaces these forwarded headers. Keep
// this explicit boundary for endpoints that return before Angular validation.
function safeCrawlerHeaders(
  headers: Record<string, string | string[] | undefined>,
): boolean {
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value.join(",") : value)?.split(",", 1)[0]?.trim();
  const allowedHost = (value: string | undefined) => {
    if (!value) return false;
    try {
      const url = new URL(`http://${value}`);
      return (
        ["athlon.am", "127.0.0.1"].includes(url.hostname) &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  };
  if (!allowedHost(first(headers["host"]))) return false;
  if (
    headers["x-forwarded-host"] &&
    !allowedHost(first(headers["x-forwarded-host"]))
  )
    return false;
  const protocol = first(headers["x-forwarded-proto"]);
  if (protocol && !/^https?$/i.test(protocol)) return false;
  // Angular refuses SSR when any untrusted forwarded header is present. These
  // direct text/XML endpoints likewise must not become a way around that rule.
  return !Object.keys(headers).some(
    (header) =>
      header.startsWith("x-forwarded-") &&
      !["x-forwarded-host", "x-forwarded-proto", "x-forwarded-for"].includes(
        header,
      ),
  );
}

function inventoryUrl(base: string): URL {
  const url = new URL(base);
  if (
    url.protocol !== "http:" ||
    !["api", "localhost", "127.0.0.1"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/api\/v1\/?$/.test(url.pathname) ||
    (url.hostname === "api" && url.port !== "3000")
  )
    throw new Error("Invalid internal API base");
  url.pathname = "/api/v1/public/seo/sitemap";
  return url;
}

async function readInventory(
  response: globalThis.Response,
  maxBytes: number,
): Promise<Inventory> {
  if (response.status !== 200 || response.redirected || !response.body)
    throw new Error("Inventory unavailable");
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes))
    throw new Error("Inventory response limit");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error("Inventory response limit");
      chunks.push(chunk.value);
    }
    return validateInventory(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function createSeoCrawlerMiddleware(
  options: CrawlerOptions = {},
): RequestHandler {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 60_000;
  const timeoutMs = options.timeoutMs ?? 3_000;
  const maxBytes = options.maxInventoryBytes ?? 16 * 1024 * 1024;
  let cache: { xml: string; expires: number } | undefined;
  let pending: Promise<string> | undefined;
  const sitemap = (): Promise<string> => {
    if (cache && now() < cache.expires) return Promise.resolve(cache.xml);
    if (pending) return pending;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Inventory timeout"));
      }, timeoutMs);
    });
    const load = async () => {
      const url = inventoryUrl(
        options.apiBaseUrl ??
          process.env["SSR_API_BASE_URL"] ??
          "http://localhost:3000/api/v1",
      );
      const response = await (options.fetchInventory ?? fetch)(url, {
        signal: controller.signal,
        redirect: "error",
        headers: { accept: "application/json" },
      });
      return renderSitemap(await readInventory(response, maxBytes));
    };
    pending = Promise.race([load(), deadline])
      .then((xml) => {
        cache = { xml, expires: now() + ttlMs };
        return xml;
      })
      .finally(() => {
        clearTimeout(timer);
        pending = undefined;
      });
    return pending;
  };
  return (request, response, next) => {
    if (request.path !== "/robots.txt" && request.path !== "/sitemap.xml") {
      next();
      return;
    }
    if (!safeCrawlerHeaders(request.headers)) {
      response.status(400).type("text/plain").send("Bad request\n");
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      response.setHeader("Allow", "GET, HEAD");
      response.status(405).end();
      return;
    }
    if (request.path === "/robots.txt") {
      response.type("text/plain").send(ROBOTS);
      return;
    }
    void sitemap()
      .then((xml) => {
        response.setHeader("Cache-Control", "no-cache");
        response.type("application/xml").send(xml);
      })
      .catch(() => {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Retry-After", "60");
        response
          .status(503)
          .type("text/plain")
          .send("Sitemap temporarily unavailable\n");
      });
  };
}
