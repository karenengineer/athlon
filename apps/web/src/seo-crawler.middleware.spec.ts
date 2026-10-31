import express from "express";
import { createServer, request, type Server } from "node:http";
import {
  createSeoCrawlerMiddleware,
  renderSitemap,
} from "./seo-crawler.middleware";

describe("real crawler endpoints", () => {
  const servers: Server[] = [];
  const listen = async (handler: ReturnType<typeof express>) => {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((done, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", done);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No port");
    return `http://127.0.0.1:${address.port}`;
  };
  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      ),
    );
  });
  const inventory = {
    productSlugs: ["z", 'a<&"', "z", "հայ /x"],
    categorySlugs: ["protein"],
  };
  const setup = async (
    options: Parameters<typeof createSeoCrawlerMiddleware>[0] = {},
  ) => {
    const api = express();
    let calls = 0;
    api.get("/api/v1/public/seo/sitemap", (_req, res) => {
      calls++;
      res.json(inventory);
    });
    const base = await listen(api);
    const web = express();
    web.use(
      createSeoCrawlerMiddleware({ apiBaseUrl: `${base}/api/v1`, ...options }),
    );
    web.use((_req, res) => res.status(418).send("Angular boundary"));
    const url = await listen(web);
    return {
      get: (path: string, headers: Record<string, string> = {}) =>
        new Promise<Response>((done, reject) => {
          const outgoing = request(`${url}${path}`, { headers }, (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk: Buffer) => chunks.push(chunk));
            response.on("end", () =>
              done(
                new Response(Buffer.concat(chunks), {
                  status: response.statusCode,
                  headers: response.headers as Record<string, string>,
                }),
              ),
            );
          });
          outgoing.on("error", reject);
          outgoing.setTimeout(1000, () =>
            outgoing.destroy(new Error("Fixture timeout")),
          );
          outgoing.end();
        }),
      calls: () => calls,
    };
  };

  it("serves text robots directly and permits crawling noindex query variants", async () => {
    const web = await setup();
    const response = await web.get("/robots.txt");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    const body = await response.text();
    expect(body).toContain("Sitemap: https://athlon.am/sitemap.xml");
    expect(body).not.toMatch(/Disallow:.*[?*]/);
    expect(web.calls()).toBe(0);
    expect((await web.get("/hy")).status).toBe(418);
  });
  it("serves complete sorted unique encoded XML URLs and all static locale pages", async () => {
    const web = await setup();
    const response = await web.get("/sitemap.xml", {
      host: "athlon.am",
      "x-forwarded-proto": "https",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    const xml = await response.text();
    const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(
      (match) => match[1],
    );
    expect(urls).toEqual([...new Set(urls)].sort());
    for (const locale of ["hy", "ru", "en"]) {
      for (const page of [
        "",
        "/catalog",
        "/about",
        "/contact",
        "/delivery",
        "/returns",
        "/catalog/protein",
        "/product/a%3C%26%22",
        "/product/%D5%B0%D5%A1%D5%B5%20%2Fx",
      ])
        expect(urls).toContain(`https://athlon.am/${locale}${page}`);
    }
    expect(xml).not.toMatch(/lastmod|basket|search|admin|card-payment|<&/);
    expect(web.calls()).toBe(1);
  });
  it.each<Record<string, string>>([
    { host: "unknown.example" },
    { host: "www.athlon.am" },
    { host: "localhost" },
    { host: "athlon.am", "x-forwarded-host": "evil.example" },
    { host: "evil.example", "x-forwarded-host": "athlon.am" },
    { host: "athlon.am", "x-forwarded-proto": "ftp" },
    { host: "athlon.am", "x-forwarded-prefix": "/injected" },
    { host: "athlon.am", "x-forwarded-port": "443" },
  ])(
    "rejects unsafe crawler headers before any inventory call: %j",
    async (headers) => {
      const web = await setup();
      for (const path of ["/robots.txt", "/sitemap.xml"])
        expect((await web.get(path, headers)).status).toBe(400);
      expect(web.calls()).toBe(0);
    },
  );
  it("uses one complete TTL cache and single flight; expires closed on failure", async () => {
    let now = 0;
    let calls = 0;
    let failure = false;
    const web = await setup({
      now: () => now,
      ttlMs: 100,
      fetchInventory: async () => {
        calls++;
        await new Promise((done) => setTimeout(done, 10));
        if (failure) throw new Error("fixture failure");
        return new Response(JSON.stringify(inventory));
      },
    });
    expect(
      (
        await Promise.all([web.get("/sitemap.xml"), web.get("/sitemap.xml")])
      ).map((res) => res.status),
    ).toEqual([200, 200]);
    expect(calls).toBe(1);
    failure = true;
    now = 99;
    expect((await web.get("/sitemap.xml")).status).toBe(200);
    expect(calls).toBe(1);
    now = 100;
    const response = await web.get("/sitemap.xml");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("<urlset");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it.each([
    "not JSON",
    JSON.stringify({ productSlugs: [null], categorySlugs: [] }),
    JSON.stringify({ productSlugs: [""], categorySlugs: [] }),
    JSON.stringify({ productSlugs: ["\ud800"], categorySlugs: [] }),
    JSON.stringify({ productSlugs: [], categorySlugs: [], secret: "extra" }),
  ])("fails closed for invalid inventory", async (body) => {
    const web = await setup({ fetchInventory: async () => new Response(body) });
    expect((await web.get("/sitemap.xml")).status).toBe(503);
  });
  it("bounds actual streamed bytes even without content-length", async () => {
    const web = await setup({
      maxInventoryBytes: 32,
      fetchInventory: async () => new Response(" ".repeat(33)),
    });
    expect((await web.get("/sitemap.xml")).status).toBe(503);
  });
  it("rejects non-200, redirects and oversized declared responses", async () => {
    for (const response of [
      new Response("{}", { status: 503 }),
      new Response("", { status: 302 }),
      new Response("{}", { headers: { "content-length": "999999999" } }),
    ]) {
      const web = await setup({ fetchInventory: async () => response });
      expect((await web.get("/sitemap.xml")).status).toBe(503);
    }
  });
  it("times out inventory reads without returning a partial success", async () => {
    const web = await setup({
      timeoutMs: 20,
      fetchInventory: async (_url, options) =>
        new Promise<Response>((_resolve, reject) =>
          options?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          ),
        ),
    });
    expect((await web.get("/sitemap.xml")).status).toBe(503);
  });
  it("accepts empty published inventory and enforces URL/XML bounds without truncation", () => {
    expect([
      ...renderSitemap({ productSlugs: [], categorySlugs: [] }).matchAll(
        /<loc>/g,
      ),
    ]).toHaveLength(18);
    expect(() =>
      renderSitemap({
        productSlugs: Array.from({ length: 16661 }, (_, index) => `p-${index}`),
        categorySlugs: [],
      }),
    ).toThrow(/limit/i);
    expect(() =>
      renderSitemap(
        { productSlugs: ["x".repeat(100)], categorySlugs: [] },
        100,
      ),
    ).toThrow(/limit/i);
  });
  it("fetches only fixed internal inventory and refuses redirects or poisoned API bases", async () => {
    let actualUrl = "";
    let redirect = "";
    const web = await setup({
      fetchInventory: async (url, options) => {
        actualUrl = String(url);
        redirect = options?.redirect ?? "";
        return new Response(JSON.stringify(inventory));
      },
    });
    expect((await web.get("/sitemap.xml")).status).toBe(200);
    expect(actualUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/api\/v1\/public\/seo\/sitemap$/,
    );
    expect(redirect).toBe("error");
    for (const base of [
      "https://example.com/api/v1",
      "http://user:password@api:3000/api/v1",
      "http://api:3000/api/v1?x=1",
    ]) {
      const invalid = await setup({ apiBaseUrl: base });
      expect((await invalid.get("/sitemap.xml")).status).toBe(503);
    }
  });
});
