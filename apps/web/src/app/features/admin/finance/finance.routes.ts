import { Routes } from "@angular/router";
import { adminDirtyFormGuard } from "../shared/admin-dirty-form.guard";

const editor = (path: string) => ({
  path,
  canDeactivate: [adminDirtyFormGuard],
  children: [],
});

/**
 * Task-specific pages are attached to these lazy route records by the
 * transaction and reporting UI tasks. Keeping the paths here makes deep links
 * and guard policy part of the shared finance contract from the outset.
 */
export const financeRoutes: Routes = [
  {
    path: "",
    pathMatch: "full",
    children: [],
    data: { financePage: "dashboard" },
  },
  { path: "products", children: [], data: { financePage: "products" } },
  { path: "purchases", children: [], data: { financePage: "purchases" } },
  editor("purchases/new"),
  editor("purchases/:id/edit"),
  { path: "sales", children: [], data: { financePage: "sales" } },
  editor("sales/new"),
  editor("sales/:id/edit"),
  { path: "expenses", children: [], data: { financePage: "expenses" } },
  editor("expenses/new"),
  editor("expenses/:id/edit"),
  {
    path: "recurring-expenses",
    children: [],
    data: { financePage: "recurringExpenses" },
  },
  editor("recurring-expenses/new"),
  editor("recurring-expenses/:id/edit"),
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
  { path: "suppliers", children: [], data: { financePage: "suppliers" } },
  editor("suppliers/new"),
  editor("suppliers/:id/edit"),
];
