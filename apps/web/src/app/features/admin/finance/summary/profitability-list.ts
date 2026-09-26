import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { AdminCatalogService } from "../../shared/admin-catalog.service";
import { AdminCategory } from "../../shared/admin-api.types";
import { AdminI18nService } from "../../shared/admin-i18n.service";
import { saveFinanceDownload } from "../export/save-download";
import { AdminFinanceService } from "../shared/admin-finance.service";
import {
  FinanceList,
  ProductProfitabilityRow,
  ProfitabilityQuery,
  ReportSort,
} from "../shared/finance-api.types";
import { formatAmd, formatPercent } from "../shared/finance-format";
import { DateRangeFilter } from "../shared/date-range-filter";

@Component({
  selector: "app-finance-profitability",
  imports: [ReactiveFormsModule, RouterLink, DateRangeFilter],
  templateUrl: "./profitability-list.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class ProfitabilityList {
  private readonly api = inject(AdminFinanceService);
  private readonly catalog = inject(AdminCatalogService);
  private readonly i18n = inject(AdminI18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly list = signal<FinanceList<ProductProfitabilityRow> | null>(null);
  readonly categories = signal<AdminCategory[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly money = formatAmd;
  readonly percent = formatPercent;
  readonly filters = new FormGroup({
    q: new FormControl("", { nonNullable: true }),
    categoryId: new FormControl("", { nonNullable: true }),
    sort: new FormControl<ReportSort>("profitDesc", { nonNullable: true }),
  });
  private query: ProfitabilityQuery = {};
  private request?: Subscription;
  constructor() {
    this.catalog
      .allCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () => this.error.set("Could not load product categories."),
      });
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        const sort =
          (
            [
              "nameAsc",
              "nameDesc",
              "revenueAsc",
              "revenueDesc",
              "profitAsc",
              "profitDesc",
              "marginAsc",
              "marginDesc",
              "unitsSoldAsc",
              "unitsSoldDesc",
              "stockAsc",
              "stockDesc",
            ] as ReportSort[]
          ).find((s) => s === p.get("sort")) || "profitDesc";
        this.query = {
          q: p.get("q") || undefined,
          categoryId: p.get("categoryId") || undefined,
          period: (p.get("period") ||
            "thisMonth") as ProfitabilityQuery["period"],
          dateFrom: p.get("dateFrom") || undefined,
          dateTo: p.get("dateTo") || undefined,
          sort,
          page: Math.max(1, Number(p.get("page")) || 1),
          pageSize: 24,
        };
        this.filters.setValue({
          q: this.query.q || "",
          categoryId: this.query.categoryId || "",
          sort,
        });
        this.load();
      });
  }
  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api
      .profitability(this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.list.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load profitability.");
        },
      });
  }
  search(): void {
    const v = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: "merge",
      queryParams: {
        q: v.q.trim() || null,
        categoryId: v.categoryId || null,
        sort: v.sort,
        page: null,
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
  categoryName(category: AdminCategory): string {
    return (
      category.translations.find(
        (t) => t.locale === this.i18n.locale().toUpperCase(),
      )?.name ??
      category.translations[0]?.name ??
      category.slug
    );
  }
  margin(row: ProductProfitabilityRow): string {
    return Number(row.revenue) === 0
      ? "—"
      : formatPercent(row.grossMarginPercent);
  }
  export(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.error.set(null);
    this.api
      .download("profitability.csv", this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (file) => {
          saveFinanceDownload(file);
          this.exporting.set(false);
        },
        error: () => {
          this.exporting.set(false);
          this.error.set("Could not export profitability.");
        },
      });
  }
}
