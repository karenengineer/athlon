import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { routes } from "../../../app.routes";
import { AdminSessionService } from "../auth/admin-session.service";
import { AdminI18nService } from "../shared/admin-i18n.service";
import { ProductImages } from "../media/product-images";

const id = "24d3f1a3-8413-4bc6-b32d-437871a22b54";
const other = "34d3f1a3-8413-4bc6-b32d-437871a22b54";
const category = {
  id,
  code: "nutrition",
  slug: "nutrition",
  published: false,
  translations: [{ locale: "HY", name: "Սնունդ" }],
};
const brand = {
  id: other,
  slug: "acme",
  name: "ACME",
  published: false,
  translations: [],
};
const image = {
  id,
  productId: id,
  originalKey: `${id}-original.webp`,
  thumbnailKey: `${id}-thumbnail.webp`,
  cardKey: `${id}-card.webp`,
  detailKey: `${id}-detail.webp`,
  mimeType: "image/webp",
  width: 32,
  height: 24,
  sizeBytes: 100,
  position: 0,
  primary: true,
  translations: [
    { locale: "RU", altText: "Фото" },
    { locale: "HY", altText: "Նկար" },
  ],
};
const product = {
  id,
  sku: "SKU-1",
  slug: "protein",
  categoryId: id,
  brandId: other,
  price: "15000.50",
  currency: "AMD",
  availability: "IN_STOCK",
  characteristics: { weight: "1kg" },
  featured: true,
  isNew: false,
  published: false,
  displayOrder: 4,
  translations: [
    {
      locale: "HY",
      name: "Սպիտակուց",
      shortDescription: null,
      description: null,
      seoTitle: null,
    },
    {
      locale: "RU",
      name: "Протеин",
      shortDescription: "Keep RU",
      description: "Keep description",
    },
  ],
  images: [image],
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};
const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  meta: { page, pageSize: 24, total: items.length, totalPages },
});

