import { basename } from "node:path";

/**
 * Hashed bundles may be cached for a year, but the files that announce a new
 * version must always be revalidated, or installed apps would never update.
 */
const revalidatedFiles = new Set([
  "ngsw-worker.js",
  "ngsw.json",
  "safety-worker.js",
  "worker-basic.min.js",
  "manifest.webmanifest",
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
