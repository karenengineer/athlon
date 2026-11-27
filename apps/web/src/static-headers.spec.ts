import { setStaticHeaders } from "./static-headers";

function headersFor(path: string): Record<string, string> {
  const headers: Record<string, string> = {};
  setStaticHeaders(
    { setHeader: (name: string, value: string) => (headers[name] = value) },
    path,
  );
  return headers;
}

describe("setStaticHeaders", () => {
  it.each([
    "/app/dist/browser/ngsw-worker.js",
    "/app/dist/browser/ngsw.json",
    "/app/dist/browser/safety-worker.js",
    "/app/dist/browser/worker-basic.min.js",
  ])("always revalidates %s so installed apps pick up new versions", (path) => {
    expect(headersFor(path)).toEqual({ "Cache-Control": "no-cache" });
  });

  it("serves the manifest with its media type and revalidation", () => {
    expect(headersFor("/app/dist/browser/manifest.webmanifest")).toEqual({
      "Cache-Control": "no-cache",
      "Content-Type": "application/manifest+json; charset=utf-8",
    });
  });

  it("leaves hashed bundles and images on the long default cache", () => {
    expect(headersFor("/app/dist/browser/main-ABC123.js")).toEqual({});
    expect(headersFor("/app/dist/browser/icons/icon-192.png")).toEqual({});
  });
});
