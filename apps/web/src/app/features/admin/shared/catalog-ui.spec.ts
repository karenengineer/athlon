import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { CategoryEditor } from "../categories/category-editor";
import { CategoryList } from "../categories/category-list";
import { BrandEditor } from "../brands/brand-editor";
import { BrandList } from "../brands/brand-list";
import { AdminI18nService } from "./admin-i18n.service";
import { adminDirtyFormGuard } from "./admin-dirty-form.guard";

const id = "24d3f1a3-8413-4bc6-b32d-437871a22b54";
const child = "34d3f1a3-8413-4bc6-b32d-437871a22b54";
const other = "44d3f1a3-8413-4bc6-b32d-437871a22b54";
const category = {
  id,
  code: "nutrition",
  slug: "nutrition",
  parentId: null,
  published: false,
  displayOrder: 2,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  translations: [
    {
      locale: "HY",
      name: "Սնունդ",
      description: null,
      seoTitle: null,
      seoDescription: "Existing SEO",
    },
    { locale: "RU", name: "Питание", description: "Keep Russian" },
  ],
};
const brand = {
  id,
  slug: "acme",
  name: "ACME",
  logoKey: null,
  published: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  translations: [
    { locale: "HY", name: "ԱՔՄԵ", description: null },
    { locale: "EN", name: "ACME", description: "Keep English" },
  ],
};
const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  meta: { page, pageSize: 24, total: items.length, totalPages },
});

