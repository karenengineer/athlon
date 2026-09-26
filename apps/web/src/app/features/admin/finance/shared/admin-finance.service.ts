import { HttpClient, HttpParams, HttpResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { map, Observable, of, switchMap } from "rxjs";
import {
  Expense,
  ExpenseBreakdownRow,
  ExpenseCategory,
  ExpenseCategoryInput,
  ExpenseCategoryQuery,
  ExpenseInput,
  ExpenseQuery,
  FinanceDashboard,
  FinanceDownload,
  FinanceExportEndpoint,
  FinanceExportQuery,
  FinanceList,
  FinanceProductQuery,
  FinanceProductRow,
  MonthlySummary,
  MonthlySummaryQuery,
  ProductProfitabilityRow,
  ProfitabilityQuery,
  Purchase,
  PurchaseInput,
  PurchaseQuery,
  RecurringExpense,
  RecurringExpenseInput,
  RecurringExpenseQuery,
  ReportQuery,
  Sale,
  SaleInput,
  SaleQuery,
  Supplier,
  SupplierInput,
  SupplierQuery,
} from "./finance-api.types";

type QueryValue = string | number | boolean | null | undefined;

function httpParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, rawValue] of Object.entries(query)) {
    const value = rawValue as QueryValue;
    if (value !== undefined && value !== null && value !== "")
      params = params.set(key, String(value));
  }
  return params;
}

function contentDispositionFilename(value: string | null): string | null {
  if (!value) return null;
  const encoded = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim());
    } catch {
      // Fall through to the plain filename or the safe default.
    }
  }
  return (
    value.match(/filename\s*=\s*(?:"([^"]+)"|([^;\s]+))/i)?.[1] ??
    value.match(/filename\s*=\s*(?:"([^"]+)"|([^;\s]+))/i)?.[2] ??
    null
  );
}

export function safeDownloadFilename(
  contentDisposition: string | null,
  fallback = "athlon-finance-download",
): string {
  const provided = contentDispositionFilename(contentDisposition);
  const basename = provided?.split(/[\\/]/).pop()?.trim();
  const safe = basename
    ?.split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 180)
    .trim();
  return safe && safe !== "." && safe !== ".." ? safe : fallback;
}

@Injectable({ providedIn: "root" })
export class AdminFinanceService {
  private readonly http = inject(HttpClient);
  private readonly base = "/api/v1/admin/finance";

  dashboard(query: ReportQuery = {}): Observable<FinanceDashboard> {
    return this.get("dashboard", query);
  }

  listProducts(
    query: FinanceProductQuery = {},
  ): Observable<FinanceList<FinanceProductRow>> {
    return this.get("products", query);
  }

  allProducts(page = 1): Observable<FinanceProductRow[]> {
    return this.listProducts({ page, pageSize: 100, sort: "nameAsc" }).pipe(
      switchMap((list) =>
        list.meta.page < list.meta.totalPages
          ? this.allProducts(page + 1).pipe(
              map((rest) => [...list.items, ...rest]),
            )
          : of(list.items),
      ),
    );
  }

  listSuppliers(query: SupplierQuery = {}): Observable<FinanceList<Supplier>> {
    return this.get("suppliers", query);
  }

  allSuppliers(page = 1): Observable<Supplier[]> {
    return this.listSuppliers({
      page,
      pageSize: 100,
      active: true,
      sort: "name",
    }).pipe(
      switchMap((list) =>
        list.meta.page < list.meta.totalPages
          ? this.allSuppliers(page + 1).pipe(
              map((rest) => [...list.items, ...rest]),
            )
          : of(list.items),
      ),
    );
  }

