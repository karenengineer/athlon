import { DOCUMENT } from "@angular/common";
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from "@angular/common/http";
import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from "@angular/core";
import {
  provideClientHydration,
  withEventReplay,
} from "@angular/platform-browser";
import { provideRouter, withInMemoryScrolling } from "@angular/router";
import { routes } from "./app.routes";
import { API_BASE_URL } from "./core/api/api-base-url";
import { adminHttpInterceptor } from "./features/admin/auth/admin-http.interceptor";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([adminHttpInterceptor])),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: "top" }),
    ),
    provideClientHydration(withEventReplay()),
    // Absolute so it matches the transfer cache keys mapped in app.config.server.
    {
      provide: API_BASE_URL,
      useFactory: () => `${inject(DOCUMENT).location.origin}/api/v1`,
    },
  ],
};