describe("Product administration real routed DOM / HTTP", () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AdminSessionService).user.set({
      id: "fixture-admin",
      email: "test@athlon.test",
      role: "ADMIN",
    });
    TestBed.inject(AdminI18nService).setLocale("en");
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => {
    try {
      http.verify();
    } finally {
      vi.restoreAllMocks();
      TestBed.resetTestingModule();
    }
  });
  const dom = () => harness.routeNativeElement!;
  const input = (selector: string, value: string) => {
    const element = dom().querySelector<HTMLInputElement>(selector)!;
    expect(element, selector).not.toBeNull();
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    harness.detectChanges();
  };
  const click = (selector: string) => {
    const element = dom().querySelector<HTMLButtonElement>(selector)!;
    expect(element, selector).not.toBeNull();
    element.click();
    harness.detectChanges();
  };
  const requestList = (resource: string) =>
    http.expectOne((req) => req.url === `/api/v1/admin/${resource}`);
  const options = () => {
    requestList("categories").flush(envelope([category]));
    requestList("brands").flush(envelope([brand]));
    harness.detectChanges();
  };
  const edit = async (value = product) => {
    await harness.navigateByUrl(`/admin/products/${value.id}/edit`);
    http.expectOne(`/api/v1/admin/products/${value.id}`).flush(value);
    options();
  };
  const submit = () => click("[data-product-save]");
  const file = (value: File) => {
    const element = dom().querySelector<HTMLInputElement>("#image-file")!;
    Object.defineProperty(element, "files", {
      value: [value],
      configurable: true,
    });
    element.dispatchEvent(new Event("change", { bubbles: true }));
    harness.detectChanges();
  };

  it("opens the guarded new editor with all unpublished administrative options", async () => {
    await harness.navigateByUrl("/admin/products/new");
    expect(dom().querySelector("#sku")).not.toBeNull();
    const categories = requestList("categories");
    expect(categories.request.params.get("pageSize")).toBe("100");
    expect(categories.request.params.has("published")).toBe(false);
    categories.flush(envelope([category], 1, 2));
    const rest = requestList("categories");
    expect(rest.request.params.get("page")).toBe("2");
    rest.flush(envelope([{ ...category, id: other }], 2, 2));
    const brands = requestList("brands");
    brands.flush(envelope([brand], 1, 2));
    requestList("brands").flush(envelope([{ ...brand, id }], 2, 2));
    harness.detectChanges();
    expect(dom().querySelectorAll("#categoryId option")).toHaveLength(3);
    expect(dom().querySelectorAll("#brandId option")).toHaveLength(3);
    expect(dom().querySelector("#categoryId")!.textContent).toContain("Draft");
    expect(dom().textContent).toContain("Save the product before uploading");
  });
  it("rejects negative/overprecision/nonfinite prices, non-object JSON, blank SKU and invalid slug", async () => {
    await edit();
    for (const [selector, values] of [
      ["#price", ["-1", "1.234", "10000000000"]],
      ["#characteristics", ["[1]", "null", "{bad}"]],
      ["#sku", ["   ", "x".repeat(101)]],
      ["#slug", ["UPPER", "double--hyphen", "x".repeat(181)]],
    ] as const) {
      const prior = dom().querySelector<HTMLInputElement>(selector)!.value;
      for (const value of values) {
        input(selector, value);
        submit();
        http.expectNone((req) => req.method === "PATCH");
        expect(
          dom().querySelector<HTMLButtonElement>("[data-product-save]")!
            .disabled,
        ).toBe(true);
      }
      input(selector, prior);
    }
    input("#translation-shortDescription-HY", "x".repeat(501));
    submit();
    http.expectNone((req) => req.method === "PATCH");
    input("#translation-shortDescription-HY", "");
    input("#translation-name-HY", " ");
    submit();
    http.expectNone((req) => req.method === "PATCH");
  });
  it("saves all DTO fields, numeric AMD/null and preserves untouched nullable/localized fields", async () => {
    await edit();
    input("#price", "");
    input("#sku", "NEW-SKU");
    input("#displayOrder", "-3");
    input("#availability", "PREORDER");
    input("#characteristics", '{"weight":"2kg","nested":{"safe":true}}');
    click("#featured");
    click("#isNew");
    click("#published");
    input("#translation-shortDescription-HY", "Նոր");
    submit();
    const req = http.expectOne(`/api/v1/admin/products/${id}`);
    expect(req.request.method).toBe("PATCH");
    expect(req.request.body).toEqual({
      sku: "NEW-SKU",
      slug: "protein",
      categoryId: id,
      brandId: other,
      price: null,
      availability: "PREORDER",
      characteristics: { weight: "2kg", nested: { safe: true } },
      featured: false,
      isNew: true,
      published: true,
      displayOrder: -3,
      translations: [
        {
          locale: "HY",
          name: "Սպիտակուց",
          shortDescription: "Նոր",
          description: null,
          seoTitle: null,
        },
        {
          locale: "RU",
          name: "Протеин",
          shortDescription: "Keep RU",
          description: "Keep description",
        },
      ],
    });
    req.flush({ ...product, ...req.request.body, price: null });
    harness.detectChanges();
    expect(dom().textContent).toContain("Saved");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
  it("previews unsaved text locally without HTML execution or public draft links", async () => {
    await edit();
    input("#translation-name-HY", "Unsaved name");
    input("#translation-description-HY", '<img src=x onerror="alert(1)">');
    click("[data-preview]");
    expect(dom().querySelector("[data-draft-preview]")!.textContent).toContain(
      "Unsaved name",
    );
    expect(dom().querySelector("[data-draft-preview]")!.textContent).toContain(
      "<img src=x",
    );
    expect(dom().querySelector("[data-draft-preview] img[src=x]")).toBeNull();
    expect(dom().querySelector("[data-public-product]")).toBeNull();
    http.expectNone((req) => req.method !== "GET");
    expect(
      dom().querySelector("[data-draft-preview] img")?.getAttribute("src"),
    ).toBe(`/api/v1/media/${id}-detail.webp`);
  });
  it("uses the product-only 220-character name limit without restricting existing category forms", async () => {
    await edit();
    input("#translation-name-HY", "x".repeat(221));
    submit();
    http.expectNone((req) => req.method === "PATCH");
    input("#translation-name-HY", "x".repeat(220));
    submit();
    const req = http.expectOne(`/api/v1/admin/products/${id}`);
    expect(req.request.body.translations[0].name).toHaveLength(220);
    req.flush(product);
  });
  it("warns before leaving unsaved product/alt data and refreshes after confirmed deletion", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    await edit();
    input(`#image-altEn-${id}`, "Unsaved alt");
    await harness.navigateByUrl("/admin/products");
    expect(TestBed.inject(Router).url).toBe(`/admin/products/${id}/edit`);
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    vi.mocked(window.confirm).mockReturnValue(true);
    await harness.navigateByUrl("/admin/products");
    options();
    requestList("products").flush(envelope([product]));
    harness.detectChanges();
    click("[data-delete]");
    click("[data-confirm]");
    http.expectOne(`/api/v1/admin/products/${id}`).flush(null);
    requestList("products").flush(envelope([]));
    harness.detectChanges();
    expect(dom().textContent).toContain("No matches");
  });
  it("cancels old detail reads on reused ID navigation and retries only the current entity", async () => {
    await harness.navigateByUrl(`/admin/products/${id}/edit`);
    const a = http.expectOne(`/api/v1/admin/products/${id}`);
    options();
    await harness.navigateByUrl(`/admin/products/${other}/edit`);
    expect(a.cancelled).toBe(true);
    http
      .expectOne(`/api/v1/admin/products/${other}`)
      .flush({}, { status: 500, statusText: "error" });
    options();
    expect(dom().querySelector("#sku")).toBeNull();
    click("[data-retry]");
    http
      .expectOne(`/api/v1/admin/products/${other}`)
      .flush({ ...product, id: other, sku: "Only B" });
    harness.detectChanges();
    expect(dom().querySelector<HTMLInputElement>("#sku")!.value).toBe("Only B");
  });
  it("creates a product before enabling uploads and links only persisted published products", async () => {
    await harness.navigateByUrl("/admin/products/new");
    options();
    input("#sku", "NEW");
    input("#slug", "new-product");
    input("#categoryId", id);
    input("#translation-name-HY", "Նոր");
    input("#price", "10.50");
    submit();
    const req = requestList("products");
    expect(req.request.method).toBe("POST");
    expect(req.request.body.price).toBe(10.5);
    expect(req.request.body.published).toBe(false);
    req.flush({ ...product, ...req.request.body, images: [] });
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toBe(`/admin/products/${id}/edit`),
    );
    http
      .expectOne(`/api/v1/admin/products/${id}`)
      .flush({ ...product, slug: "new-product", published: true });
    options();
    expect(
      dom().querySelector("[data-public-product]")!.getAttribute("href"),
    ).toBe("/en/product/new-product");
    expect(dom().querySelector("#image-file")).not.toBeNull();
  });
  it("restores validated product filters from URL, pages server-side and resets page on search", async () => {
    await harness.navigateByUrl(
      `/admin/products?page=2&pageSize=10&published=false&categoryId=${id}&brandId=${other}&availability=PREORDER&featured=false&isNew=true&sort=priceDesc&q=protein`,
    );
    options();
    const req = requestList("products");
    expect(
      Object.fromEntries(
        req.request.params
          .keys()
          .map((key) => [key, req.request.params.get(key)]),
      ),
    ).toEqual({
      page: "2",
      pageSize: "10",
      published: "false",
      categoryId: id,
      brandId: other,
      availability: "PREORDER",
      featured: "false",
      isNew: "true",
      sort: "priceDesc",
      q: "protein",
    });
    req.flush(envelope([product], 2, 3));
    harness.detectChanges();
    expect(dom().querySelector<HTMLInputElement>("#q")!.value).toBe("protein");
    input("#q", "new query");
    click("[data-search]");
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toContain("q=new%20query"),
    );
    const next = requestList("products");
    expect(next.request.params.get("page")).toBe("1");
    next.flush(envelope([]));
    harness.detectChanges();
    expect(dom().textContent).toContain("No matches");
  });
  it("ignores invalid enum/UUID/boolean/sort URL filters and handles retry without stale rows", async () => {
    await harness.navigateByUrl(
      "/admin/products?page=-1&pageSize=101&sort=evil&categoryId=bad&availability=evil&featured=yes",
    );
    options();
    const req = requestList("products");
    expect(req.request.params.get("page")).toBe("1");
    expect(req.request.params.get("sort")).toBe("order");
    expect(req.request.params.has("categoryId")).toBe(false);
    expect(req.request.params.has("availability")).toBe(false);
    expect(req.request.params.has("featured")).toBe(false);
    req.flush({}, { status: 500, statusText: "error" });
    harness.detectChanges();
    expect(dom().querySelector("tbody")).toBeNull();
    click("[data-retry]");
    requestList("products").flush(envelope([product]));
    harness.detectChanges();
    expect(dom().textContent).toContain("Сպիտակուց".replace("С", "Ս"));
  });
  it("requires named confirmation for deletion and maps dependency conflicts", async () => {
    await harness.navigateByUrl("/admin/products");
    options();
    requestList("products").flush(envelope([product]));
    harness.detectChanges();
    click("[data-delete]");
    expect(dom().querySelector("[role=dialog]")!.textContent).toContain(
      "Սպիտակուց",
    );
    click("[data-cancel]");
    http.expectNone((req) => req.method === "DELETE");
    click("[data-delete]");
    click("[data-confirm]");
    const req = http.expectOne(`/api/v1/admin/products/${id}`);
    expect(req.request.method).toBe("DELETE");
    req.flush({}, { status: 409, statusText: "Conflict" });
    harness.detectChanges();
    expect(dom().querySelector("[role=alert]")!.textContent).toContain(
      "Cannot delete",
    );
  });
  it("uploads exact multipart file/alt/primary fields and keeps failed upload retryable", async () => {
    await edit();
    file(new File(["raster"], "photo.png", { type: "image/png" }));
    input("#upload-altRu", "Фото новое");
    input("#upload-altHy", "Նոր նկար");
    input("#upload-altEn", "New image");
    click("#upload-primary");
    click("[data-upload]");
    const req = http.expectOne(`/api/v1/admin/products/${id}/images`);
    expect(
      dom().querySelector<HTMLButtonElement>("[data-product-save]")!.disabled,
    ).toBe(true);
    expect(req.request.body instanceof FormData).toBe(true);
    const body = req.request.body as FormData;
    expect((body.get("file") as File).name).toBe("photo.png");
    expect(body.get("altRu")).toBe("Фото новое");
    expect(body.get("altHy")).toBe("Նոր նկար");
    expect(body.get("altEn")).toBe("New image");
    expect(body.get("primary")).toBe("true");
    req.flush({}, { status: 500, statusText: "error" });
    harness.detectChanges();
    expect(dom().textContent).toContain("Could not save");
    click("[data-upload]");
    http
      .expectOne(`/api/v1/admin/products/${id}/images`)
      .flush({ ...image, id: other, primary: true, position: 1 });
    harness.detectChanges();
    expect(dom().querySelectorAll("[data-image-row]")).toHaveLength(2);
    expect(dom().querySelectorAll("[data-primary=true]")).toHaveLength(1);
  });
  it("rejects oversized/unsupported files before transport and accepts the exact size boundary", async () => {
    await edit();
    input("#upload-altRu", "Фото");
    for (const value of [
      new File(["<svg/>"], "fake.svg", { type: "image/svg+xml" }),
      new File([new Uint8Array(5_242_881)], "large.png", { type: "image/png" }),
    ]) {
      file(value);
      click("[data-upload]");
      http.expectNone((req) => req.method === "POST");
      expect(dom().textContent).toContain("JPEG, PNG or WebP");
    }
    file(
      new File([new Uint8Array(5_242_880)], "limit.png", { type: "image/png" }),
    );
    click("[data-upload]");
    http
      .expectOne(`/api/v1/admin/products/${id}/images`)
      .flush({ ...image, id: other, position: 1 });
    harness.detectChanges();
  });
  it("associates localized image validation with invalid fields for assistive technology", async () => {
    await edit();
    input("#upload-altRu", "x".repeat(251));
    expect(
      dom().querySelector("#upload-altRu")!.getAttribute("aria-invalid"),
    ).toBe("true");
    expect(
      dom().querySelector("#upload-altRu")!.getAttribute("aria-describedby"),
    ).toBe("upload-alt-error");
    input(`#image-altEn-${id}`, "x".repeat(251));
    expect(
      dom().querySelector(`#image-altEn-${id}`)!.getAttribute("aria-invalid"),
    ).toBe("true");
  });
  it("sends full ordered image positions and localized alt/primary patches and confirms image deletion", async () => {
    await edit({
      ...product,
      images: [image, { ...image, id: other, position: 1, primary: false }],
    });
    click(`[data-image-row="${other}"] [data-image-up]`);
    const order = http.expectOne(`/api/v1/admin/products/${id}/images/order`);
    expect(order.request.method).toBe("PATCH");
    expect(order.request.body).toEqual({
      images: [
        { id: other, position: 0 },
        { id, position: 1 },
      ],
    });
    order.flush(null);
    harness.detectChanges();
    input(`#image-altEn-${other}`, "Updated alt");
    click(`#image-primary-${other}`);
    click(`[data-image-row="${other}"] [data-image-save]`);
    const patch = http.expectOne(
      `/api/v1/admin/products/${id}/images/${other}`,
    );
    expect(patch.request.body).toEqual({
      altRu: "Фото",
      altHy: "Նկար",
      altEn: "Updated alt",
      primary: true,
    });
    patch.flush({
      ...image,
      id: other,
      position: 0,
      primary: true,
      translations: [{ locale: "EN", altText: "Updated alt" }],
    });
    harness.detectChanges();
    click(`[data-image-row="${other}"] [data-image-delete]`);
    expect(dom().querySelector("[role=dialog]")!.textContent).toContain(
      "Updated alt",
    );
    click("[data-cancel]");
    http.expectNone((req) => req.method === "DELETE");
  });
  for (const outcome of ["success", "error"] as const)
    it(`isolates delayed product save ${outcome} after accepted edit-ID navigation`, async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      await edit();
      input("#sku", "A pending");
      submit();
      const a = http.expectOne(`/api/v1/admin/products/${id}`);
      await harness.navigateByUrl(`/admin/products/${other}/edit`);
      http
        .expectOne(`/api/v1/admin/products/${other}`)
        .flush({ ...product, id: other, sku: "B", slug: "b-product" });
      options();
      input("#sku", "B pending");
      submit();
      const b = http.expectOne(`/api/v1/admin/products/${other}`);
      if (outcome === "success") a.flush({ ...product, sku: "A late" });
      else a.flush({}, { status: 409, statusText: "Conflict" });
      harness.detectChanges();
      expect(dom().querySelector<HTMLInputElement>("#sku")!.value).toBe(
        "B pending",
      );
      expect(
        dom().querySelector<HTMLButtonElement>("[data-product-save]")!.disabled,
      ).toBe(true);
      expect(dom().querySelector("[role=alert]")).toBeNull();
      b.flush({ ...product, id: other, sku: "B pending", slug: "b-product" });
      harness.detectChanges();
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
  it("retires an image upload completion after edit-ID navigation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await edit();
    file(new File(["raster"], "a.png", { type: "image/png" }));
    input("#upload-altRu", "A");
    click("[data-upload]");
    const a = http.expectOne(`/api/v1/admin/products/${id}/images`);
    await harness.navigateByUrl(`/admin/products/${other}/edit`);
    http
      .expectOne(`/api/v1/admin/products/${other}`)
      .flush({ ...product, id: other, images: [] });
    options();
    expect(a.cancelled).toBe(true);
    harness.detectChanges();
    expect(dom().querySelectorAll("[data-image-row]")).toHaveLength(0);
    expect(dom().querySelector<HTMLInputElement>("#upload-altRu")!.value).toBe(
      "",
    );
  });
  for (const outcome of ["success", "error"] as const)
    it(`isolates late upload ${outcome} when the same image manager is reused for a new product`, () => {
      const fixture = TestBed.createComponent(ProductImages);
      fixture.componentRef.setInput("productId", id);
      fixture.componentRef.setInput("images", []);
      fixture.detectChanges();
      const select = (name: string) => {
        const element = fixture.nativeElement.querySelector("#image-file");
        Object.defineProperty(element, "files", {
          value: [new File(["raster"], name, { type: "image/png" })],
          configurable: true,
        });
        element.dispatchEvent(new Event("change", { bubbles: true }));
        const alt = fixture.nativeElement.querySelector("#upload-altRu");
        alt.value = name;
        alt.dispatchEvent(new Event("input", { bubbles: true }));
        fixture.detectChanges();
        fixture.nativeElement.querySelector("[data-upload]").click();
        fixture.detectChanges();
      };
      select("a.png");
      const a = http.expectOne(`/api/v1/admin/products/${id}/images`);
      fixture.componentRef.setInput("productId", other);
      fixture.componentRef.setInput("images", []);
      fixture.detectChanges();
      select("b.png");
      const b = http.expectOne(`/api/v1/admin/products/${other}/images`);
      if (outcome === "success") a.flush(image);
      else a.flush({}, { status: 500, statusText: "error" });
      fixture.detectChanges();
      expect(fixture.componentInstance.busy()).toBe(true);
      expect(fixture.componentInstance.error()).toBeNull();
      expect(fixture.nativeElement.querySelector("#upload-altRu").value).toBe(
        "b.png",
      );
      expect(fixture.componentInstance.images).toEqual([]);
      b.flush({ ...image, productId: other });
      fixture.detectChanges();
      expect(fixture.componentInstance.busy()).toBe(false);
      expect(fixture.componentInstance.images[0]?.productId).toBe(other);
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
      fixture.destroy();
    });
});
