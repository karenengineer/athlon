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

describe("finance reports admin pages", () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  const base = "/api/v1/admin/finance/";
  const envelope = (items: unknown[]) => ({
    items,
    meta: { page: 1, pageSize: 24, total: items.length, totalPages: 1 },
  });
  const dom = () => harness.routeNativeElement!;
  const input = (selector: string, value: string) => {
    const element = dom().querySelector<HTMLInputElement | HTMLSelectElement>(
      selector,
    )!;
    expect(element, selector).not.toBeNull();
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    harness.detectChanges();
  };

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
      id: "admin",
      email: "admin@test.test",
      role: "ADMIN",
    });
    TestBed.inject(AdminI18nService).setLocale("en");
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it("loads filtered expenses and identifies generated occurrences", async () => {
    await harness.navigateByUrl(
      "/admin/finance/expenses?source=RECURRING_OCCURRENCE&dateFrom=2026-09-01&paymentMethod=Bank",
    );
    const request = http.expectOne((r) => r.url === `${base}expenses`);
    expect(request.request.params.get("source")).toBe("RECURRING_OCCURRENCE");
    expect(request.request.params.get("dateFrom")).toBe("2026-09-01");
    expect(request.request.params.get("paymentMethod")).toBe("Bank");
    request.flush(
      envelope([
        {
          id: "e1",
          date: "2026-09-10T00:00:00Z",
          description: "Rent",
          amount: "40000",
          source: "RECURRING_OCCURRENCE",
          category: { id: "c1", name: "Rent" },
          paymentMethod: "Bank",
        },
      ]),
    );
    http
      .expectOne((r) => r.url === `${base}expense-categories`)
      .flush(envelope([{ id: "c1", name: "Rent", active: true }]));
    harness.detectChanges();
    expect(dom().textContent).toContain("Generated monthly occurrence");
    expect(dom().textContent).toContain("Rent");
    expect(dom().querySelector("tbody tr a")).toBeNull();
    expect(dom().querySelector("tbody tr button")).toBeNull();
  });

  it("shows all dashboard KPIs and zero-safe comparison labels", async () => {
    await harness.navigateByUrl("/admin/finance");
    const metrics = Object.fromEntries(
      [
        "revenue",
        "costOfGoodsSold",
        "grossProfit",
        "operatingExpenses",
        "recurringExpenses",
        "totalExpenses",
        "netProfit",
        "grossMarginPercent",
        "netMarginPercent",
        "averageOrderValue",
      ].map((key) => [key, "0"]),
    );
    const comparisons = Object.fromEntries(
      Object.keys(metrics)
        .concat("unitsSold", "orderCount")
        .map((key) => [
          key,
          {
            previousValue: "0",
            comparisonPercent: null,
            label: "Previous period",
          },
        ]),
    );
    http
      .expectOne((r) => r.url === `${base}dashboard`)
      .flush({
        ...metrics,
        unitsSold: 0,
        orderCount: 0,
        inventoryValue: "0",
        comparisons,
        range: { from: "2026-09-01", to: "2026-09-30" },
        previousRange: { from: "2026-08-01", to: "2026-08-31" },
        currentStock: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
      });
    const chartProducts = http.expectOne(
      (r) => r.url === `${base}profitability`,
    );
    expect(chartProducts.request.params.get("pageSize")).toBe("100");
    expect(chartProducts.request.params.get("sort")).toBe("profitDesc");
    chartProducts.flush(envelope([]));
    harness.detectChanges();
    for (const label of [
      "Revenue",
      "Gross profit",
      "Net profit",
      "Expenses",
      "Units sold",
      "Orders",
      "Average order value",
      "Inventory value",
    ])
      expect(dom().textContent).toContain(label);
    for (const chart of [
      "Revenue comparison",
      "Net profit comparison",
      "Expenses comparison",
      "Sales by product",
      "Profit by product",
    ])
      expect(dom().textContent).toContain(chart);
    expect(dom().textContent).toContain("Top 100 products");
    expect(dom().textContent).not.toMatch(/Infinity|NaN/);
  });

  it("uses URL month and year for monthly summary and renders undefined margins as dash", async () => {
    await harness.navigateByUrl(
      "/admin/finance/monthly-summary?year=2026&month=9",
    );
    const request = http.expectOne((r) => r.url === `${base}monthly-summary`);
    expect(request.request.params.get("year")).toBe("2026");
    expect(request.request.params.get("month")).toBe("9");
    const totals = {
      revenue: "0",
      costOfGoodsSold: "0",
      grossProfit: "0",
      operatingExpenses: "0",
      recurringExpenses: "0",
      totalExpenses: "0",
      netProfit: "0",
      grossMarginPercent: "0",
      netMarginPercent: "0",
      unitsSold: 0,
      orderCount: 0,
      averageOrderValue: "0",
    };
    request.flush({
      year: 2026,
      month: 9,
      range: { from: "2026-09-01", to: "2026-09-30" },
      months: [{ ...totals, year: 2026, month: 9 }],
      totals,
    });
    http.expectOne((r) => r.url === `${base}expense-breakdown`).flush([]);
    http
      .expectOne((r) => r.url === `${base}expense-categories`)
      .flush(envelope([{ id: "ec1", name: "Rent", active: true }]));
    harness.detectChanges();
    expect(
      dom().querySelector("#summary-expense-category")?.textContent,
    ).toContain("Rent");
    expect(dom().textContent).toContain("Gross margin");
    expect(dom().querySelector("#summary-expense-category")?.tagName).toBe(
      "SELECT",
    );
    expect(dom().textContent).not.toMatch(/Infinity|NaN/);
    input("#summary-month", "8");
    dom().querySelector<HTMLButtonElement>("[data-apply]")!.click();
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toContain("month=8"),
    );
    http
      .expectOne((r) => r.url === `${base}monthly-summary`)
      .flush({
        year: 2026,
        month: 8,
        range: { from: "2026-08-01", to: "2026-08-31" },
        months: [],
        totals,
      });
    http.expectOne((r) => r.url === `${base}expense-breakdown`).flush([]);
  });

  it("keeps monthly CSV out of date-range exports and sends year/month from the summary page", async () => {
    await harness.navigateByUrl("/admin/finance/export");
    expect(
      dom().querySelector('option[value="monthly-summary.csv"]'),
    ).toBeNull();
    await harness.navigateByUrl(
      "/admin/finance/monthly-summary?year=2026&month=9",
    );
    http
      .expectOne((r) => r.url === `${base}monthly-summary`)
      .flush({
        year: 2026,
        month: 9,
        range: { from: "2026-09-01", to: "2026-09-30" },
        months: [],
        totals: {
          revenue: "0",
          costOfGoodsSold: "0",
          grossProfit: "0",
          operatingExpenses: "0",
          recurringExpenses: "0",
          totalExpenses: "0",
          netProfit: "0",
          grossMarginPercent: "0",
          netMarginPercent: "0",
          unitsSold: 0,
          orderCount: 0,
          averageOrderValue: "0",
        },
      });
    http.expectOne((r) => r.url === `${base}expense-breakdown`).flush([]);
    http
      .expectOne((r) => r.url === `${base}expense-categories`)
      .flush(envelope([]));
    harness.detectChanges();
    const button = Array.from(
      dom().querySelectorAll<HTMLButtonElement>("button"),
    ).find((item) => item.textContent?.includes("Export current view"))!;
    button.click();
    const request = http.expectOne(
      (r) => r.url === `${base}exports/monthly-summary.csv`,
    );
    expect(request.request.params.get("year")).toBe("2026");
    expect(request.request.params.get("month")).toBe("9");
    expect(request.request.params.get("period")).toBeNull();
  });

  it("sends only supported date filters to transaction CSV exports", async () => {
    await harness.navigateByUrl("/admin/finance/export");
    input("#export-from", "2026-09-01");
    input("#export-to", "2026-09-30");
    input("#export-type", "expenses.csv");
    dom().querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    const request = http.expectOne(
      (r) => r.url === `${base}exports/expenses.csv`,
    );
    expect(request.request.params.get("dateFrom")).toBe("2026-09-01");
    expect(request.request.params.get("dateTo")).toBe("2026-09-30");
    expect(request.request.params.has("period")).toBe(false);
  });

  it("offers named product categories for profitability filters", async () => {
    await harness.navigateByUrl("/admin/finance/profitability?categoryId=c1");
    http.expectOne((r) => r.url === `${base}profitability`).flush(envelope([]));
    http
      .expectOne((r) => r.url === "/api/v1/admin/categories")
      .flush(
        envelope([
          {
            id: "c1",
            slug: "nutrition",
            translations: [{ locale: "EN", name: "Nutrition" }],
          },
        ]),
      );
    harness.detectChanges();
    expect(dom().querySelector("#profit-category")?.tagName).toBe("SELECT");
    expect(dom().querySelector("#profit-category")?.textContent).toContain(
      "Nutrition",
    );
  });

  it("disables duplicate accounting downloads and recovers after backend error", async () => {
    await harness.navigateByUrl("/admin/finance/export");
    input("#export-from", "2026-09-01");
    input("#export-to", "2026-09-30");
    const button = dom().querySelector<HTMLButtonElement>(
      "[data-export-accounting]",
    )!;
    button.click();
    harness.detectChanges();
    expect(button.disabled).toBe(true);
    expect(
      http.match((r) => r.url === `${base}exports/accounting.xlsx`),
    ).toHaveLength(1);
  });
  it("filters recurring templates on the server and toggles active state", async () => {
    await harness.navigateByUrl(
      "/admin/finance/recurring-expenses?active=true&paymentMethod=Bank",
    );
    const request = http.expectOne(
      (r) => r.url === `${base}recurring-expenses`,
    );
    expect(request.request.params.get("active")).toBe("true");
    expect(request.request.params.get("paymentMethod")).toBe("Bank");
    request.flush(
      envelope([
        {
          id: "r1",
          name: "Rent",
          categoryId: "c1",
          category: { id: "c1", name: "Premises" },
          amount: "40000",
          startDate: "2026-01-01",
          endDate: null,
          paymentMethod: "Bank",
          notes: null,
          active: true,
        },
      ]),
    );
    http
      .expectOne((r) => r.url === `${base}expense-categories`)
      .flush(envelope([{ id: "c1", name: "Premises", active: true }]));
    harness.detectChanges();
    expect(dom().textContent).toContain("does not rewrite historical months");
    const deactivate = dom().querySelectorAll<HTMLButtonElement>("button");
    const button = Array.from(deactivate).find((item) =>
      item.textContent?.includes("Deactivate"),
    )!;
    button.click();
    const update = http.expectOne(`${base}recurring-expenses/r1`);
    expect(update.request.method).toBe("PATCH");
    expect(update.request.body).toEqual({ active: false });
    update.flush({});
    http
      .expectOne((r) => r.url === `${base}recurring-expenses`)
      .flush(envelope([]));
  });

  it("creates a one-time expense from the editor", async () => {
    await harness.navigateByUrl("/admin/finance/expenses/new");
    http
      .expectOne((r) => r.url === `${base}expense-categories`)
      .flush(envelope([{ id: "c1", name: "Travel", active: true }]));
    harness.detectChanges();
    input("#expense-date", "2026-09-12");
    input("#expense-category", "c1");
    input("#expense-description", "Taxi");
    input("#expense-amount", "2500");
    dom().querySelector<HTMLButtonElement>("button[type=submit]")!.click();
    const request = http.expectOne(`${base}expenses`);
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toMatchObject({
      date: "2026-09-12",
      categoryId: "c1",
      description: "Taxi",
      amount: "2500",
    });
    request.flush({
      id: "e2",
      date: "2026-09-12",
      categoryId: "c1",
      description: "Taxi",
      amount: "2500",
      paymentMethod: null,
      notes: null,
    });
  });

  it("recovers after export errors and uses the response filename", async () => {
    await harness.navigateByUrl("/admin/finance/export");
    input("#export-from", "2026-09-01");
    input("#export-to", "2026-09-30");
    const button = dom().querySelector<HTMLButtonElement>(
      "[data-export-accounting]",
    )!;
    button.click();
    http
      .expectOne((r) => r.url === `${base}exports/accounting.xlsx`)
      .flush(new Blob(["failed"]), { status: 500, statusText: "Error" });
    harness.detectChanges();
    expect(button.disabled).toBe(false);
    expect(dom().textContent).toContain("Could not download");
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    try {
      button.click();
      http
        .expectOne((r) => r.url === `${base}exports/accounting.xlsx`)
        .flush(new Blob(["file"]), {
          headers: {
            "Content-Disposition": 'attachment; filename="finance.xlsx"',
          },
        });
      harness.detectChanges();
      expect(dom().textContent).toContain("finance.xlsx");
      expect(create).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledTimes(1);
      expect(anchorClick).toHaveBeenCalledTimes(1);
    } finally {
      anchorClick.mockRestore();
      create.mockRestore();
      revoke.mockRestore();
    }
  });
});
