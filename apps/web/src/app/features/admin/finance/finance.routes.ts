import { Type } from "@angular/core";
import { Routes } from "@angular/router";
import { adminDirtyFormGuard } from "../shared/admin-dirty-form.guard";

const editor = (path: string, loadComponent: () => Promise<Type<unknown>>) => ({
  path,
  canDeactivate: [adminDirtyFormGuard],
  loadComponent,
});

export const financeRoutes: Routes = [
  {
    path: "",
    pathMatch: "full",
    loadComponent: () =>
      import("./dashboard/finance-dashboard").then(
        (m) => m.FinanceDashboardPage,
      ),
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
  {
    path: "expenses",
    loadComponent: () =>
      import("./expenses/expense-list").then((m) => m.ExpenseList),
    data: { financePage: "expenses" },
  },
  editor("expenses/new", () =>
    import("./expenses/expense-editor").then((m) => m.ExpenseEditor),
  ),
  editor("expenses/:id/edit", () =>
    import("./expenses/expense-editor").then((m) => m.ExpenseEditor),
  ),
  {
    path: "recurring-expenses",
    loadComponent: () =>
      import("./expenses/recurring-expense-list").then(
        (m) => m.RecurringExpenseList,
      ),
    data: { financePage: "recurringExpenses" },
  },
  editor("recurring-expenses/new", () =>
    import("./expenses/recurring-expense-editor").then(
      (m) => m.RecurringExpenseEditor,
    ),
  ),
  editor("recurring-expenses/:id/edit", () =>
    import("./expenses/recurring-expense-editor").then(
      (m) => m.RecurringExpenseEditor,
    ),
  ),
  {
    path: "monthly-summary",
    loadComponent: () =>
      import("./summary/monthly-summary").then((m) => m.MonthlySummaryPage),
    data: { financePage: "monthlySummary" },
  },
  {
    path: "profitability",
    loadComponent: () =>
      import("./summary/profitability-list").then((m) => m.ProfitabilityList),
    data: { financePage: "profitability" },
  },
  {
    path: "export",
    loadComponent: () =>
      import("./export/export-page").then((m) => m.FinanceExportPage),
    data: { financePage: "export" },
  },
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
