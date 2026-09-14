import { Routes } from "@angular/router";
import { localeGuard } from "./core/i18n/locale.guard";
import { PublicShell } from "./layout/public-shell/public-shell";

export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "ru" },
  {
    path: ":locale",
    component: PublicShell,
    canActivate: [localeGuard],
    children: [
      {
        path: "",
        loadComponent: () =>
          import("./features/home/home-page").then((module) => module.HomePage),
      },
      {
        path: "catalog",
        loadComponent: () =>
          import("./features/catalog/catalog-page").then(
            (module) => module.CatalogPage,
          ),
      },
      {
        path: "catalog/:categorySlug",
        loadComponent: () =>
          import("./features/catalog/catalog-page").then(
            (module) => module.CatalogPage,
          ),
      },
      {
        path: "search",
        loadComponent: () =>
          import("./features/catalog/catalog-page").then(
            (module) => module.CatalogPage,
          ),
      },
      {
        path: "product/:slug",
        loadComponent: () =>
          import("./features/product/product-page").then(
            (module) => module.ProductPage,
          ),
      },
      {
        path: "**",
        loadComponent: () =>
          import("./features/not-found/not-found-page").then(
            (module) => module.NotFoundPage,
          ),
      },
    ],
  },
  { path: "**", redirectTo: "ru" },
];
