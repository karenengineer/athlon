import { DOCUMENT } from "@angular/common";
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from "@angular/common/http";
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from "@angular/core";
import {
  provideClientHydration,
  withEventReplay,
} from "@angular/platform-browser";
import { provideRouter, withInMemoryScrolling } from "@angular/router";
import { provideServiceWorker } from "@angular/service-worker";
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
    // Installable app: production builds only; inert during SSR. Registered
    // once the page is idle so it never competes with the first render.
    provideServiceWorker("ngsw-worker.js", {
      enabled: !isDevMode(),
      registrationStrategy: "registerWhenStable:30000",
    }),
    // Absolute so it matches the transfer cache keys mapped in app.config.server.
    {
      provide: API_BASE_URL,
      useFactory: () => `${inject(DOCUMENT).location.origin}/api/v1`,
    },
  ],
};
