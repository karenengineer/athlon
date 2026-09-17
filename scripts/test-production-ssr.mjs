import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Test the built production manifest and actual Node handler, not an allowed-host
// QA override or a 200 response that could be Angular's CSR fallback.
async function main() {
  delete process.env.NG_ALLOWED_HOSTS;
  delete process.env.NG_TRUST_PROXY_HEADERS;
  const names = {
    hy: "Տեղական SSR սպիտակուց",
    ru: "Локальный SSR протеин",
    en: "Local SSR protein",
  };
  const calls = [];
  const product = (locale) => ({
    id: "24d3f1a3-8413-4bc6-b32d-437871a22b54",
    sku: "SSR-FIXTURE",
    slug: "ssr-fixture",
    name: names[locale],
    shortDescription: null,
    description: null,
    price: "15000",
    currency: "AMD",
    availability: "IN_STOCK",
    featured: true,
    isNew: false,
    characteristics: {},
    category: { slug: "sports-nutrition", name: "SSR category" },
    brand: null,
    images: [],
  });
  const api = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    calls.push({ path: url.pathname, locale: url.searchParams.get("locale") });
    const locale = url.searchParams.get("locale") ?? "hy";
    let body;
    if (url.pathname === "/api/v1/products/ssr-fixture") body = product(locale);
    else if (url.pathname === "/api/v1/products")
      body = {
        items: [product(locale)],
        meta: { page: 1, pageSize: 24, total: 1, totalPages: 1 },
      };
    else if (
      url.pathname === "/api/v1/categories" ||
      url.pathname === "/api/v1/brands"
    )
      body = [];
    else if (url.pathname === "/api/v1/public/settings") body = {};
    else {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  const listen = (server) =>
    new Promise((done) => server.listen(0, "127.0.0.1", done));
  const close = (server) =>
    new Promise((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
  await listen(api);
  process.env.SSR_API_BASE_URL = `http://127.0.0.1:${api.address().port}/api/v1`;
  let web;
  try {
    const { reqHandler } = await import(
      pathToFileURL(resolve("apps/web/dist/web/server/server.mjs"))
    );
    web = createServer((req, res) =>
      reqHandler(req, res, (error) => {
        res.writeHead(error ? 500 : 404);
        res.end(String(error ?? "Not found"));
      }),
    );
    await listen(web);
    const get = (path, headers = {}) =>
      new Promise((done, reject) => {
        const req = request(
          { hostname: "127.0.0.1", port: web.address().port, path, headers },
          (res) => {
            let html = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => (html += chunk));
            res.on("end", () =>
              done({ status: res.statusCode, headers: res.headers, html }),
            );
          },
        );
        req.on("error", reject);
        req.setTimeout(8000, () =>
          req.destroy(new Error("SSR request timeout")),
        );
        req.end();
      });
    const forwarded = (host) => ({
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": "https",
      "x-forwarded-for": "192.0.2.42",
    });
    const visible = (html) =>
      html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    for (const host of ["athlonsport.am", "www.athlonsport.am"]) {
      for (const locale of ["hy", "ru", "en"]) {
        const before = calls.length;
        const response = await get(
          `/${locale}/product/ssr-fixture`,
          forwarded(host),
        );
        assert.equal(response.status, 200, `${host}/${locale}`);
        assert.match(response.html, /ng-server-context="ssr"/);
        assert.match(visible(response.html), /<app-product-page\b/);
        assert.ok(
          visible(response.html).includes(names[locale]),
          `visible localized product: ${host}/${locale}`,
        );
        assert.ok(
          calls
            .slice(before)
            .some(
              (call) =>
                call.path === "/api/v1/products/ssr-fixture" &&
                call.locale === locale,
            ),
        );
        console.log(
          `PASS ${host}/${locale}: actual localized product SSR with Caddy host/proto/for`,
        );
      }
      for (const [path, target] of [
        ["/", "/hy"],
        ["/de/catalog", "/hy/catalog"],
      ]) {
        const response = await get(path, forwarded(host));
        assert.equal(response.status, 302);
        assert.equal(
          new URL(response.headers.location, `https://${host}`).pathname,
          target,
        );
      }
      for (const path of [
        "/admin/login",
        "/admin/categories/example/edit",
        "/admin/brands/example/edit",
        "/admin/products/example/edit",
      ]) {
        const before = calls.length;
        const response = await get(path, {
          ...forwarded(host),
          cookie: "athlon_access=private-SSR-test-only",
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
        assert.doesNotMatch(
          response.html,
          /ng-server-context="ssr"|SSR-FIXTURE|private-SSR-test-only|app-admin-shell/,
        );
        assert.equal(
          calls.length,
          before,
          `${path} must make zero public/private API calls`,
        );
      }
    }
    for (const headers of [
      { host: "unknown.example" },
      { host: "evil.athlonsport.am" },
      { host: "localhost" },
      { ...forwarded("athlonsport.am"), "x-forwarded-host": "unknown.example" },
      { ...forwarded("athlonsport.am"), host: "unknown.example" },
      { ...forwarded("athlonsport.am"), "x-forwarded-proto": "ftp" },
    ]) {
      const before = calls.length;
      const response = await get("/hy/product/ssr-fixture", headers);
      assert.equal(response.status, 400, JSON.stringify(headers));
      assert.doesNotMatch(
        response.html,
        /ng-server-context="ssr"|Տեղական SSR սպիտակուց/,
      );
      assert.equal(calls.length, before);
    }
    const prefix = await get("/hy/product/ssr-fixture", {
      ...forwarded("athlonsport.am"),
      "x-forwarded-prefix": "/injected",
    });
    assert.doesNotMatch(
      prefix.html,
      /ng-server-context="ssr"|app-product-page/,
    );
    const health = await get("/hy");
    assert.equal(health.status, 200);
    assert.match(health.html, /ng-server-context="ssr"/);
    assert.match(visible(health.html), /<app-home-page\b/);
    assert.ok(visible(health.html).includes(names.hy));
    // Execute the actual Compose health command, changing only the test's random
    // loopback port. Decode this string-only YAML flow sequence (including
    // Prettier's doubled-quote scalars); no daemon or environment file is read.
    const compose = await readFile(
      "infrastructure/docker-compose.production.yml",
      "utf8",
    );
    const sequence = compose.match(
      /  web:\n[\s\S]*?healthcheck:\n\s+test:\n\s*(\[[\s\S]*?\n\s*\])/,
    )[1];
    const command = JSON.parse(
      sequence
        .replace(/'((?:[^']|'')*)'/g, (_match, scalar) =>
          JSON.stringify(scalar.replace(/''/g, "'")),
        )
        .replace(/,\s*\]/, "]"),
    );
    assert.deepEqual(command.slice(0, 3), ["CMD", "node", "-e"]);
    const check = (port) =>
      promisify(execFile)(
        process.execPath,
        ["-e", command[3].replace("127.0.0.1:4000", `127.0.0.1:${port}`)],
        { timeout: 8000 },
      );
    await check(web.address().port);
    const fallback = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><app-root></app-root>");
    });
    await listen(fallback);
    try {
      await assert.rejects(
        check(fallback.address().port),
        (error) => error.code === 1,
      );
    } finally {
      await close(fallback);
    }
    console.log(
      "PASS actual Compose health command: SSR home succeeds, HTTP 200 CSR fallback fails",
    );
    console.log(
      "PASS root/unsupported HY; admin client/noindex/zero API; unknown and forged host/unsafe proto 400; prefix untrusted; loopback HY SSR health",
    );
  } finally {
    try {
      if (web) await close(web);
    } finally {
      await close(api);
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
