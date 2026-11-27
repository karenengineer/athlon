import config from "../ngsw-config.json";

/** Same matching the service worker uses for navigationUrls globs. */
function globToRegExp(glob: string): RegExp {
  const pattern = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .split("**")
    .map((part) => part.replace(/\*/g, "[^/]*"))
    .join(".*");
  return new RegExp(`^${pattern}$`);
}

function servedFromShell(url: string): boolean {
  const include = config.navigationUrls.filter((glob) => !glob.startsWith("!"));
  const exclude = config.navigationUrls
    .filter((glob) => glob.startsWith("!"))
    .map((glob) => glob.slice(1));
  return (
    include.some((glob) => globToRegExp(glob).test(url)) &&
    !exclude.some((glob) => globToRegExp(glob).test(url))
  );
}

describe("service worker config", () => {
  it("keeps server rendering first and uses the CSR shell only offline", () => {
    expect(config.index).toBe("/index.csr.html");
    expect(config.navigationRequestStrategy).toBe("freshness");
  });

  it.each([
    "/admin",
    "/admin/orders",
    "/api/v1/products",
    "/uploads/x.png",
    "/hy/payment/ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
    "/en/review/kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
    "/card-payment-test/hy",
  ])("never answers %s from the offline shell", (url) => {
    expect(servedFromShell(url)).toBe(false);
  });

  it.each(["/hy", "/ru/catalog", "/en/product/whey", "/hy/basket"])(
    "can show the offline shell for storefront page %s",
    (url) => {
      expect(servedFromShell(url)).toBe(true);
    },
  );

  it("caches only product images from the API, never data, orders or payments", () => {
    expect(config.dataGroups.flatMap((group) => group.urls)).toEqual([
      "/api/v1/media/**",
    ]);
    const assetFiles = config.assetGroups.flatMap(
      (group) => group.resources.files,
    );
    expect(assetFiles.some((file) => file.startsWith("/api"))).toBe(false);
    expect(assetFiles).toContain("!/ngsw-worker.js");
  });

  it("downloads app code once for offline use but not on every deploy", () => {
    const shell = config.assetGroups.find(
      (group) => group.name === "app-shell",
    );
    const chunks = config.assetGroups.find(
      (group) => group.name === "app-chunks",
    );
    expect(shell?.updateMode).toBe("prefetch");
    expect(chunks?.installMode).toBe("prefetch");
    // After an update, page code is fetched only when a page is opened.
    expect(chunks?.updateMode).toBe("lazy");
  });
});
