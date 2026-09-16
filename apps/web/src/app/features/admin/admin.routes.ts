import { Routes } from "@angular/router";
import { AdminRoot } from "./admin-root";
import { adminAuthGuard } from "./auth/admin-auth.guard";
import { adminDirtyFormGuard } from "./shared/admin-dirty-form.guard";

export const adminRoutes: Routes = [
  {
    path: "",
    component: AdminRoot,
    children: [
      {
        path: "login",
        loadComponent: () =>
          import("./auth/login-page").then((module) => module.LoginPage),
      },
      {
        path: "",
        canActivate: [adminAuthGuard],
        loadComponent: () =>
          import("./admin-shell").then((module) => module.AdminShell),
        children: [
          {
            path: "categories/new",
            canDeactivate: [adminDirtyFormGuard],
            loadComponent: () =>
              import("./categories/category-editor").then(
                (module) => module.CategoryEditor,
              ),
          },
          {
            path: "categories/:id",
            canDeactivate: [adminDirtyFormGuard],
            loadComponent: () =>
              import("./categories/category-editor").then(
                (module) => module.CategoryEditor,
              ),
          },
          {
            path: "categories",
            loadComponent: () =>
              import("./categories/category-list").then(
                (module) => module.CategoryList,
              ),
          },
          {
            path: "brands/new",
            canDeactivate: [adminDirtyFormGuard],
            loadComponent: () =>
              import("./brands/brand-editor").then(
                (module) => module.BrandEditor,
              ),
          },
          {
            path: "brands/:id",
            canDeactivate: [adminDirtyFormGuard],
            loadComponent: () =>
              import("./brands/brand-editor").then(
                (module) => module.BrandEditor,
              ),
          },
          {
            path: "brands",
            loadComponent: () =>
              import("./brands/brand-list").then((module) => module.BrandList),
          },
          {
            path: "",
            pathMatch: "full",
            loadComponent: () =>
              import("./dashboard/dashboard-page").then(
                (module) => module.DashboardPage,
              ),
          },
        ],
      },
      { path: "**", redirectTo: "" },
    ],
  },
];
