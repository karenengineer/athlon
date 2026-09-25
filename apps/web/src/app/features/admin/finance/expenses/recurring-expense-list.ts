import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { DeleteConfirmation } from "../../shared/delete-confirmation";
import { AdminFinanceService } from "../shared/admin-finance.service";
import {
  ExpenseCategory,
  FinanceList,
  RecurringExpense,
  RecurringExpenseQuery,
} from "../shared/finance-api.types";
import { formatAmd, formatFinanceDate } from "../shared/finance-format";

@Component({
  selector: "app-finance-recurring-list",
  imports: [ReactiveFormsModule, RouterLink, DeleteConfirmation],
  templateUrl: "./recurring-expense-list.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class RecurringExpenseList {
  private readonly api = inject(AdminFinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly list = signal<FinanceList<RecurringExpense> | null>(null);
  readonly categories = signal<ExpenseCategory[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pendingDelete = signal<RecurringExpense | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly money = formatAmd;
  readonly date = formatFinanceDate;
  readonly filters = new FormGroup({
    q: new FormControl("", { nonNullable: true }),
    categoryId: new FormControl("", { nonNullable: true }),
    active: new FormControl("", { nonNullable: true }),
    paymentMethod: new FormControl("", { nonNullable: true }),
    sort: new FormControl("name", { nonNullable: true }),
  });
  private query: RecurringExpenseQuery = {};
  private request?: Subscription;
  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        const sort = ["name", "startDesc", "updated"].includes(
          p.get("sort") || "",
        )
          ? (p.get("sort") as RecurringExpenseQuery["sort"])
          : "name";
        const active = p.get("active");
        this.query = {
          q: p.get("q") || undefined,
          categoryId: p.get("categoryId") || undefined,
          active:
            active === "true" ? true : active === "false" ? false : undefined,
          paymentMethod: p.get("paymentMethod") || undefined,
          sort,
          page: Math.max(1, Number(p.get("page")) || 1),
          pageSize: 24,
        };
        this.filters.setValue({
          q: this.query.q || "",
          categoryId: this.query.categoryId || "",
          active: active || "",
          paymentMethod: this.query.paymentMethod || "",
          sort: sort || "name",
        });
        this.load();
      });
    this.api
      .listExpenseCategories({ pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => this.categories.set(r.items),
        error: () => this.error.set("Could not load categories."),
      });
  }
  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api
      .listRecurringExpenses(this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.list.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load recurring templates.");
        },
      });
  }
  visible(): RecurringExpense[] {
    return this.list()?.items || [];
  }
  search(): void {
    const v = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: v.q.trim() || null,
        categoryId: v.categoryId || null,
        active: v.active || null,
        paymentMethod: v.paymentMethod.trim() || null,
        sort: v.sort === "name" ? null : v.sort,
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
  toggle(item: RecurringExpense): void {
    if (this.busyId()) return;
    this.busyId.set(item.id);
    this.api
      .updateRecurringExpense(item.id, { active: !item.active })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.load();
        },
        error: () => {
          this.busyId.set(null);
          this.error.set("Could not change template status.");
        },
      });
  }
  confirmDelete(confirmed: boolean): void {
    const item = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!confirmed || !item) return;
    this.busyId.set(item.id);
    this.api
      .deleteRecurringExpense(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busyId.set(null);
          this.load();
        },
        error: () => {
          this.busyId.set(null);
          this.error.set("Could not delete recurring template.");
        },
      });
  }
}
