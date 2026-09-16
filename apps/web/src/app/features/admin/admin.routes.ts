import { Routes } from "@angular/router";
import { AdminRoot } from "./admin-root";
import { adminAuthGuard } from "./auth/admin-auth.guard";

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
