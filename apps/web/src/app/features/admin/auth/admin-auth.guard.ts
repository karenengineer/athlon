import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { map } from "rxjs";
import { AdminSessionService } from "./admin-session.service";

export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return inject(AdminSessionService)
    .ensureSession()
    .pipe(
      map(
        (valid) =>
          valid ||
          router.createUrlTree(["/admin/login"], {
            queryParams: { returnUrl: safeAdminReturnUrl(state.url) },
          }),
      ),
    );
};

export function safeAdminReturnUrl(value: string | null): string {
  if (
    !value ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) <= 32)
  )
    return "/admin";
  try {
    const decoded = decodeURIComponent(value.split(/[?#]/)[0]);
    const safeCardPaymentTestPath =
      /^\/card-payment-test\/(?:hy|ru|en)(?:\/payment\/[a-zA-Z0-9._~-]+)?\/?$/.test(
        decoded,
      );
    const safeAdminPath =
      /^\/admin(?:\/[a-zA-Z0-9._~-]+)*\/?$/.test(decoded) &&
      !/^\/admin\/login(?:\/|$)/.test(decoded);
    if (
      decoded.split("/").some((part) => part === "." || part === "..") ||
      (!safeAdminPath && !safeCardPaymentTestPath)
    )
      return "/admin";
    return value;
  } catch {
    return "/admin";
  }
}
