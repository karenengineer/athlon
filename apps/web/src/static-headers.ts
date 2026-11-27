import { basename } from "node:path";

/**
 * Hashed bundles may be cached for a year, but the files that announce a new
 * version, and icons browsers fetch by fixed name, must always be revalidated.
 */
const revalidatedFiles = new Set([
  "ngsw-worker.js",
  "ngsw.json",
  "safety-worker.js",
  "worker-basic.min.js",
  "manifest.webmanifest",
  // Fixed, unhashed icon URLs that browsers request on their own: revalidate
  // so a changed icon replaces the cached one (ETag keeps it cheap).
  "favicon.ico",
  "apple-touch-icon.png",
  "apple-touch-icon-precomposed.png",
  "favicon-32.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-192.png",
  "icon-maskable-512.png",
]);

export function setStaticHeaders(
  response: { setHeader(name: string, value: string): unknown },
  filePath: string,
): void {
  const name = basename(filePath);
  if (!revalidatedFiles.has(name)) return;
  response.setHeader("Cache-Control", "no-cache");
  if (name === "manifest.webmanifest") {
    response.setHeader(
      "Content-Type",
      "application/manifest+json; charset=utf-8",
    );
  }
}
