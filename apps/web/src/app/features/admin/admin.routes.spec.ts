import { provideHttpClient, withInterceptors } from "@angular/common/http";
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { By, Meta } from "@angular/platform-browser";
import { provideRouter, Router } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { RenderMode } from "@angular/ssr";
import { routes } from "../../app.routes";
import { serverRoutes } from "../../app.routes.server";
import { adminHttpInterceptor } from "./auth/admin-http.interceptor";
import { LoginPage } from "./auth/login-page";
import { DashboardPage } from "./dashboard/dashboard-page";
import { AdminI18nService } from "./shared/admin-i18n.service";
import { adminDirtyFormGuard } from "./shared/admin-dirty-form.guard";
import { AdminShell } from "./admin-shell";
import { AdminSessionService } from "./auth/admin-session.service";
import { firstValueFrom } from "rxjs";

describe("admin route boundaries and UI", () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([adminHttpInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it("resolves /admin/login to the login page without public locale or private requests", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl("/admin/login");
    expect(
      harness.fixture.debugElement.query(By.directive(LoginPage)),
    ).not.toBeNull();
    expect(
      harness.routeNativeElement
        ?.querySelector("input[type=email]")
        ?.getAttribute("autocomplete"),
    ).toBe("username");
    expect(
      harness.routeNativeElement?.querySelector("label[for=password]"),
    ).not.toBeNull();
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe(
      "noindex, nofollow",
    );
    http.expectNone(() => true);
  });

  it("removes admin noindex when navigating to a public page", async () => {
    const harness = await RouterTestingHarness.create("/admin/login");
    await harness.navigateByUrl("/hy");
    expect(TestBed.inject(Meta).getTag('name="robots"')).toBeNull();
    http
      .match(() => true)
      .forEach((request) =>
        request.flush(
          request.request.url.endsWith("/products")
            ? {
                items: [],
                meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
              }
            : [],
        ),
      );
  });

  it("loads catalog totals using pageSize=1 rather than inventing analytics", () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    for (const [resource, total] of [
      ["products", 42],
      ["categories", 2],
      ["brands", 7],
    ] as const) {
      const request = http.expectOne(
        (request) => request.url === `/api/v1/admin/${resource}`,
      );
      expect(request.request.params.get("pageSize")).toBe("1");
      expect(request.request.params.has("published")).toBe(false);
      request.flush({
        items: [],
        meta: { page: 1, pageSize: 1, total, totalPages: total },
      });
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("42");
    expect(fixture.nativeElement.textContent).toContain("7");
    TestBed.inject(AdminI18nService).setLocale("en");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Products");
  });

  it("keeps the admin shell and shows an actionable retry after failed logout", async () => {
    const session = TestBed.inject(AdminSessionService);
    const user = { id: "admin-id", email: "admin@athlon.test", role: "ADMIN" };
    const login = firstValueFrom(session.login(user.email, "password"));
    http
      .expectOne("/api/v1/admin/auth/config")
      .flush({ csrfCookieName: "athlon_csrf" });
    http.expectOne("/api/v1/admin/auth/login").flush({ user });
    await login;
    const fixture = TestBed.createComponent(AdminShell);
    fixture.componentInstance.i18n.setLocale("en");
    fixture.detectChanges();
    fixture.componentInstance.logout();
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush({}, { status: 0, statusText: "Unknown Error" });
    fixture.detectChanges();
    expect(session.user()?.email).toBe("admin@athlon.test");
    expect(
      fixture.nativeElement.querySelector("[role=alert]")?.textContent,
    ).toContain("Your session may still be active.");
    const retry: HTMLButtonElement = fixture.nativeElement.querySelector(
      "[role=alert] button",
    );
    expect(retry.textContent?.trim()).toBe("Retry");
    retry.click();
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush(null, { status: 204, statusText: "No Content" });
    await vi.waitFor(() =>
      expect(TestBed.inject(Router).url).toBe("/admin/login"),
    );
    expect(session.user()).toBeNull();
  });

  it("shows a generic login error and clears the password on rejection", async () => {
    const harness = await RouterTestingHarness.create("/admin/login");
    const page: LoginPage = harness.fixture.debugElement.query(
      By.directive(LoginPage),
    ).componentInstance;
    page.i18n.setLocale("en");
    page.form.setValue({
      email: "admin@athlon.test",
      password: "private password",
    });
    page.submit();
    http
      .expectOne("/api/v1/admin/auth/config")
      .flush({ csrfCookieName: "athlon_csrf" });
    http
      .expectOne("/api/v1/admin/auth/login")
      .flush(
        { message: "Email exists but password is wrong" },
        { status: 401, statusText: "Unauthorized" },
      );
    harness.detectChanges();
    expect(
      harness.routeNativeElement?.querySelector("[role=alert]")?.textContent,
    ).toBe("Could not log in. Check your details and try again.");
    expect(page.form.controls.password.value).toBe("");
    expect(page.busy()).toBe(false);
  });

  it("does not submit invalid login credentials", async () => {
    const harness = await RouterTestingHarness.create("/admin/login");
    const page: LoginPage = harness.fixture.debugElement.query(
      By.directive(LoginPage),
    ).componentInstance;
    page.submit();
    expect(page.form.controls.email.touched).toBe(true);
    http.expectNone(() => true);
  });

  it("redirects protected navigation to login after failed refresh", async () => {
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl("/admin");
    // Lazy route resolution is asynchronous; wait for its guard to issue me.
    let me: TestRequest | undefined;
    await vi.waitFor(() => {
      me ??= http.match("/api/v1/admin/auth/me")[0];
      expect(me).toBeDefined();
    });
    me!.flush({}, { status: 401, statusText: "Unauthorized" });
    http
      .expectOne("/api/v1/admin/auth/config")
      .flush({ csrfCookieName: "athlon_csrf" });
    http
      .expectOne("/api/v1/admin/auth/refresh")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    await navigation;
    expect(TestBed.inject(Router).url).toBe("/admin/login?returnUrl=%2Fadmin");
    expect(
      harness.fixture.debugElement.query(By.directive(LoginPage)),
    ).not.toBeNull();
  });

  it("shows dashboard errors, supports retry, and distinguishes persisted zero totals", () => {
    const fixture = TestBed.createComponent(DashboardPage);
    fixture.detectChanges();
    TestBed.inject(AdminI18nService).setLocale("en");
    const requests = http.match((request) =>
      request.url.startsWith("/api/v1/admin/"),
    );
    requests[0].flush({}, { status: 500, statusText: "Server Error" });
    // forkJoin cancels sibling calls after a failure.
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector("[role=alert]").textContent,
    ).toContain("Could not load data.");
    fixture.nativeElement.querySelector("button").click();
    http
      .match((request) => request.url.startsWith("/api/v1/admin/"))
      .forEach((request) =>
        request.flush({
          items: [],
          meta: { page: 1, pageSize: 1, total: 0, totalPages: 0 },
        }),
      );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "The catalog is empty.",
    );
    expect(fixture.nativeElement.querySelector("[role=alert]")).toBeNull();
  });

  it("supports a reusable dirty form decision and leaves clean forms without prompting", () => {
    let asked = false;
    expect(
      adminDirtyFormGuard(
        {
          hasUnsavedChanges: () => false,
          confirmDiscard: () => {
            asked = true;
            return false;
          },
        } as never,
        {} as never,
        {} as never,
        {} as never,
      ),
    ).toBe(true);
    expect(asked).toBe(false);
    expect(
      adminDirtyFormGuard(
        { hasUnsavedChanges: () => true, confirmDiscard: () => false } as never,
        {} as never,
        {} as never,
        {} as never,
      ),
    ).toBe(false);
  });

  it("registers guarded CRUD routes and prevents abandoning a dirty editor", async () => {
    const session = TestBed.inject(AdminSessionService);
    const user = { id: "admin-id", email: "admin@athlon.test", role: "ADMIN" };
    const login = firstValueFrom(session.login(user.email, "password"));
    http
      .expectOne("/api/v1/admin/auth/config")
      .flush({ csrfCookieName: "athlon_csrf" });
    http.expectOne("/api/v1/admin/auth/login").flush({ user });
    await login;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl("/admin/brands/new");
    expect(harness.routeNativeElement?.querySelector("#slug")).not.toBeNull();
    const field =
      harness.routeNativeElement!.querySelector<HTMLInputElement>("#name")!;
    field.value = "Unsaved";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      await harness.navigateByUrl("/admin/categories");
      expect(TestBed.inject(Router).url).toBe("/admin/brands/new");
      expect(confirm).toHaveBeenCalledTimes(1);
      confirm.mockReturnValue(true);
      await harness.navigateByUrl("/admin/categories");
      const request = http.expectOne(
        (request) => request.url === "/api/v1/admin/categories",
      );
      request.flush({
        items: [],
        meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
      });
      expect(TestBed.inject(Router).url).toBe("/admin/categories");
      const firstId = "24d3f1a3-8413-4bc6-b32d-437871a22b54";
      await harness.navigateByUrl(`/admin/brands/${firstId}/edit`);
      http.expectOne(`/api/v1/admin/brands/${firstId}`).flush({
        id: firstId,
        slug: "brand",
        name: "Brand",
        logoKey: null,
        published: true,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        translations: [{ locale: "HY", name: "Brand" }],
      });
      harness.detectChanges();
      const name =
        harness.routeNativeElement!.querySelector<HTMLInputElement>("#name")!;
      name.value = "Unsaved ID change";
      name.dispatchEvent(new Event("input", { bubbles: true }));
      confirm.mockReturnValue(false);
      await harness.navigateByUrl(
        "/admin/brands/34d3f1a3-8413-4bc6-b32d-437871a22b54/edit",
      );
      expect(TestBed.inject(Router).url).toBe(`/admin/brands/${firstId}/edit`);
      http.expectNone(
        "/api/v1/admin/brands/34d3f1a3-8413-4bc6-b32d-437871a22b54",
      );
    } finally {
      confirm.mockRestore();
    }
  });

  it("uses client rendering for admin while preserving public server rendering", () => {
    expect(
      serverRoutes.find((route) => route.path === "admin/**")?.renderMode,
    ).toBe(RenderMode.Client);
    expect(serverRoutes.find((route) => route.path === "**")?.renderMode).toBe(
      RenderMode.Server,
    );
    expect(
      serverRoutes.find((route) => route.path === "admin/**")?.headers?.[
        "X-Robots-Tag"
      ],
    ).toBe("noindex, nofollow");
  });
});
