import { Routes } from "@angular/router";
import { localeGuard } from "./core/i18n/locale.guard";
import { informationPageIds } from "./core/i18n/information-navigation";
import { cardPaymentTestGuard } from "./features/admin/card-payment-test/card-payment-test.guard";
import { PublicShell } from "./layout/public-shell/public-shell";

export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "hy" },
  {
    path: "admin",
    loadChildren: () =>
      import("./features/admin/admin.routes").then(
        (module) => module.adminRoutes,
      ),
  },
  {
    path: "card-payment-test/:locale",
    canActivate: [cardPaymentTestGuard],
    children: [
      {
        path: "",
        data: { cardPaymentTestMode: true },
        loadComponent: () =>
          import("./features/basket/basket-page").then(
            (module) => module.BasketPage,
          ),
      },
      {
        path: "success/:reference",
        loadComponent: () =>
          import(
            "./features/admin/card-payment-test/payment-success-page"
          ).then((module) => module.PaymentSuccessPage),
      },
      {
        path: "payment/:reference",
        canActivate: [cardPaymentTestGuard],
        loadComponent: () =>
          import(
            "./features/admin/card-payment-test/mock-card-checkout-page"
          ).then((module) => module.MockCardCheckoutPage),
      },
    ],
  },
  {
    path: ":locale",
    component: PublicShell,
    canMatch: [localeGuard],
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
        path: "basket",
        loadComponent: () =>
          import("./features/basket/basket-page").then(
            (module) => module.BasketPage,
          ),
      },
      ...informationPageIds.map((page) => ({
        path: page,
        data: { informationPage: page },
        loadComponent: () =>
          import("./features/information/information-page").then(
            (module) => module.InformationPage,
          ),
      })),
      {
        path: "**",
        loadComponent: () =>
          import("./features/not-found/not-found-page").then(
            (module) => module.NotFoundPage,
          ),
      },
    ],
  },
  {
    path: "",
    component: PublicShell,
    children: [
      {
        path: "**",
        loadComponent: () =>
          import("./features/not-found/not-found-page").then(
            (module) => module.NotFoundPage,
          ),
      },
    ],
  },
];
