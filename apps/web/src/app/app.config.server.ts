import { mergeApplicationConfig, ApplicationConfig } from "@angular/core";
import { provideServerRendering, withRoutes } from "@angular/ssr";
import { appConfig } from "./app.config";
import { serverRoutes } from "./app.routes.server";
import { API_BASE_URL } from "./core/api/api-base-url";

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: API_BASE_URL,
      useFactory: () =>
        process.env["SSR_API_BASE_URL"] ?? "http://localhost:3000/api/v1",
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
