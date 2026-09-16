import { DOCUMENT } from "@angular/common";
import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, switchMap, throwError } from "rxjs";
import { AdminSessionService } from "./admin-session.service";

export const adminHttpInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(AdminSessionService);
  const document = inject(DOCUMENT);
  if (!session.isBrowser) return next(request);
  let url: URL;
  try {
    url = new URL(request.url, document.location.origin);
  } catch {
    return next(request);
  }
  if (
    url.origin !== document.location.origin ||
    !url.pathname.startsWith("/api/v1/admin/")
  )
    return next(request);
  const withCsrf = () => {
    const token = session.csrfToken();
    return token && !["GET", "HEAD", "OPTIONS"].includes(request.method)
      ? request.clone({ setHeaders: { "x-csrf-token": token } })
      : request;
  };
  const authAction = ["login", "logout", "refresh", "config"].some(
    (action) => url.pathname === `/api/v1/admin/auth/${action}`,
  );
  return next(withCsrf()).pipe(
    catchError((error) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        authAction
      )
        return throwError(() => error);
      return session.refresh().pipe(
        catchError((retryError) => {
          session.expireSession();
          return throwError(() => retryError);
        }),
        switchMap(() =>
          next(withCsrf()).pipe(
            catchError((retryError) => {
              if (
                retryError instanceof HttpErrorResponse &&
                retryError.status === 401
              )
                session.expireSession();
              return throwError(() => retryError);
            }),
          ),
        ),
      );
    }),
  );
};
