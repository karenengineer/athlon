import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { PLATFORM_ID } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { adminHttpInterceptor } from "./admin-http.interceptor";
import { AdminSessionService } from "./admin-session.service";
import { adminAuthGuard, safeAdminReturnUrl } from "./admin-auth.guard";
import { routes } from "../../../app.routes";

describe("admin cookie sessions", () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let session: AdminSessionService;
  const user = { id: "admin-id", email: "admin@athlon.test", role: "ADMIN" };

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
    client = TestBed.inject(HttpClient);
    session = TestBed.inject(AdminSessionService);
    document.cookie = "athlon_csrf=fixture-csrf; path=/";
    document.cookie = "custom_csrf=custom-value; path=/";
  });
  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
      document.cookie = "athlon_csrf=; max-age=0; path=/";
      document.cookie = "custom_csrf=; max-age=0; path=/";
    }
  });

  function config(name = "athlon_csrf") {
    http.expectOne("/api/v1/admin/auth/config").flush({ csrfCookieName: name });
  }

  it("attaches discovered CSRF only to same-origin administrative mutations", async () => {
    const login = firstValueFrom(session.login(user.email, "password"));
    config();
    http.expectOne("/api/v1/admin/auth/login").flush({ user });
    await login;
    client.post("/api/v1/admin/products", {}).subscribe();
    const mutation = http.expectOne("/api/v1/admin/products");
    expect(mutation.request.headers.get("x-csrf-token")).toBe("fixture-csrf");
    mutation.flush({});
    client
      .post("https://untrusted.example/api/v1/admin/products", {})
      .subscribe();
    const external = http.expectOne(
      "https://untrusted.example/api/v1/admin/products",
    );
    expect(external.request.headers.has("x-csrf-token")).toBe(false);
    external.flush({});
    client.post("/api/v1/products", {}).subscribe();
    const publicRequest = http.expectOne("/api/v1/products");
    expect(publicRequest.request.headers.has("x-csrf-token")).toBe(false);
    publicRequest.flush({});
    expect(http.match("https://untrusted.example/").length).toBe(0);
  });

  it("discovers a custom cookie name before reload refresh and shares concurrent refresh", async () => {
    const a = firstValueFrom(session.ensureSession());
    const b = firstValueFrom(session.ensureSession());
    const me = http.match("/api/v1/admin/auth/me");
    expect(me.length).toBe(1);
    me[0].flush({}, { status: 401, statusText: "Unauthorized" });
    config("custom_csrf");
    const refresh = http.expectOne("/api/v1/admin/auth/refresh");
    expect(refresh.request.headers.get("x-csrf-token")).toBe("custom-value");
    refresh.flush({ user });
    http.expectOne("/api/v1/admin/auth/me").flush({ user });
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(session.user()?.email).toBe(user.email);
  });

  it("discovers custom CSRF after a valid reload session before guarded mutations", async () => {
    const ready = firstValueFrom(session.ensureSession());
    http.expectOne("/api/v1/admin/auth/me").flush({ user });
    config("custom_csrf");
    expect(await ready).toBe(true);
    client.delete("/api/v1/admin/brands/brand-id").subscribe();
    const mutation = http.expectOne("/api/v1/admin/brands/brand-id");
    expect(mutation.request.headers.get("x-csrf-token")).toBe("custom-value");
    mutation.flush(null);
  });

  it("does not refresh an unauthorized login or configuration endpoint", async () => {
    const result = firstValueFrom(session.login(user.email, "wrong")).catch(
      (error) => error.status,
    );
    config();
    http
      .expectOne("/api/v1/admin/auth/login")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    expect(await result).toBe(401);
    http.expectNone("/api/v1/admin/auth/refresh");
    const configResult = firstValueFrom(
      client.get("/api/v1/admin/auth/config"),
    ).catch((error) => error.status);
    http
      .expectOne("/api/v1/admin/auth/config")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    expect(await configResult).toBe(401);
    http.expectNone("/api/v1/admin/auth/refresh");
  });

  it("does not refresh external unauthorized requests", async () => {
    const result = firstValueFrom(
      client.get("https://untrusted.example/api/v1/admin/products"),
    ).catch((error) => error.status);
    http
      .expectOne("https://untrusted.example/api/v1/admin/products")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    expect(await result).toBe(401);
    http.expectNone("/api/v1/admin/auth/config");
    http.expectNone("/api/v1/admin/auth/refresh");
  });

  it("shares refresh across concurrent protected failures and retries each only once", async () => {
    const a = firstValueFrom(client.get("/api/v1/admin/products"));
    const b = firstValueFrom(client.get("/api/v1/admin/brands"));
    http
      .expectOne("/api/v1/admin/products")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    http
      .expectOne("/api/v1/admin/brands")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    config();
    http.expectOne("/api/v1/admin/auth/refresh").flush({ user });
    http.expectOne("/api/v1/admin/products").flush({ items: [] });
    http.expectOne("/api/v1/admin/brands").flush({ items: [] });
    expect(await a).toEqual({ items: [] });
    expect(await b).toEqual({ items: [] });
  });

  it("does not recurse when a retried protected request is unauthorized", async () => {
    const result = firstValueFrom(client.get("/api/v1/admin/products")).catch(
      (error) => error.status,
    );
    http
      .expectOne("/api/v1/admin/products")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    config();
    http.expectOne("/api/v1/admin/auth/refresh").flush({ user });
    http
      .expectOne("/api/v1/admin/products")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    expect(await result).toBe(401);
    expect(session.user()).toBeNull();
    http.expectNone("/api/v1/admin/auth/refresh");
  });

  it("retains a refreshed session when the retried catalog request has a server error", async () => {
    const result = firstValueFrom(client.get("/api/v1/admin/products")).catch(
      (error) => error.status,
    );
    http
      .expectOne("/api/v1/admin/products")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    config();
    http.expectOne("/api/v1/admin/auth/refresh").flush({ user });
    http
      .expectOne("/api/v1/admin/products")
      .flush({}, { status: 500, statusText: "Server Error" });
    expect(await result).toBe(500);
    expect(session.user()?.email).toBe("admin@athlon.test");
  });

  it("denies guarded navigation after failed me and refresh without recursive retries", async () => {
    const router = TestBed.inject(Router);
    const result = firstValueFrom(
      TestBed.runInInjectionContext(() =>
        adminAuthGuard({} as never, { url: "/admin/products" } as never),
      ) as ReturnType<AdminSessionService["ensureSession"]>,
    );
    http
      .expectOne("/api/v1/admin/auth/me")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    config();
    http
      .expectOne("/api/v1/admin/auth/refresh")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    expect(router.serializeUrl((await result) as never)).toBe(
      "/admin/login?returnUrl=%2Fadmin%2Fproducts",
    );
    expect(session.user()).toBeNull();
  });

  it("does not persist credentials or session state in browser storage", async () => {
    const local = JSON.stringify(localStorage);
    const transient = JSON.stringify(sessionStorage);
    const result = firstValueFrom(session.login(user.email, "secret password"));
    config();
    const login = http.expectOne("/api/v1/admin/auth/login");
    expect(login.request.body).toEqual({
      email: user.email,
      password: "secret password",
    });
    login.flush({ user });
    await result;
    expect(JSON.stringify(localStorage)).toBe(local);
    expect(JSON.stringify(sessionStorage)).toBe(transient);
  });

  it("retains the user and current page when logout fails without refresh", async () => {
    const login = firstValueFrom(session.login(user.email, "password"));
    config();
    http.expectOne("/api/v1/admin/auth/login").flush({ user });
    await login;
    const logout = firstValueFrom(session.logout()).catch(
      (error) => error.status,
    );
    const request = http.expectOne("/api/v1/admin/auth/logout");
    expect(request.request.headers.get("x-csrf-token")).toBe("fixture-csrf");
    request.flush({}, { status: 403, statusText: "Forbidden" });
    expect(await logout).toBe(403);
    expect(session.user()?.email).toBe("admin@athlon.test");
    expect(TestBed.inject(Router).url).toBe("/");
    http.expectNone("/api/v1/admin/auth/refresh");
  });

  it("clears the user and replaces navigation with login only after confirmed logout", async () => {
    const login = firstValueFrom(session.login(user.email, "password"));
    config();
    http.expectOne("/api/v1/admin/auth/login").flush({ user });
    await login;
    const logout = firstValueFrom(session.logout());
    expect(session.user()?.email).toBe("admin@athlon.test");
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush(null, { status: 204, statusText: "No Content" });
    await logout;
    expect(session.user()).toBeNull();
    expect(TestBed.inject(Router).url).toBe("/admin/login");
  });

  it("makes no private HTTP calls on the server", async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: "server" },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    expect(
      await firstValueFrom(TestBed.inject(AdminSessionService).ensureSession()),
    ).toBe(false);
    http.expectNone(() => true);
  });

  it("waits for a pending refresh response before issuing logout and never retries the old request", async () => {
    const catalog = firstValueFrom(client.get("/api/v1/admin/products")).catch(
      () => "interrupted",
    );
    http
      .expectOne("/api/v1/admin/products")
      .flush({}, { status: 401, statusText: "Unauthorized" });
    config();
    const refresh = http.expectOne("/api/v1/admin/auth/refresh");
    const logout = firstValueFrom(session.logout());
    http.expectNone("/api/v1/admin/auth/logout");
    refresh.flush({ user });
    expect(session.user()).toBeNull();
    const last = http.expectOne("/api/v1/admin/auth/logout");
    last.flush(null, { status: 204, statusText: "No Content" });
    await logout;
    expect(await catalog).toBe("interrupted");
    expect(session.user()).toBeNull();
    expect(TestBed.inject(Router).url).toBe("/admin/login");
    http.expectNone("/api/v1/admin/products");
  });

  it("waits for pending login configuration and login cookies before issuing logout", async () => {
    const login = firstValueFrom(session.login(user.email, "password")).catch(
      () => "interrupted",
    );
    const logout = firstValueFrom(session.logout());
    config();
    http.expectNone("/api/v1/admin/auth/logout");
    http.expectOne("/api/v1/admin/auth/login").flush({ user });
    expect(session.user()).toBeNull();
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush(null, { status: 204, statusText: "No Content" });
    await logout;
    expect(await login).toBe("interrupted");
    expect(session.user()).toBeNull();
  });

  it("drains cookie-issuing work even after its original subscriber unsubscribes", async () => {
    const login = session
      .login(user.email, "password")
      .subscribe({ error: () => undefined });
    config();
    const pending = http.expectOne("/api/v1/admin/auth/login");
    login.unsubscribe();
    const logout = firstValueFrom(session.logout());
    http.expectNone("/api/v1/admin/auth/logout");
    expect(pending.cancelled).toBe(false);
    pending.flush({ user });
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush(null, { status: 204, statusText: "No Content" });
    await logout;
    expect(session.user()).toBeNull();
  });

  it("ignores a stale ensureSession response arriving after confirmed logout", async () => {
    const ensure = firstValueFrom(session.ensureSession());
    const me = http.expectOne("/api/v1/admin/auth/me");
    const logout = firstValueFrom(session.logout());
    config();
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush(null, { status: 204, statusText: "No Content" });
    await logout;
    me.flush({ user });
    expect(await ensure).toBe(false);
    expect(session.user()).toBeNull();
  });

  it("prevents new login refresh and guarded session work during logout", async () => {
    const logout = firstValueFrom(session.logout());
    config();
    const login = firstValueFrom(session.login(user.email, "password")).catch(
      () => "blocked",
    );
    const refresh = firstValueFrom(session.refresh()).catch(() => "blocked");
    expect(await firstValueFrom(session.ensureSession())).toBe(false);
    expect(await login).toBe("blocked");
    expect(await refresh).toBe("blocked");
    http.expectNone("/api/v1/admin/auth/login");
    http.expectNone("/api/v1/admin/auth/refresh");
    http.expectNone("/api/v1/admin/auth/me");
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush(null, { status: 204, statusText: "No Content" });
    await logout;
  });

  it("does not refresh or retry stale protected requests after logout but allows explicit login", async () => {
    const catalog = firstValueFrom(client.get("/api/v1/admin/products")).catch(
      (error) => error.status,
    );
    const old = http.expectOne("/api/v1/admin/products");
    const logout = firstValueFrom(session.logout());
    config();
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush(null, { status: 204, statusText: "No Content" });
    await logout;
    old.flush({}, { status: 401, statusText: "Unauthorized" });
    expect(await catalog).toBe(401);
    http.expectNone("/api/v1/admin/auth/refresh");
    expect(await firstValueFrom(session.ensureSession())).toBe(false);
    http.expectNone("/api/v1/admin/auth/me");
    const login = firstValueFrom(session.login(user.email, "password"));
    http.expectOne("/api/v1/admin/auth/login").flush({ user });
    await login;
    expect(session.user()?.email).toBe(user.email);
  });

  it("preserves an existing user on failed logout after draining refresh and allows retry", async () => {
    const login = firstValueFrom(session.login(user.email, "password"));
    config();
    http.expectOne("/api/v1/admin/auth/login").flush({ user });
    await login;
    const refresh = firstValueFrom(session.refresh()).catch(
      () => "interrupted",
    );
    const pending = http.expectOne("/api/v1/admin/auth/refresh");
    const logout = firstValueFrom(session.logout()).catch(
      (error) => error.status,
    );
    http.expectNone("/api/v1/admin/auth/logout");
    pending.flush({ user });
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush({}, { status: 503, statusText: "Unavailable" });
    expect(await logout).toBe(503);
    expect(await refresh).toBe("interrupted");
    expect(session.user()?.email).toBe(user.email);
    const retry = firstValueFrom(session.logout());
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush(null, { status: 204, statusText: "No Content" });
    await retry;
    expect(session.user()).toBeNull();
  });

  it("retires never-subscribed refresh without poisoning or clearing fresh singleflight work", async () => {
    const retired = session.refresh();
    const logout = firstValueFrom(session.logout());
    config();
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush(null, { status: 204, statusText: "No Content" });
    await logout;
    const login = firstValueFrom(session.login(user.email, "password"));
    http.expectOne("/api/v1/admin/auth/login").flush({ user });
    await login;
    const fresh = firstValueFrom(session.refresh()).catch(() => "blocked");
    const pending = http.match("/api/v1/admin/auth/refresh");
    expect(pending).toHaveLength(1);
    expect(await firstValueFrom(retired).catch(() => "retired")).toBe(
      "retired",
    );
    const concurrent = firstValueFrom(session.refresh());
    http.expectNone("/api/v1/admin/auth/refresh");
    pending[0].flush({ user });
    expect(await fresh).toBeUndefined();
    await concurrent;
    expect(session.user()).toEqual(user);
  });

  it("does not start auth observables prepared before logout when subscribed after it completes", async () => {
    const staleLogin = session.login(user.email, "password");
    const staleEnsure = session.ensureSession();
    const logout = firstValueFrom(session.logout());
    config();
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush(null, { status: 204, statusText: "No Content" });
    await logout;
    expect(await firstValueFrom(staleLogin).catch(() => "blocked")).toBe(
      "blocked",
    );
    expect(await firstValueFrom(staleEnsure)).toBe(false);
    http.expectNone("/api/v1/admin/auth/login");
    http.expectNone("/api/v1/admin/auth/me");
  });

  it("does not refresh or expire an existing user for a protected401 arriving during logout", async () => {
    const login = firstValueFrom(session.login(user.email, "password"));
    config();
    http.expectOne("/api/v1/admin/auth/login").flush({ user });
    await login;
    const catalog = firstValueFrom(client.get("/api/v1/admin/products")).catch(
      (error) => error.status,
    );
    const pending = http.expectOne("/api/v1/admin/products");
    const logout = firstValueFrom(session.logout()).catch(
      (error) => error.status,
    );
    pending.flush({}, { status: 401, statusText: "Unauthorized" });
    expect(await catalog).toBe(401);
    expect(session.user()?.email).toBe(user.email);
    expect(TestBed.inject(Router).url).toBe("/");
    http.expectNone("/api/v1/admin/auth/refresh");
    http
      .expectOne("/api/v1/admin/auth/logout")
      .flush({}, { status: 503, statusText: "Unavailable" });
    expect(await logout).toBe(503);
    expect(session.user()?.email).toBe(user.email);
  });

  it.each([
    ["/admin/products?page=2", "/admin/products?page=2"],
    ["/admin", "/admin"],
    ["https://untrusted.example/admin", "/admin"],
    ["//untrusted.example/admin", "/admin"],
    ["/hy", "/admin"],
    ["/administrator", "/admin"],
    ["/admin/login?returnUrl=x", "/admin"],
    ["/admin/../hy", "/admin"],
    ["/admin/%2e%2e/hy", "/admin"],
    ["/admin\\evil", "/admin"],
    ["/admin/login;mode=other", "/admin"],
    ["/admin/(login)", "/admin"],
    ["/admin/%00products", "/admin"],
  ])("restricts return path %s", (value, expected) => {
    expect(safeAdminReturnUrl(value)).toBe(expected);
  });
});
