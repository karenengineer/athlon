import { DOCUMENT, isPlatformBrowser } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Injectable, PLATFORM_ID, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import {
  Observable,
  catchError,
  defer,
  finalize,
  forkJoin,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from "rxjs";
import { AdminUser } from "../shared/admin-api.types";

@Injectable({ providedIn: "root" })
export class AdminSessionService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly user = signal<AdminUser | null>(null);
  private csrfCookieName = "athlon_csrf";
  private configRequest?: Observable<void>;
  private sessionRequest?: Observable<boolean>;
  private refreshRequest?: Observable<void>;
  private logoutRequest?: Observable<void>;
  private readonly cookieOperations = new Set<Observable<void>>();
  private generation = 0;
  private loggingOut = false;
  private loggedOut = false;

  get sessionEpoch(): number {
    return this.generation;
  }
  canRetry(epoch: number): boolean {
    return epoch === this.generation && !this.loggingOut && !this.loggedOut;
  }

  ensureSession(): Observable<boolean> {
    const epoch = this.generation;
    return defer(() =>
      this.canRetry(epoch) ? this.checkSession(epoch) : of(false),
    );
  }

  private checkSession(epoch: number): Observable<boolean> {
    if (!this.isBrowser || this.loggingOut || this.loggedOut) return of(false);
    if (this.user()) return of(true);
    if (!this.sessionRequest) {
      this.sessionRequest = this.http
        .get<{ user: AdminUser }>("/api/v1/admin/auth/me")
        .pipe(
          switchMap((response) =>
            this.canRetry(epoch)
              ? this.configureCsrf().pipe(
                  map(() => {
                    if (!this.canRetry(epoch)) return false;
                    this.user.set(response.user);
                    return true;
                  }),
                )
              : of(false),
          ),
          catchError(() => {
            if (this.canRetry(epoch)) this.user.set(null);
            return of(false);
          }),
          finalize(() => {
            if (epoch === this.generation) this.sessionRequest = undefined;
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.sessionRequest;
  }

  login(email: string, password: string): Observable<void> {
    const epoch = this.generation;
    return defer(() => {
      if (this.loggingOut || epoch !== this.generation)
        return this.interrupted();
      return this.trackCookieOperation(
        this.configureCsrf().pipe(
          switchMap(() =>
            this.http.post<{ user: AdminUser }>("/api/v1/admin/auth/login", {
              email,
              password,
            }),
          ),
          tap((response) => {
            if (epoch !== this.generation || this.loggingOut)
              throw new Error("Session transition interrupted login");
            this.loggedOut = false;
            this.user.set(response.user);
          }),
          map(() => undefined),
        ),
      );
    });
  }

  refresh(): Observable<void> {
    if (this.loggingOut || this.loggedOut) return this.interrupted();
    if (!this.refreshRequest) {
      const epoch = this.generation;
      const request = defer(() => {
        if (!this.canRetry(epoch)) return this.interrupted();
        return this.trackCookieOperation(
          this.configureCsrf().pipe(
            switchMap(() =>
              this.http.post<{ user: AdminUser }>(
                "/api/v1/admin/auth/refresh",
                {},
              ),
            ),
            tap((response) => {
              if (!this.canRetry(epoch))
                throw new Error("Session transition interrupted refresh");
              this.user.set(response.user);
            }),
            map(() => undefined),
            catchError((error) => {
              if (this.canRetry(epoch)) this.user.set(null);
              return throwError(() => error);
            }),
          ),
        );
      }).pipe(
        finalize(() => {
          if (this.refreshRequest === request) this.refreshRequest = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.refreshRequest = request;
    }
    return this.refreshRequest;
  }

  logout(): Observable<void> {
    if (!this.logoutRequest)
      this.logoutRequest = defer(() => {
        this.loggingOut = true;
        this.generation++;
        this.sessionRequest = undefined;
        this.refreshRequest = undefined;
        // Wait for real responses (including Set-Cookie), not only frontend taps.
        // refCount:false keeps started operations alive after caller cancellation.
        const pending = [...this.cookieOperations].map((operation) =>
          operation.pipe(catchError(() => of(undefined))),
        );
        return (
          pending.length
            ? forkJoin(pending).pipe(map(() => undefined))
            : of(undefined)
        ).pipe(
          switchMap(() => this.configureCsrf()),
          switchMap(() =>
            this.http.post<void>("/api/v1/admin/auth/logout", {}),
          ),
          tap(() => {
            this.loggedOut = true;
            this.user.set(null);
          }),
          switchMap(() =>
            from(
              this.router.navigateByUrl("/admin/login", { replaceUrl: true }),
            ),
          ),
          map(() => undefined),
        );
      }).pipe(
        finalize(() => {
          this.loggingOut = false;
          this.logoutRequest = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.logoutRequest;
  }

  private interrupted(): Observable<never> {
    return throwError(
      () => new Error("Session transition prevents authentication work"),
    );
  }

  private trackCookieOperation(source: Observable<void>): Observable<void> {
    const operation = source.pipe(
      finalize(() => this.cookieOperations.delete(operation)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.cookieOperations.add(operation);
    return operation;
  }

  csrfToken(): string | null {
    if (!this.isBrowser) return null;
    const cookie = this.document.cookie
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${this.csrfCookieName}=`));
    if (!cookie) return null;
    try {
      return decodeURIComponent(cookie.slice(this.csrfCookieName.length + 1));
    } catch {
      return null;
    }
  }

  expireSession(): void {
    if (this.loggingOut || this.loggedOut) return;
    this.user.set(null);
    if (
      this.isBrowser &&
      /^\/admin(?:\/|\?|#|$)/.test(this.router.url) &&
      !this.router.url.startsWith("/admin/login")
    ) {
      void this.router.navigate(["/admin/login"], {
        queryParams: { returnUrl: this.router.url },
        replaceUrl: true,
      });
    }
  }

  private configureCsrf(): Observable<void> {
    if (!this.configRequest) {
      this.configRequest = this.http
        .get<{ csrfCookieName: string }>("/api/v1/admin/auth/config")
        .pipe(
          tap((response) => (this.csrfCookieName = response.csrfCookieName)),
          map(() => undefined),
          catchError((error) => {
            this.configRequest = undefined;
            return throwError(() => error);
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.configRequest;
  }
}
