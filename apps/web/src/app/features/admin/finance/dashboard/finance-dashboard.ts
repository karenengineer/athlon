import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { forkJoin, Subscription } from "rxjs";
import { AdminFinanceService } from "../shared/admin-finance.service";
import {
  FinanceDashboard,
  ProductProfitabilityRow,
  ReportQuery,
} from "../shared/finance-api.types";
import { formatAmd, formatPercent } from "../shared/finance-format";
import { DateRangeFilter } from "../shared/date-range-filter";
import { KpiCard } from "./kpi-card";
import { ChartPoint, SimpleChart } from "./simple-chart";

@Component({
  selector: "app-finance-dashboard",
  imports: [RouterLink, DateRangeFilter, KpiCard, SimpleChart],
  templateUrl: "./finance-dashboard.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class FinanceDashboardPage {
  private readonly api = inject(AdminFinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = signal<FinanceDashboard | null>(null);
  readonly products = signal<ProductProfitabilityRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly money = formatAmd;
  readonly percent = formatPercent;
  private query: ReportQuery = {};
  private request?: Subscription;
  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.query = {
          period: (params.get("period") ||
            "thisMonth") as ReportQuery["period"],
          dateFrom: params.get("dateFrom") || undefined,
          dateTo: params.get("dateTo") || undefined,
        };
        this.load();
      });
  }
  load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = forkJoin({
      dashboard: this.api.dashboard(this.query),
      products: this.api.profitability({ ...this.query, pageSize: 100 }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ dashboard, products }) => {
          this.data.set(dashboard);
          this.products.set(products.items);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load dashboard.");
        },
      });
  }
  comparison(key: keyof FinanceDashboard["comparisons"]): string | null {
    return this.data()?.comparisons?.[key]?.comparisonPercent == null
      ? null
      : formatPercent(this.data()!.comparisons[key].comparisonPercent);
  }
  comparisonChart(
    key: "revenue" | "netProfit" | "totalExpenses",
  ): ChartPoint[] {
    const d = this.data();
    return d
      ? [
          {
            label: "Previous period",
            value: Number(d.comparisons[key]?.previousValue ?? 0),
          },
          { label: "Current period", value: Number(d[key]) },
        ]
      : [];
  }
  salesChart(): ChartPoint[] {
    return this.products().map((p) => ({ label: p.name, value: p.unitsSold }));
  }
  profitChart(): ChartPoint[] {
    return this.products().map((p) => ({
      label: p.name,
      value: Number(p.grossProfit),
    }));
  }
}