describe("admin catalog DOM / HTTP contracts", () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: "admin/categories/new",
            component: CategoryEditor,
            canDeactivate: [adminDirtyFormGuard],
          },
          {
            path: "admin/categories/:id",
            component: CategoryEditor,
            canDeactivate: [adminDirtyFormGuard],
          },
          { path: "admin/categories", component: CategoryList },
          {
            path: "admin/brands/new",
            component: BrandEditor,
            canDeactivate: [adminDirtyFormGuard],
          },
          {
            path: "admin/brands/:id",
            component: BrandEditor,
            canDeactivate: [adminDirtyFormGuard],
          },
          { path: "admin/brands", component: BrandList },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AdminI18nService).setLocale("en");
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => {
    try {
      http.verify();
    } finally {
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
  const listRequest = (resource: string) =>
    http.expectOne((request) => request.url === `/api/v1/admin/${resource}`);

  it("creates a category with validated DOM inputs and uppercase independent translation tabs", async () => {
    await harness.navigateByUrl("/admin/categories/new");
    listRequest("categories").flush(envelope([]));
    harness.detectChanges();
    expect(
      dom().querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
    ).toBe(true);
    input("#code", "new-category");
    input("#slug", "new-category");
    input("#translation-name-HY", "Նոր");
    click("#translation-tab-RU");
    input("#translation-name-RU", "Новая");
    click("#translation-tab-EN");
    input("#translation-name-EN", "New");
    click("button[type=submit]");
    const request = listRequest("categories");
    expect(request.request.method).toBe("POST");
    expect(
      request.request.body.translations.map(
        (item: { locale: string }) => item.locale,
      ),
    ).toEqual(["HY", "RU", "EN"]);
    expect(request.request.body.code).toBe("new-category");
    request.flush({ ...category, code: "new-category" });
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toBe(`/admin/categories/${id}`),
    );
    http
      .match((request) => request.url.startsWith("/api/v1/admin/categories"))
      .forEach((request) =>
        request.flush(
          request.request.url.endsWith(id) ? category : envelope([]),
        ),
      );
  });

  it("preserves unseen existing category translation optional/null fields on PATCH", async () => {
    await harness.navigateByUrl(`/admin/categories/${id}`);
    http.expectOne(`/api/v1/admin/categories/${id}`).flush(category);
    listRequest("categories").flush(envelope([]));
    harness.detectChanges();
    input("#slug", "changed-slug");
    click("button[type=submit]");
    const request = http.expectOne(`/api/v1/admin/categories/${id}`);
    expect(request.request.method).toBe("PATCH");
    expect(request.request.body.translations).toEqual(category.translations);
    expect(request.request.body.published).toBe(false);
    request.flush({ ...category, slug: "changed-slug" });
    harness.detectChanges();
    expect(dom().textContent).toContain("Saved");
  });

  it("loads all administrative parent pages including drafts and excludes self/descendants", async () => {
    await harness.navigateByUrl(`/admin/categories/${id}`);
    http.expectOne(`/api/v1/admin/categories/${id}`).flush(category);
    const page1 = listRequest("categories");
    expect(page1.request.params.has("published")).toBe(false);
    expect(page1.request.params.get("pageSize")).toBe("100");
    page1.flush(
      envelope([category, { ...category, id: child, parentId: id }], 1, 2),
    );
    const page2 = listRequest("categories");
    expect(page2.request.params.get("page")).toBe("2");
    page2.flush(
      envelope(
        [
          { ...category, id: other, parentId: child },
          {
            ...category,
            id: "54d3f1a3-8413-4bc6-b32d-437871a22b54",
            code: "draft-parent",
          },
        ],
        2,
        2,
      ),
    );
    harness.detectChanges();
    const values = Array.from(
      dom().querySelectorAll<HTMLOptionElement>("#parentId option"),
    ).map((option) => option.value);
    expect(values).toEqual(["", "54d3f1a3-8413-4bc6-b32d-437871a22b54"]);
  });

  it("requires existing names and shows errors on their own translation tabs", async () => {
    await harness.navigateByUrl(`/admin/categories/${id}`);
    http.expectOne(`/api/v1/admin/categories/${id}`).flush(category);
    listRequest("categories").flush(envelope([]));
    harness.detectChanges();
    click("#translation-tab-RU");
    input("#translation-name-RU", "   ");
    expect(
      dom().querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
    ).toBe(true);
    expect(dom().querySelector("#translation-tab-RU")!.textContent).toContain(
      "!",
    );
    http.expectNone((request) => request.method === "PATCH");
  });

  it("creates a brand with optional empty locales omitted and no category-only fields", async () => {
    await harness.navigateByUrl("/admin/brands/new");
    expect(
      dom().querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
    ).toBe(true);
    input("#name", "Brand");
    input("#slug", "brand");
    input("#logoKey", "brands/acme.png");
    input("#translation-name-HY", "Բրենդ");
    click("button[type=submit]");
    const request = listRequest("brands");
    expect(request.request.body).toEqual({
      name: "Brand",
      slug: "brand",
      logoKey: "brands/acme.png",
      published: true,
      translations: [{ locale: "HY", name: "Բրենդ" }],
    });
    request.flush(brand);
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toBe(`/admin/brands/${id}`),
    );
    http.expectOne(`/api/v1/admin/brands/${id}`).flush(brand);
  });

  it("updates brand metadata without changing unseen locales or null logo", async () => {
    await harness.navigateByUrl(`/admin/brands/${id}`);
    http.expectOne(`/api/v1/admin/brands/${id}`).flush(brand);
    harness.detectChanges();
    input("#name", "New brand");
    click("button[type=submit]");
    const request = http.expectOne(`/api/v1/admin/brands/${id}`);
    expect(request.request.method).toBe("PATCH");
    expect(request.request.body.translations).toEqual(brand.translations);
    expect(request.request.body.logoKey).toBeNull();
    request.flush({ ...brand, name: "New brand" });
  });

  it("previews only local unsaved data and prevents unload while dirty", async () => {
    await harness.navigateByUrl(`/admin/brands/${id}`);
    http.expectOne(`/api/v1/admin/brands/${id}`).flush(brand);
    harness.detectChanges();
    input("#translation-name-HY", "Local draft");
    click("[data-preview]");
    expect(dom().querySelector("[data-draft-preview]")!.textContent).toContain(
      "Local draft",
    );
    expect(dom().querySelector("[data-draft-preview] img")).toBeNull();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    http.expectNone((request) => request.method !== "GET");
  });

  it.each([
    [400, "Check the fields"],
    [409, "slug or code"],
    [500, "Could not save"],
  ])(
    "shows safe actionable save errors for HTTP %s",
    async (status, message) => {
      await harness.navigateByUrl(`/admin/brands/${id}`);
      http.expectOne(`/api/v1/admin/brands/${id}`).flush(brand);
      harness.detectChanges();
      input("#name", "Changed");
      click("button[type=submit]");
      http
        .expectOne(`/api/v1/admin/brands/${id}`)
        .flush(
          { message: "private database contents" },
          { status, statusText: "Rejected" },
        );
      harness.detectChanges();
      expect(dom().querySelector("[role=alert]")!.textContent).toContain(
        message,
      );
      expect(dom().textContent).not.toContain("private database contents");
      expect(
        dom().querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
      ).toBe(false);
    },
  );

  it.each(["categories", "brands"])(
    "restores %s list filters/pagination from URL and clears to page one",
    async (resource) => {
      await harness.navigateByUrl(
        `/admin/${resource}?q=protein&published=false&sort=updated&page=2&pageSize=10`,
      );
      const request = listRequest(resource);
      expect(request.request.params.get("q")).toBe("protein");
      expect(request.request.params.get("published")).toBe("false");
      expect(request.request.params.get("page")).toBe("2");
      expect(request.request.params.get("pageSize")).toBe("10");
      expect(request.request.params.get("sort")).toBe("updated");
      request.flush(envelope([], 2, 3));
      harness.detectChanges();
      expect(dom().querySelector<HTMLInputElement>("#q")!.value).toBe(
        "protein",
      );
      click("[data-clear]");
      await vi.waitFor(() =>
        expect(TestBed.inject(Router).url).toBe(`/admin/${resource}`),
      );
      const cleared = listRequest(resource);
      expect(cleared.request.params.has("q")).toBe(false);
      expect(cleared.request.params.has("published")).toBe(false);
      expect(cleared.request.params.get("page")).toBe("1");
      cleared.flush(envelope([]));
    },
  );

  it("submits server search and publication/sort filters resetting page", async () => {
    await harness.navigateByUrl("/admin/categories?page=3");
    listRequest("categories").flush(envelope([], 3, 4));
    harness.detectChanges();
    input("#q", "creatine");
    input("#published", "true");
    input("#sort", "name");
    click("[data-search]");
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toContain("q=creatine"),
    );
    const request = listRequest("categories");
    expect(request.request.params.get("page")).toBe("1");
    expect(request.request.params.get("sort")).toBe("name");
    request.flush(envelope([]));
  });

  it.each(["categories", "brands"])(
    "names %s deletion and cancels with Escape without DELETE",
    async (resource) => {
      await harness.navigateByUrl(`/admin/${resource}`);
      listRequest(resource).flush(
        envelope([resource === "brands" ? brand : category]),
      );
      harness.detectChanges();
      const opener = dom().querySelector<HTMLButtonElement>("[data-delete]")!;
      opener.focus();
      opener.click();
      harness.detectChanges();
      const dialog = dom().querySelector<HTMLElement>("[role=dialog]")!;
      expect(dialog.textContent).toContain(
        resource === "brands" ? "ACME" : "Սնունդ",
      );
      expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
      await vi.waitFor(() =>
        expect(
          document.activeElement?.getAttribute("data-cancel"),
        ).not.toBeNull(),
      );
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      harness.detectChanges();
      expect(dom().querySelector("[role=dialog]")).toBeNull();
      expect(document.activeElement).toBe(opener);
      http.expectNone((request) => request.method === "DELETE");
    },
  );

  it("deletes only after confirmation and refreshes the same page", async () => {
    await harness.navigateByUrl("/admin/brands?page=2");
    listRequest("brands").flush(envelope([brand], 2, 2));
    harness.detectChanges();
    click("[data-delete]");
    click("[data-confirm]");
    const request = http.expectOne(`/api/v1/admin/brands/${id}`);
    expect(request.request.method).toBe("DELETE");
    request.flush(null, { status: 204, statusText: "No Content" });
    const refreshed = listRequest("brands");
    expect(refreshed.request.params.get("page")).toBe("2");
    refreshed.flush(envelope([brand], 2, 2));
  });

  it("explains dependent deletion conflicts without removing the persisted row", async () => {
    await harness.navigateByUrl("/admin/categories");
    listRequest("categories").flush(envelope([category]));
    harness.detectChanges();
    click("[data-delete]");
    click("[data-confirm]");
    http
      .expectOne(`/api/v1/admin/categories/${id}`)
      .flush({}, { status: 409, statusText: "Conflict" });
    harness.detectChanges();
    expect(dom().querySelector("[role=alert]")!.textContent).toContain(
      "dependent",
    );
    expect(dom().querySelector("[data-delete]")).not.toBeNull();
  });

  it("shows loading, error/retry, empty states and all three UI locales", async () => {
    await harness.navigateByUrl("/admin/brands");
    expect(dom().textContent).toContain("Loading");
    listRequest("brands").flush({}, { status: 500, statusText: "Error" });
    harness.detectChanges();
    expect(dom().querySelector("[role=alert]")).not.toBeNull();
    click("[data-retry]");
    listRequest("brands").flush(envelope([]));
    harness.detectChanges();
    expect(dom().textContent).toContain("No matches");
    for (const [locale, label] of [
      ["hy", "Ապրանքանիշեր"],
      ["ru", "Бренды"],
      ["en", "Brands"],
    ]) {
      TestBed.inject(AdminI18nService).setLocale(locale);
      harness.detectChanges();
      expect(dom().querySelector("h1")!.textContent).toBe(label);
    }
  });

  it.each(["categories", "brands"])(
    "cancels stale %s details on reused editor route",
    async (resource) => {
      await harness.navigateByUrl(`/admin/${resource}/${id}`);
      const stale = http.expectOne(`/api/v1/admin/${resource}/${id}`);
      if (resource === "categories") listRequest(resource).flush(envelope([]));
      await harness.navigateByUrl(`/admin/${resource}/${other}`);
      expect(stale.cancelled).toBe(true);
      const current = http.expectOne(`/api/v1/admin/${resource}/${other}`);
      current.flush(
        resource === "categories"
          ? { ...category, id: other, slug: "other" }
          : { ...brand, id: other, slug: "other" },
      );
      if (resource === "categories") listRequest(resource).flush(envelope([]));
      harness.detectChanges();
      expect(dom().querySelector<HTMLInputElement>("#slug")!.value).toBe(
        "other",
      );
    },
  );

  it.each(["categories", "brands"])(
    "retries %s editor load and stops saves until persisted detail is loaded",
    async (resource) => {
      await harness.navigateByUrl(`/admin/${resource}/${id}`);
      http
        .expectOne(`/api/v1/admin/${resource}/${id}`)
        .flush({}, { status: 404, statusText: "Not Found" });
      if (resource === "categories") listRequest(resource).flush(envelope([]));
      harness.detectChanges();
      expect(dom().querySelector("button[type=submit]")).toBeNull();
      click("[data-retry]");
      http
        .expectOne(`/api/v1/admin/${resource}/${id}`)
        .flush(resource === "categories" ? category : brand);
      harness.detectChanges();
      expect(dom().querySelector<HTMLInputElement>("#slug")!.value).toBe(
        resource === "categories" ? "nutrition" : "acme",
      );
    },
  );

  it("blocks category saving until all parent options load and offers a parent retry", async () => {
    await harness.navigateByUrl(`/admin/categories/${id}`);
    http.expectOne(`/api/v1/admin/categories/${id}`).flush(category);
    listRequest("categories").flush({}, { status: 500, statusText: "Error" });
    harness.detectChanges();
    expect(
      dom().querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
    ).toBe(true);
    dom().querySelector<HTMLButtonElement>("[role=alert] button")!.click();
    harness.detectChanges();
    listRequest("categories").flush(envelope([]));
    harness.detectChanges();
    expect(
      dom().querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
    ).toBe(false);
  });

  it("validates category slug/code/order and translation SEO limits before transport", async () => {
    await harness.navigateByUrl(`/admin/categories/${id}`);
    http.expectOne(`/api/v1/admin/categories/${id}`).flush(category);
    listRequest("categories").flush(envelope([]));
    harness.detectChanges();
    for (const [selector, invalid, valid] of [
      ["#code", "Invalid_code", "nutrition"],
      ["#code", "a".repeat(81), "nutrition"],
      ["#slug", "two--hyphens", "nutrition"],
      ["#slug", "a".repeat(161), "nutrition"],
      ["#displayOrder", "1.5", "0"],
      ["#translation-name-HY", "a".repeat(181), "Սնունդ"],
      ["#translation-seoTitle-HY", "a".repeat(181), ""],
      ["#translation-seoDescription-HY", "a".repeat(321), "Existing SEO"],
    ]) {
      input(selector, invalid);
      expect(
        dom().querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
        selector,
      ).toBe(true);
      input(selector, valid);
    }
    expect(
      dom().querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
    ).toBe(false);
    http.expectNone((request) => request.method !== "GET");
  });

  it("rejects nonblank optional translation content without a required name", async () => {
    await harness.navigateByUrl(`/admin/brands/${id}`);
    http.expectOne(`/api/v1/admin/brands/${id}`).flush(brand);
    harness.detectChanges();
    click("#translation-tab-RU");
    input("#translation-description-RU", "Description without name");
    expect(
      dom().querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
    ).toBe(true);
    http.expectNone((request) => request.method !== "GET");
  });

  it("uses keyboard translation selection and traps deletion focus until cancellation", async () => {
    await harness.navigateByUrl(`/admin/brands/${id}`);
    http.expectOne(`/api/v1/admin/brands/${id}`).flush(brand);
    harness.detectChanges();
    const tab = dom().querySelector<HTMLButtonElement>("#translation-tab-HY")!;
    tab.focus();
    tab.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    harness.detectChanges();
    expect(document.activeElement?.id).toBe("translation-tab-RU");
    expect(
      dom().querySelector("#translation-tab-RU")!.getAttribute("aria-selected"),
    ).toBe("true");
    await harness.navigateByUrl("/admin/brands");
    listRequest("brands").flush(envelope([brand]));
    harness.detectChanges();
    click("[data-delete]");
    const dialog = dom().querySelector<HTMLElement>("[role=dialog]")!;
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(document.activeElement?.hasAttribute("data-confirm")).toBe(true);
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(document.activeElement?.hasAttribute("data-cancel")).toBe(true);
    click("[data-cancel]");
    expect(dom().querySelector("[role=dialog]")).toBeNull();
    http.expectNone((request) => request.method === "DELETE");
  });

  it("changes list pagination through DOM and preserves filters", async () => {
    await harness.navigateByUrl("/admin/brands?q=acme");
    listRequest("brands").flush(envelope([brand], 1, 2));
    harness.detectChanges();
    const buttons =
      dom().querySelectorAll<HTMLButtonElement>(".pagination button");
    expect(buttons[0].disabled).toBe(true);
    buttons[1].click();
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toContain("page=2"),
    );
    const request = listRequest("brands");
    expect(request.request.params.get("q")).toBe("acme");
    expect(request.request.params.get("page")).toBe("2");
    request.flush(envelope([brand], 2, 2));
  });

  it("corrects a now-empty deleted last page without discarding filters", async () => {
    await harness.navigateByUrl("/admin/brands?q=acme&page=2");
    listRequest("brands").flush(envelope([brand], 2, 2));
    harness.detectChanges();
    click("[data-delete]");
    click("[data-confirm]");
    http
      .expectOne(`/api/v1/admin/brands/${id}`)
      .flush(null, { status: 204, statusText: "No Content" });
    listRequest("brands").flush(envelope([], 2, 1));
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toBe("/admin/brands?q=acme"),
    );
    const request = listRequest("brands");
    expect(request.request.params.get("page")).toBe("1");
    request.flush(envelope([brand]));
  });

  it("keeps logo keys as text without injecting remote URLs or HTML in draft previews", async () => {
    await harness.navigateByUrl(`/admin/brands/${id}`);
    http.expectOne(`/api/v1/admin/brands/${id}`).flush(brand);
    harness.detectChanges();
    input("#logoKey", "https://unsafe.example/logo.svg");
    input("#translation-name-HY", "<img src=x onerror=alert(1)>");
    click("[data-preview]");
    expect(dom().querySelector("[data-draft-preview] img")).toBeNull();
    expect(dom().querySelector("[data-draft-preview]")!.textContent).toContain(
      "<img src=x onerror=alert(1)>",
    );
    http.expectNone((request) => request.url.startsWith("https://"));
  });

  it("bounds restored server search to the DTO's 120-character maximum", async () => {
    await harness.navigateByUrl(`/admin/brands?q=${"a".repeat(121)}`);
    const request = listRequest("brands");
    expect(request.request.params.get("q")).toBe("a".repeat(120));
    request.flush(envelope([]));
  });

  it("does not present stale rows as results after a changed filter fails", async () => {
    await harness.navigateByUrl("/admin/brands");
    listRequest("brands").flush(envelope([brand]));
    harness.detectChanges();
    input("#q", "not-found");
    click("[data-search]");
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toContain("q=not-found"),
    );
    listRequest("brands").flush({}, { status: 500, statusText: "Error" });
    harness.detectChanges();
    expect(dom().querySelector("[role=alert]")).not.toBeNull();
    expect(dom().querySelector("tbody")).toBeNull();
  });

  it("provides associated inline feedback for an overlong logo key", async () => {
    await harness.navigateByUrl(`/admin/brands/${id}`);
    http.expectOne(`/api/v1/admin/brands/${id}`).flush(brand);
    harness.detectChanges();
    input("#logoKey", "a".repeat(501));
    expect(
      dom().querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
    ).toBe(true);
    expect(dom().querySelector("#logo-error")!.textContent).toContain("500");
    expect(dom().querySelector("#logoKey")!.getAttribute("aria-invalid")).toBe(
      "true",
    );
    http.expectNone((request) => request.method !== "GET");
  });

  it("preserves list URL filters through editor navigation and its explicit back link", async () => {
    await harness.navigateByUrl("/admin/brands?q=acme&page=2&pageSize=7");
    listRequest("brands").flush(envelope([brand], 2, 2));
    harness.detectChanges();
    const size = dom().querySelector<HTMLSelectElement>("#pageSize")!;
    expect(size.selectedOptions[0].textContent?.trim()).toBe("7");
    const edit = dom().querySelector<HTMLAnchorElement>("td.actions a")!;
    expect(edit.getAttribute("href")).toBe(
      `/admin/brands/${id}?q=acme&page=2&pageSize=7`,
    );
    edit.click();
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toContain(`/admin/brands/${id}`),
    );
    http.expectOne(`/api/v1/admin/brands/${id}`).flush(brand);
    harness.detectChanges();
    click(".heading a");
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toBe(
        "/admin/brands?q=acme&page=2&pageSize=7",
      ),
    );
    const restored = listRequest("brands");
    expect(restored.request.params.get("pageSize")).toBe("7");
    expect(restored.request.params.get("page")).toBe("2");
    restored.flush(envelope([brand], 2, 2));
  });

  it.each(["categories", "brands"])(
    "isolates delayed successful %s PATCH from the next editor ID and save payload",
    async (resource) => {
      const first = resource === "categories" ? category : brand;
      const second =
        resource === "categories"
          ? {
              ...category,
              id: other,
              code: "category-b",
              slug: "entity-b",
              published: true,
              displayOrder: 9,
              translations: [
                {
                  locale: "HY",
                  name: "Category B",
                  description: null,
                  seoTitle: "B SEO",
                  seoDescription: null,
                },
                {
                  locale: "EN",
                  name: "Category B EN",
                  description: "B description",
                },
              ],
            }
          : {
              ...brand,
              id: other,
              name: "Brand B",
              slug: "entity-b",
              logoKey: "brands/b.png",
              published: false,
              translations: [
                { locale: "HY", name: "Brand B", description: null },
                {
                  locale: "EN",
                  name: "Brand B EN",
                  description: "B description",
                },
              ],
            };
      await harness.navigateByUrl(`/admin/${resource}/${id}`);
      http.expectOne(`/api/v1/admin/${resource}/${id}`).flush(first);
      if (resource === "categories") listRequest(resource).flush(envelope([]));
      harness.detectChanges();
      input("#slug", "entity-a-edit");
      click("button[type=submit]");
      const oldPatch = http.expectOne(`/api/v1/admin/${resource}/${id}`);
      expect(oldPatch.request.method).toBe("PATCH");
      const discard = vi.spyOn(window, "confirm").mockReturnValue(true);
      try {
        await harness.navigateByUrl(`/admin/${resource}/${other}`);
        expect(discard).toHaveBeenCalledTimes(1);
        http.expectOne(`/api/v1/admin/${resource}/${other}`).flush(second);
        if (resource === "categories")
          listRequest(resource).flush(envelope([]));
        harness.detectChanges();
        // The old server mutation may still finish: cancellation is not an undo.
        expect(oldPatch.cancelled).toBe(false);
        oldPatch.flush({ ...first, slug: "entity-a-edit" });
        harness.detectChanges();
        expect(TestBed.inject(Router).url).toBe(`/admin/${resource}/${other}`);
        expect(dom().querySelector<HTMLInputElement>("#slug")!.value).toBe(
          "entity-b",
        );
        expect(
          dom().querySelector<HTMLInputElement>("#translation-name-HY")!.value,
        ).toBe(resource === "categories" ? "Category B" : "Brand B");
        expect(dom().textContent).not.toContain("Saved");
        expect(dom().querySelector("[role=alert]")).toBeNull();
        const cleanUnload = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(cleanUnload);
        expect(cleanUnload.defaultPrevented).toBe(false);
        input("#slug", "entity-b-edit");
        click("button[type=submit]");
        const nextPatch = http.expectOne(`/api/v1/admin/${resource}/${other}`);
        expect(nextPatch.request.method).toBe("PATCH");
        expect(nextPatch.request.body.slug).toBe("entity-b-edit");
        expect(nextPatch.request.body.translations).toEqual(
          second.translations,
        );
        expect(nextPatch.request.body.published).toBe(
          resource === "categories",
        );
        if (resource === "categories") {
          expect(nextPatch.request.body.code).toBe("category-b");
          expect(nextPatch.request.body.displayOrder).toBe(9);
        } else {
          expect(nextPatch.request.body.name).toBe("Brand B");
          expect(nextPatch.request.body.logoKey).toBe("brands/b.png");
        }
        nextPatch.flush({ ...second, slug: "entity-b-edit" });
        harness.detectChanges();
        expect(dom().textContent).toContain("Saved");
      } finally {
        discard.mockRestore();
      }
    },
  );

  it.each(["categories", "brands"])(
    "ignores a retired %s PATCH error without clearing the current editor's pending save",
    async (resource) => {
      const first = resource === "categories" ? category : brand;
      const second = {
        ...first,
        id: other,
        slug: "entity-b",
        translations: [{ locale: "HY", name: "Entity B", description: null }],
      };
      await harness.navigateByUrl(`/admin/${resource}/${id}`);
      http.expectOne(`/api/v1/admin/${resource}/${id}`).flush(first);
      if (resource === "categories") listRequest(resource).flush(envelope([]));
      harness.detectChanges();
      input("#slug", "entity-a-edit");
      click("button[type=submit]");
      const oldPatch = http.expectOne(`/api/v1/admin/${resource}/${id}`);
      const discard = vi.spyOn(window, "confirm").mockReturnValue(true);
      try {
        await harness.navigateByUrl(`/admin/${resource}/${other}`);
        expect(discard).toHaveBeenCalledTimes(1);
        http.expectOne(`/api/v1/admin/${resource}/${other}`).flush(second);
        if (resource === "categories")
          listRequest(resource).flush(envelope([]));
        harness.detectChanges();
        expect(
          dom().querySelector<HTMLButtonElement>("button[type=submit]")!
            .disabled,
        ).toBe(false);
        input("#slug", "entity-b-edit");
        click("button[type=submit]");
        const currentPatch = http.expectOne(
          `/api/v1/admin/${resource}/${other}`,
        );
        expect(currentPatch.request.method).toBe("PATCH");
        expect(currentPatch.request.body.translations).toEqual([
          { locale: "HY", name: "Entity B", description: null },
        ]);
        oldPatch.flush(
          { message: "Retired A conflict" },
          { status: 409, statusText: "Conflict" },
        );
        harness.detectChanges();
        expect(dom().querySelector("[role=alert]")).toBeNull();
        expect(
          dom().querySelector<HTMLButtonElement>("button[type=submit]")!
            .disabled,
        ).toBe(true);
        expect(
          dom().querySelector<HTMLFieldSetElement>("fieldset")!.disabled,
        ).toBe(true);
        expect(dom().querySelector<HTMLInputElement>("#slug")!.value).toBe(
          "entity-b-edit",
        );
        const dirtyUnload = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(dirtyUnload);
        expect(dirtyUnload.defaultPrevented).toBe(true);
        currentPatch.flush({ ...second, slug: "entity-b-edit" });
        harness.detectChanges();
        expect(
          dom().querySelector<HTMLButtonElement>("button[type=submit]")!
            .disabled,
        ).toBe(false);
        expect(dom().textContent).toContain("Saved");
      } finally {
        discard.mockRestore();
      }
    },
  );
});
