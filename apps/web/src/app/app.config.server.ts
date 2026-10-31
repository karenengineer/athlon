import { HTTP_TRANSFER_CACHE_ORIGIN_MAP } from "@angular/common/http";
import {
  mergeApplicationConfig,
  ApplicationConfig,
  inject,
  REQUEST,
} from "@angular/core";
import { provideServerRendering, withRoutes } from "@angular/ssr";
import { appConfig } from "./app.config";
import { serverRoutes } from "./app.routes.server";
import { API_BASE_URL } from "./core/api/api-base-url";
import { apiTransferOriginMap } from "./core/api/api-transfer-origin";

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: API_BASE_URL,
      useFactory: () =>
        process.env["SSR_API_BASE_URL"] ?? "http://localhost:3000/api/v1",
    },
    {
      provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP,
      useFactory: () =>
        apiTransferOriginMap(
          inject(API_BASE_URL),
          inject(REQUEST, { optional: true })?.url,
        ),
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
