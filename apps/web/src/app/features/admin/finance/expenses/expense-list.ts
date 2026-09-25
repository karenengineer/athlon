import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { DeleteConfirmation } from "../../shared/delete-confirmation";
import { AdminFinanceService } from "../shared/admin-finance.service";
import {
  Expense,
  ExpenseCategory,
  ExpenseQuery,
  FinanceList,
} from "../shared/finance-api.types";
import { formatAmd, formatFinanceDate } from "../shared/finance-format";
import { saveFinanceDownload } from "../export/save-download";

@Component({
  selector: "app-finance-expense-list",
  imports: [ReactiveFormsModule, RouterLink, DeleteConfirmation],
  templateUrl: "./expense-list.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class ExpenseList {
  private readonly api = inject(AdminFinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly list = signal<FinanceList<Expense> | null>(null);
  readonly categories = signal<ExpenseCategory[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly deleting = signal(false);
  readonly pendingDelete = signal<Expense | null>(null);
  readonly money = formatAmd;
  readonly date = formatFinanceDate;
  readonly filters = new FormGroup({
    q: new FormControl("", { nonNullable: true }),
    dateFrom: new FormControl("", { nonNullable: true }),
    dateTo: new FormControl("", { nonNullable: true }),
    categoryId: new FormControl("", { nonNullable: true }),
    source: new FormControl("", { nonNullable: true }),
    paymentMethod: new FormControl("", { nonNullable: true }),
    sort: new FormControl("dateDesc", { nonNullable: true }),
  });
  private query: ExpenseQuery = {};
  private request?: Subscription;
  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        const page = Number(p.get("page"));
        const sort = [
          "dateDesc",
          "dateAsc",
          "amountDesc",
          "amountAsc",
        ].includes(p.get("sort") || "")
          ? (p.get("sort") as ExpenseQuery["sort"])
          : "dateDesc";
        this.query = {
          page: Number.isInteger(page) && page > 0 ? page : 1,
          pageSize: 24,
          q: p.get("q") || undefined,
          dateFrom: p.get("dateFrom") || undefined,
          dateTo: p.get("dateTo") || undefined,
          categoryId: p.get("categoryId") || undefined,
          source: ["ONE_TIME", "RECURRING_OCCURRENCE"].includes(
            p.get("source") || "",
          )
            ? (p.get("source") as ExpenseQuery["source"])
            : undefined,
          paymentMethod: p.get("paymentMethod") || undefined,
          sort,
        };
        this.filters.setValue({
          q: this.query.q || "",
          dateFrom: this.query.dateFrom || "",
          dateTo: this.query.dateTo || "",
          categoryId: this.query.categoryId || "",
          source: this.query.source || "",
          paymentMethod: this.query.paymentMethod || "",
          sort: sort || "dateDesc",
        });
        this.load();
      });
    this.api
      .listExpenseCategories({ pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.categories.set(r.items),
        error: () => this.error.set("Could not load expense categories."),
      });
  }
  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api
      .listExpenses(this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.list.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load expenses.");
        },
      });
  }
  visible(): Expense[] {
    return this.list()?.items || [];
  }
  search(): void {
    const v = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: v.q.trim() || null,
        dateFrom: v.dateFrom || null,
        dateTo: v.dateTo || null,
        categoryId: v.categoryId || null,
        source: v.source || null,
        paymentMethod: v.paymentMethod.trim() || null,
        sort: v.sort === "dateDesc" ? null : v.sort,
      },
    });
  }
  clear(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }
  page(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: "merge",
      queryParams: { page: page === 1 ? null : page },
    });
  }
  export(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.error.set(null);
    this.api
      .download("expenses.csv", this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (file) => {
          saveFinanceDownload(file);
          this.exporting.set(false);
        },
        error: () => {
          this.exporting.set(false);
          this.error.set("Could not export expenses.");
        },
      });
  }
  confirmDelete(confirmed: boolean): void {
    const item = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!confirmed || !item) return;
    this.deleting.set(true);
    this.api
      .deleteExpense(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.load();
        },
        error: () => {
          this.deleting.set(false);
          this.error.set("Could not delete expense.");
        },
      });
  }
}