  getSupplier(id: string): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.base}/suppliers/${id}`);
  }

  createSupplier(input: SupplierInput): Observable<Supplier> {
    return this.http.post<Supplier>(`${this.base}/suppliers`, input);
  }

  updateSupplier(
    id: string,
    input: Partial<SupplierInput>,
  ): Observable<Supplier> {
    return this.http.patch<Supplier>(`${this.base}/suppliers/${id}`, input);
  }

  deleteSupplier(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/suppliers/${id}`);
  }

  listPurchases(query: PurchaseQuery = {}): Observable<FinanceList<Purchase>> {
    return this.get("purchases", query);
  }

  getPurchase(id: string): Observable<Purchase> {
    return this.http.get<Purchase>(`${this.base}/purchases/${id}`);
  }

  createPurchase(input: PurchaseInput): Observable<Purchase> {
    return this.http.post<Purchase>(`${this.base}/purchases`, input);
  }

  updatePurchase(
    id: string,
    input: Partial<PurchaseInput>,
  ): Observable<Purchase> {
    return this.http.patch<Purchase>(`${this.base}/purchases/${id}`, input);
  }

  deletePurchase(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/purchases/${id}`);
  }

  listSales(query: SaleQuery = {}): Observable<FinanceList<Sale>> {
    return this.get("sales", query);
  }

  getSale(id: string): Observable<Sale> {
    return this.http.get<Sale>(`${this.base}/sales/${id}`);
  }

  createSale(input: SaleInput): Observable<Sale> {
    return this.http.post<Sale>(`${this.base}/sales`, input);
  }

  updateSale(id: string, input: Partial<SaleInput>): Observable<Sale> {
    return this.http.patch<Sale>(`${this.base}/sales/${id}`, input);
  }

  deleteSale(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/sales/${id}`);
  }

  listExpenseCategories(
    query: ExpenseCategoryQuery = {},
  ): Observable<FinanceList<ExpenseCategory>> {
    return this.get("expense-categories", query);
  }
  allExpenseCategories(page = 1): Observable<ExpenseCategory[]> {
    return this.listExpenseCategories({ page, pageSize: 100 }).pipe(
      switchMap((list) =>
        list.meta.page < list.meta.totalPages
          ? this.allExpenseCategories(page + 1).pipe(
              map((rest) => [...list.items, ...rest]),
            )
          : of(list.items),
      ),
    );
  }

  createExpenseCategory(
    input: ExpenseCategoryInput,
  ): Observable<ExpenseCategory> {
    return this.http.post<ExpenseCategory>(
      `${this.base}/expense-categories`,
      input,
    );
  }

  updateExpenseCategory(
    id: string,
    input: Partial<ExpenseCategoryInput>,
  ): Observable<ExpenseCategory> {
    return this.http.patch<ExpenseCategory>(
      `${this.base}/expense-categories/${id}`,
      input,
    );
  }

  listExpenses(query: ExpenseQuery = {}): Observable<FinanceList<Expense>> {
    return this.get("expenses", query);
  }

  getExpense(id: string): Observable<Expense> {
    return this.http.get<Expense>(`${this.base}/expenses/${id}`);
  }

  createExpense(input: ExpenseInput): Observable<Expense> {
    return this.http.post<Expense>(`${this.base}/expenses`, input);
  }

  updateExpense(id: string, input: Partial<ExpenseInput>): Observable<Expense> {
    return this.http.patch<Expense>(`${this.base}/expenses/${id}`, input);
  }

  deleteExpense(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/expenses/${id}`);
  }

  listRecurringExpenses(
    query: RecurringExpenseQuery = {},
  ): Observable<FinanceList<RecurringExpense>> {
    return this.get("recurring-expenses", query);
  }

  getRecurringExpense(id: string): Observable<RecurringExpense> {
    return this.http.get<RecurringExpense>(
      `${this.base}/recurring-expenses/${id}`,
    );
  }

  createRecurringExpense(
    input: RecurringExpenseInput,
  ): Observable<RecurringExpense> {
    return this.http.post<RecurringExpense>(
      `${this.base}/recurring-expenses`,
      input,
    );
  }

  updateRecurringExpense(
    id: string,
    input: Partial<RecurringExpenseInput>,
  ): Observable<RecurringExpense> {
    return this.http.patch<RecurringExpense>(
      `${this.base}/recurring-expenses/${id}`,
      input,
    );
  }

  deleteRecurringExpense(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/recurring-expenses/${id}`);
  }

  monthlySummary(query: MonthlySummaryQuery): Observable<MonthlySummary> {
    return this.get("monthly-summary", query);
  }

  profitability(
    query: ProfitabilityQuery = {},
  ): Observable<FinanceList<ProductProfitabilityRow>> {
    return this.get("profitability", query);
  }

  expenseBreakdown(query: ReportQuery = {}): Observable<ExpenseBreakdownRow[]> {
    return this.get("expense-breakdown", query);
  }

  exportProducts(query: FinanceProductQuery = {}): Observable<FinanceDownload> {
    return this.download("products.csv", query);
  }

  exportPurchases(query: PurchaseQuery = {}): Observable<FinanceDownload> {
    return this.download("purchases.csv", query);
  }

  exportSales(query: SaleQuery = {}): Observable<FinanceDownload> {
    return this.download("sales.csv", query);
  }

  exportExpenses(query: ExpenseQuery = {}): Observable<FinanceDownload> {
    return this.download("expenses.csv", query);
  }

  exportMonthlySummary(
    query: MonthlySummaryQuery,
  ): Observable<FinanceDownload> {
    return this.download("monthly-summary.csv", query);
  }

  exportProfitability(
    query: ProfitabilityQuery = {},
  ): Observable<FinanceDownload> {
    return this.download("profitability.csv", query);
  }

  exportAccounting(query: ReportQuery = {}): Observable<FinanceDownload> {
    return this.download("accounting.xlsx", query);
  }

  download(
    endpoint: FinanceExportEndpoint,
    query: FinanceExportQuery = {},
  ): Observable<FinanceDownload> {
    return this.http
      .get(`${this.base}/exports/${endpoint}`, {
        params: httpParams(query),
        observe: "response",
        responseType: "blob",
      })
      .pipe(
        map((response: HttpResponse<Blob>) => ({
          blob: response.body ?? new Blob(),
          filename: safeDownloadFilename(
            response.headers.get("Content-Disposition"),
            `athlon-${endpoint}`,
          ),
        })),
      );
  }

  private get<T>(resource: string, query: object): Observable<T> {
    return this.http.get<T>(`${this.base}/${resource}`, {
      params: httpParams(query),
    });
  }
}
