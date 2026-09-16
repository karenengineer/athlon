import { DOCUMENT, isPlatformBrowser } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Injectable, PLATFORM_ID, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import {
  Observable,
  catchError,
  finalize,
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

  ensureSession(): Observable<boolean> {
    if (!this.isBrowser) return of(false);
    if (this.user()) return of(true);
    if (!this.sessionRequest) {
      this.sessionRequest = this.http
        .get<{ user: AdminUser }>("/api/v1/admin/auth/me")
        .pipe(
          switchMap((response) =>
            this.configureCsrf().pipe(
              tap(() => this.user.set(response.user)),
              map(() => true),
            ),
          ),
          catchError(() => {
            this.user.set(null);
            return of(false);
          }),
          finalize(() => (this.sessionRequest = undefined)),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }
    return this.sessionRequest;
  }

  login(email: string, password: string): Observable<void> {
    return this.configureCsrf().pipe(
      switchMap(() =>
        this.http.post<{ user: AdminUser }>("/api/v1/admin/auth/login", {
          email,
          password,
        }),
      ),
      tap((response) => this.user.set(response.user)),
      map(() => undefined),
    );
  }

  refresh(): Observable<void> {
    if (!this.refreshRequest) {
      this.refreshRequest = this.configureCsrf().pipe(
        switchMap(() =>
          this.http.post<{ user: AdminUser }>("/api/v1/admin/auth/refresh", {}),
        ),
        tap((response) => this.user.set(response.user)),
        map(() => undefined),
        catchError((error) => {
          this.user.set(null);
          return throwError(() => error);
        }),
        finalize(() => (this.refreshRequest = undefined)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.refreshRequest;
  }

  logout(): Observable<void> {
    return this.configureCsrf().pipe(
      switchMap(() => this.http.post<void>("/api/v1/admin/auth/logout", {})),
      tap(() => this.user.set(null)),
      switchMap(() =>
        from(this.router.navigateByUrl("/admin/login", { replaceUrl: true })),
      ),
      map(() => undefined),
    );
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
