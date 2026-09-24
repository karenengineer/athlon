import { Type } from "@angular/core";
import { Routes } from "@angular/router";
import { adminDirtyFormGuard } from "../shared/admin-dirty-form.guard";

const editor = (path: string, loadComponent: () => Promise<Type<unknown>>) => ({
  path,
  canDeactivate: [adminDirtyFormGuard],
  loadComponent,
});
const guardedPlaceholder = (path: string) => ({
  path,
  canDeactivate: [adminDirtyFormGuard],
  children: [],
});

export const financeRoutes: Routes = [
  {
    path: "",
    pathMatch: "full",
    children: [],
    data: { financePage: "dashboard" },
  },
  {
    path: "products",
    loadComponent: () =>
      import("./products/finance-product-list").then(
        (m) => m.FinanceProductList,
      ),
    data: { financePage: "products" },
  },
  {
    path: "purchases",
    loadComponent: () =>
      import("./purchases/purchase-list").then((m) => m.PurchaseList),
    data: { financePage: "purchases" },
  },
  editor("purchases/new", () =>
    import("./purchases/purchase-editor").then((m) => m.PurchaseEditor),
  ),
  editor("purchases/:id/edit", () =>
    import("./purchases/purchase-editor").then((m) => m.PurchaseEditor),
  ),
  {
    path: "sales",
    loadComponent: () => import("./sales/sale-list").then((m) => m.SaleList),
    data: { financePage: "sales" },
  },
  editor("sales/new", () =>
    import("./sales/sale-editor").then((m) => m.SaleEditor),
  ),
  editor("sales/:id/edit", () =>
    import("./sales/sale-editor").then((m) => m.SaleEditor),
  ),
  { path: "expenses", children: [], data: { financePage: "expenses" } },
  guardedPlaceholder("expenses/new"),
  guardedPlaceholder("expenses/:id/edit"),
  {
    path: "recurring-expenses",
    children: [],
    data: { financePage: "recurringExpenses" },
  },
  guardedPlaceholder("recurring-expenses/new"),
  guardedPlaceholder("recurring-expenses/:id/edit"),
  {
    path: "monthly-summary",
    children: [],
    data: { financePage: "monthlySummary" },
  },
  {
    path: "profitability",
    children: [],
    data: { financePage: "profitability" },
  },
  { path: "export", children: [], data: { financePage: "export" } },
  {
    path: "suppliers",
    loadComponent: () =>
      import("./suppliers/supplier-list").then((m) => m.SupplierList),
    data: { financePage: "suppliers" },
  },
  editor("suppliers/new", () =>
    import("./suppliers/supplier-editor").then((m) => m.SupplierEditor),
  ),
  editor("suppliers/:id/edit", () =>
    import("./suppliers/supplier-editor").then((m) => m.SupplierEditor),
  ),
];
