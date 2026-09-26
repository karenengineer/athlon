import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { forkJoin, Subscription } from "rxjs";
import { saveFinanceDownload } from "../export/save-download";
import { AdminFinanceService } from "../shared/admin-finance.service";
import {
  ExpenseBreakdownRow,
  ExpenseCategory,
  MonthlySummary,
  MonthlySummaryQuery,
} from "../shared/finance-api.types";
import { formatAmd, formatPercent } from "../shared/finance-format";

@Component({
  selector: "app-finance-monthly-summary",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./monthly-summary.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class MonthlySummaryPage {
  private readonly api = inject(AdminFinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly summary = signal<MonthlySummary | null>(null);
  readonly breakdown = signal<ExpenseBreakdownRow[]>([]);
  readonly categories = signal<ExpenseCategory[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly money = formatAmd;
  readonly percent = formatPercent;
  readonly filters = new FormGroup({
    year: new FormControl(new Date().getFullYear(), { nonNullable: true }),
    month: new FormControl("", { nonNullable: true }),
    expenseCategoryId: new FormControl("", { nonNullable: true }),
  });
  private query: MonthlySummaryQuery = { year: new Date().getFullYear() };
  private request?: Subscription;
  constructor() {
    this.api
      .allExpenseCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () => this.error.set("Could not load expense categories."),
      });
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        const year = Number(p.get("year"));
        const month = Number(p.get("month"));
        this.query = {
          year:
            Number.isInteger(year) && year >= 2000 && year <= 2100
              ? year
              : new Date().getFullYear(),
          month:
            p.has("month") &&
            Number.isInteger(month) &&
            month >= 1 &&
            month <= 12
              ? month
              : undefined,
          expenseCategoryId: p.get("expenseCategoryId") || undefined,
        };
        this.filters.setValue({
          year: this.query.year,
          month: this.query.month ? String(this.query.month) : "",
          expenseCategoryId: this.query.expenseCategoryId || "",
        });
        this.load();
      });
  }
  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = forkJoin({
      summary: this.api.monthlySummary(this.query),
      breakdown: this.api.expenseBreakdown(
        this.query.month
          ? {
              period: "custom",
              dateFrom: `${this.query.year}-${String(this.query.month).padStart(2, "0")}-01`,
              dateTo: `${this.query.year}-${String(this.query.month).padStart(2, "0")}-${new Date(Date.UTC(this.query.year, this.query.month, 0)).getUTCDate()}`,
              expenseCategoryId: this.query.expenseCategoryId,
            }
          : {
              period: "custom",
              dateFrom: `${this.query.year}-01-01`,
              dateTo: `${this.query.year}-12-31`,
              expenseCategoryId: this.query.expenseCategoryId,
            },
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.summary.set(r.summary);
          this.breakdown.set(r.breakdown);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load monthly summary.");
        },
      });
  }
  apply(): void {
    const v = this.filters.getRawValue();
    if (!Number.isInteger(v.year) || v.year < 2000 || v.year > 2100) {
      this.error.set("Choose a valid year.");
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        year: v.year,
        month: v.month || null,
        expenseCategoryId: v.expenseCategoryId || null,
      },
    });
  }
  margin(value: string, revenue: string): string {
    return Number(revenue) === 0 ? "—" : formatPercent(value);
  }
  export(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.error.set(null);
    this.api
      .download("monthly-summary.csv", this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (file) => {
          saveFinanceDownload(file);
          this.exporting.set(false);
        },
        error: () => {
          this.exporting.set(false);
          this.error.set("Could not export monthly summary.");
        },
      });
  }
}
