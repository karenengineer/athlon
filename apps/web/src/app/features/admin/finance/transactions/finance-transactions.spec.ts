import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { routes } from "../../../../app.routes";
import { AdminSessionService } from "../../auth/admin-session.service";
import { AdminI18nService } from "../../shared/admin-i18n.service";

const productId = "24d3f1a3-8413-4bc6-b32d-437871a22b54";
const otherProductId = "34d3f1a3-8413-4bc6-b32d-437871a22b54";
const supplierId = "44d3f1a3-8413-4bc6-b32d-437871a22b54";
const transactionId = "54d3f1a3-8413-4bc6-b32d-437871a22b54";

const product = {
  productId,
  sku: "WHEY-1",
  name: "Whey Protein",
  category: { id: "64d3f1a3-8413-4bc6-b32d-437871a22b54", name: "Nutrition" },
  suppliers: [{ id: supplierId, name: "Fit Supply" }],
  defaultSalePrice: "18000",
  weightedAverageBuyPrice: "12000",
  totalPurchased: 10,
  totalSold: 8,
  currentStock: 2,
  lowStockThreshold: 3,
  stockStatus: "LOW_STOCK",
  profitPerUnit: "6000",
  marginPercent: "33.33",
  inventoryValue: "24000",
  unitsSold: 8,
  realizedRevenue: "144000",
  realizedCostOfGoodsSold: "96000",
  realizedGrossProfit: "48000",
  realizedGrossMarginPercent: "33.33",
};

const otherProduct = {
  ...product,
  productId: otherProductId,
  sku: "BAR-1",
  name: "Protein Bar",
  stockStatus: "IN_STOCK",
  currentStock: 20,
};

const supplier = {
  id: supplierId,
  name: "Fit Supply",
  contactName: "Ani",
  phone: "+37400000000",
  email: "ani@example.test",
  notes: null,
  active: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  meta: { page, pageSize: 24, total: items.length, totalPages },
});

