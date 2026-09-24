import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { By, Meta } from "@angular/platform-browser";
import { provideRouter, Router, Routes } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { firstValueFrom } from "rxjs";
import { AdminShell } from "../../admin-shell";
import { adminRoutes } from "../../admin.routes";
import { adminAuthGuard } from "../../auth/admin-auth.guard";
import { AdminSessionService } from "../../auth/admin-session.service";
import { adminDirtyFormGuard } from "../../shared/admin-dirty-form.guard";
import { DateRangeFilter } from "./date-range-filter";
import { AdminFinanceService } from "./admin-finance.service";
import { formatAmd, formatFinanceDate, formatPercent } from "./finance-format";

describe("finance admin foundation", () => {
  afterEach(() => TestBed.resetTestingModule());

  it("registers finance as a lazy child of the protected admin shell", async () => {
    const root = adminRoutes[0];
    const shell = root.children?.find(
      (route) => route.path === "" && route.canActivate,
    );
    const finance = shell?.children?.find((route) => route.path === "finance");

    expect(shell?.canActivate).toContain(adminAuthGuard);
    expect(finance?.loadChildren).toEqual(expect.any(Function));
    expect(finance?.children).toBeUndefined();

    const loaded = await finance!.loadChildren!();
    const routes = Array.isArray(loaded) ? loaded : [];
    for (const editor of [
      "purchases/new",
      "purchases/:id/edit",
      "sales/new",
      "sales/:id/edit",
      "expenses/new",
      "expenses/:id/edit",
      "recurring-expenses/new",
      "recurring-expenses/:id/edit",
      "suppliers/new",
      "suppliers/:id/edit",
    ]) {
      expect(
        routes.find((route) => route.path === editor)?.canDeactivate,
      ).toContain(adminDirtyFormGuard);
    }
  });

  it("shows an accessible finance group with direct navigation links", () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(AdminShell);
    fixture.componentInstance.i18n.setLocale("en");
    fixture.detectChanges();

    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector(
      "button[aria-controls=finance-navigation]",
    );
    expect(toggle.textContent).toContain("Finance & Inventory");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.click();
    fixture.detectChanges();

    const linkElements = fixture.nativeElement.querySelectorAll(
      "#finance-navigation a",
    ) as NodeListOf<HTMLAnchorElement>;
    const links = Array.from(linkElements, (link) => ({
      text: link.textContent?.trim(),
      href: link.getAttribute("href"),
    }));
    expect(links).toEqual([
      { text: "Dashboard", href: "/admin/finance" },
      { text: "Products", href: "/admin/finance/products" },
      { text: "Purchases", href: "/admin/finance/purchases" },
      { text: "Sales", href: "/admin/finance/sales" },
      { text: "Expenses", href: "/admin/finance/expenses" },
      { text: "Monthly Summary", href: "/admin/finance/monthly-summary" },
      { text: "Export", href: "/admin/finance/export" },
    ]);
  });

  it("keeps finance navigation client-only and noindexed", async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(adminRoutes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(AdminSessionService);
    const login = firstValueFrom(
      session.login("admin@athlon.test", "password"),
    );
    http
      .expectOne("/api/v1/admin/auth/config")
      .flush({ csrfCookieName: "athlon_csrf" });
    http.expectOne("/api/v1/admin/auth/login").flush({
      user: { id: "admin-id", email: "admin@athlon.test", role: "ADMIN" },
    });
    await login;

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl("/finance");
    expect(TestBed.inject(Router).url).toBe("/finance");
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe(
      "noindex, nofollow",
    );
    http.verify();
  });

  it("serializes typed queries and extracts a safe download filename", async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const api = TestBed.inject(AdminFinanceService);

    const purchases = firstValueFrom(
      api.listPurchases({
        q: "protein",
        page: 2,
        supplierId: "supplier-id",
        dateFrom: "2026-09-01",
      }),
    );
    const listRequest = http.expectOne(
      (request) => request.url === "/api/v1/admin/finance/purchases",
    );
    expect(listRequest.request.params.get("q")).toBe("protein");
    expect(listRequest.request.params.get("page")).toBe("2");
    expect(listRequest.request.params.get("supplierId")).toBe("supplier-id");
    expect(listRequest.request.params.get("dateFrom")).toBe("2026-09-01");
    listRequest.flush({
      items: [],
      meta: { page: 2, pageSize: 24, total: 0, totalPages: 0 },
    });
    await purchases;

    const download = firstValueFrom(
      api.download("accounting.xlsx", { period: "thisMonth" }),
    );
    const downloadRequest = http.expectOne(
      "/api/v1/admin/finance/exports/accounting.xlsx?period=thisMonth",
    );
    downloadRequest.flush(new Blob(["xlsx"]), {
      headers: {
        "Content-Disposition":
          'attachment; filename="../../athlon-accounting-2026-09.xlsx"',
      },
    });
    await expect(download).resolves.toMatchObject({
      filename: "athlon-accounting-2026-09.xlsx",
    });
    http.verify();
  });

  it("formats finance values for display without changing API precision", () => {
    expect(formatAmd("1234.50")).toBe("1235 AMD");
    expect(formatPercent("12.345")).toBe("12,35%");
    expect(formatPercent(null)).toBe("—");
    expect(formatFinanceDate("2026-09-21T00:00:00.000Z")).toContain("2026");
  });
});

describe("DateRangeFilter", () => {
  const testRoutes: Routes = [{ path: "finance", component: DateRangeFilter }];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(testRoutes)] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it("hydrates custom dates, preserves other URL filters, and emits normalized dates", async () => {
    const harness = await RouterTestingHarness.create(
      "/finance?period=custom&dateFrom=2026-09-01&dateTo=2026-09-30&supplierId=s-1",
    );
    const component: DateRangeFilter = harness.fixture.debugElement.query(
      By.directive(DateRangeFilter),
    ).componentInstance;
    const emitted = vi.fn();
    component.rangeChange.subscribe(emitted);
    component.from.set("2026-09-02");
    component.to.set("2026-09-28");
    component.applyCustom();

    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toContain("dateFrom=2026-09-02"),
    );
    expect(TestBed.inject(Router).url).toContain("dateTo=2026-09-28");
    expect(TestBed.inject(Router).url).toContain("supplierId=s-1");
    expect(emitted).toHaveBeenCalledWith({
      preset: "custom",
      from: "2026-09-02",
      to: "2026-09-28",
    });
  });

  it("rejects reversed or impossible custom dates without changing the URL", async () => {
    const harness = await RouterTestingHarness.create("/finance");
    const component: DateRangeFilter = harness.fixture.debugElement.query(
      By.directive(DateRangeFilter),
    ).componentInstance;
    const emitted = vi.fn();
    component.rangeChange.subscribe(emitted);
    component.selectPreset("custom");
    component.from.set("2026-02-31");
    component.to.set("2026-02-01");
    component.applyCustom();

    expect(component.invalid()).toBe(true);
    expect(TestBed.inject(Router).url).toBe("/finance");
    expect(emitted).not.toHaveBeenCalled();
  });
});