describe("finance transaction admin pages", () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AdminSessionService).user.set({
      id: "admin-fixture",
      email: "fixture@athlon.test",
      role: "ADMIN",
    });
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
  const financeRequest = (resource: string) =>
    http.expectOne(
      (request) => request.url === `/api/v1/admin/finance/${resource}`,
    );
  const input = (selector: string, value: string) => {
    const element = dom().querySelector<HTMLInputElement | HTMLSelectElement>(
      selector,
    );
    expect(element, selector).not.toBeNull();
    element!.value = value;
    element!.dispatchEvent(new Event("input", { bubbles: true }));
    element!.dispatchEvent(new Event("change", { bubbles: true }));
    harness.detectChanges();
  };
  const click = (selector: string) => {
    const element = dom().querySelector<HTMLButtonElement>(selector);
    expect(element, selector).not.toBeNull();
    element!.click();
    harness.detectChanges();
  };

  it("shows all finance product columns, a textual low-stock state, and URL-backed filters", async () => {
    await harness.navigateByUrl(
      "/admin/finance/products?q=whey&stockStatus=LOW_STOCK&sort=stockAsc&page=2&pageSize=10",
    );
    const request = financeRequest("products");
    expect(request.request.params.get("q")).toBe("whey");
    expect(request.request.params.get("stockStatus")).toBe("LOW_STOCK");
    expect(request.request.params.get("sort")).toBe("stockAsc");
    expect(request.request.params.get("page")).toBe("2");
    expect(request.request.params.get("pageSize")).toBe("10");
    request.flush(envelope([product], 2, 3));
    harness.detectChanges();

    const headings = Array.from(dom().querySelectorAll("th"), (cell) =>
      cell.textContent?.trim(),
    );
    expect(headings).toEqual(
      expect.arrayContaining([
        "SKU",
        "Product",
        "Category",
        "Supplier",
        "Default sale price",
        "Average buy price",
        "Purchased",
        "Sold",
        "Current stock",
        "Profit / unit",
        "Margin",
        "Inventory value",
        "Realized gross profit",
      ]),
    );
    expect(dom().textContent).toContain("Low stock");
    expect(
      dom().querySelector("tr[data-stock-status=LOW_STOCK]"),
    ).not.toBeNull();

    input("#q", "bar");
    click("[data-search]");
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toContain("q=bar"),
    );
    expect(TestBed.inject(Router).url).not.toContain("page=2");
    financeRequest("products").flush(envelope([]));
  });

  it("adds and removes purchase rows, calculates line totals, and rejects duplicate products locally", async () => {
    await harness.navigateByUrl("/admin/finance/purchases/new");
    const products = financeRequest("products");
    expect(products.request.params.get("pageSize")).toBe("100");
    products.flush(envelope([product, otherProduct]));
    financeRequest("suppliers").flush(envelope([supplier]));
    harness.detectChanges();

    input("#purchase-date", "2026-09-21");
    input("#purchase-supplier", supplierId);
    input("#purchase-product-0", productId);
    input("#purchase-quantity-0", "3");
    input("#purchase-price-0", "12000");
    expect(dom().querySelector("[data-line-total='0']")?.textContent).toContain(
      "36",
    );

    click("[data-add-row]");
    expect(dom().querySelectorAll("[data-item-row]")).toHaveLength(2);
    input("#purchase-product-1", productId);
    expect(dom().querySelector("[data-duplicate-products]")).not.toBeNull();
    expect(
      dom().querySelector<HTMLButtonElement>("button[type=submit]")!.disabled,
    ).toBe(true);
    click("[data-remove-row='1']");
    expect(dom().querySelectorAll("[data-item-row]")).toHaveLength(1);
  });

  it("previews sale price, discount, net revenue, stock and displays the server stock error", async () => {
    await harness.navigateByUrl("/admin/finance/sales/new");
    financeRequest("products").flush(envelope([product, otherProduct]));
    harness.detectChanges();

    input("#sale-date", "2026-09-21");
    input("#sale-product-0", productId);
    input("#sale-quantity-0", "3");
    input("#sale-price-0", "18000");
    input("#sale-discount-0", "4000");
    expect(
      dom().querySelector("[data-available-stock='0']")?.textContent,
    ).toContain("2");
    expect(dom().querySelector("[data-line-net='0']")?.textContent).toContain(
      "50",
    );
    expect(dom().querySelector("[data-sale-net]")?.textContent).toContain("50");

    click("button[type=submit]");
    const request = http.expectOne("/api/v1/admin/finance/sales");
    expect(request.request.body.items).toEqual([
      {
        productId,
        quantity: 3,
        actualUnitPrice: "18000",
        lineDiscount: "4000",
      },
    ]);
    request.flush(
      { message: "Only 2 units are currently available." },
      { status: 400, statusText: "Bad Request" },
    );
    harness.detectChanges();
    const summary = dom().querySelector<HTMLElement>("[data-error-summary]");
    expect(summary?.textContent).toContain(
      "Only 2 units are currently available.",
    );
    await vi.waitFor(() => expect(document.activeElement).toBe(summary));
  });

  it("blocks dirty supplier navigation and deletes a supplier only after confirmation", async () => {
    await harness.navigateByUrl(`/admin/finance/suppliers/${supplierId}/edit`);
    http
      .expectOne(`/api/v1/admin/finance/suppliers/${supplierId}`)
      .flush(supplier);
    harness.detectChanges();
    input("#supplier-name", "Changed supplier");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      await harness.navigateByUrl("/admin/finance/suppliers");
      expect(TestBed.inject(Router).url).toContain(`${supplierId}/edit`);
      confirm.mockReturnValue(true);
      await harness.navigateByUrl("/admin/finance/suppliers");
      financeRequest("suppliers").flush(envelope([supplier]));
      harness.detectChanges();
      click("[data-delete]");
      expect(http.match(() => true)).toHaveLength(0);
      click("[data-confirm]");
      http
        .expectOne(`/api/v1/admin/finance/suppliers/${supplierId}`)
        .flush(null);
      financeRequest("suppliers").flush(envelope([]));
    } finally {
      confirm.mockRestore();
    }
  });

  it("shows loading, retry, and empty states for transaction lists", async () => {
    await harness.navigateByUrl("/admin/finance/purchases");
    expect(dom().querySelector("[role=status]")).not.toBeNull();
    financeRequest("purchases").flush(
      { message: "failed" },
      { status: 500, statusText: "Server Error" },
    );
    harness.detectChanges();
    expect(dom().querySelector("[role=alert] [data-retry]")).not.toBeNull();
    click("[data-retry]");
    financeRequest("purchases").flush(envelope([]));
    harness.detectChanges();
    expect(dom().textContent).toContain("No purchases found");
  });

  it("renders server-authoritative purchase and sale list totals with accessible tables", async () => {
    await harness.navigateByUrl("/admin/finance/purchases");
    financeRequest("purchases").flush(
      envelope([
        {
          id: transactionId,
          purchaseNumber: "PUR-20260921-AAAA",
          date: "2026-09-21T00:00:00.000Z",
          supplierId,
          supplier,
          notes: null,
          createdByAdminId: "admin-fixture",
          createdByAdmin: { id: "admin-fixture", email: "fixture@athlon.test" },
          importKey: null,
          items: [],
          totalPurchaseCost: "120000",
          createdAt: "2026-09-21T00:00:00.000Z",
          updatedAt: "2026-09-21T00:00:00.000Z",
        },
      ]),
    );
    harness.detectChanges();
    expect(dom().querySelector("table caption")?.textContent).toContain(
      "Purchases",
    );
    expect(dom().textContent).toContain("120");
  });
});
