import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { Subscription } from "rxjs";
import {
  FinanceList,
  FinanceProductQuery,
  FinanceProductRow,
  ReportSort,
  StockStatus,
} from "../shared/finance-api.types";
import { AdminFinanceService } from "../shared/admin-finance.service";
import { formatAmd, formatPercent } from "../shared/finance-format";

const sorts: readonly ReportSort[] = [
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
];
const statuses: readonly StockStatus[] = [
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
];
const integer = (params: ParamMap, key: string, fallback: number) => {
  const value = Number(params.get(key));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export function financeProductQuery(params: ParamMap): FinanceProductQuery {
  const sort = sorts.find((value) => value === params.get("sort"));
  const stockStatus = statuses.find(
    (value) => value === params.get("stockStatus"),
  );
  return {
    page: integer(params, "page", 1),
    pageSize: Math.min(100, integer(params, "pageSize", 24)),
    sort: sort ?? "nameAsc",
    ...(params.get("q")?.trim()
      ? { q: params.get("q")!.trim().slice(0, 120) }
      : {}),
    ...(params.get("categoryId")
      ? { categoryId: params.get("categoryId")! }
      : {}),
    ...(params.get("supplierId")
      ? { supplierId: params.get("supplierId")! }
      : {}),
    ...(stockStatus ? { stockStatus } : {}),
  };
}

@Component({
  selector: "app-admin-finance-product-list",
  imports: [ReactiveFormsModule],
  templateUrl: "./finance-product-list.html",
  styleUrl: "../shared/finance-ui.scss",
})
export class FinanceProductList {
  private readonly api = inject(AdminFinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly list = signal<FinanceList<FinanceProductRow> | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly filters = new FormGroup({
    q: new FormControl("", { nonNullable: true }),
    categoryId: new FormControl("", { nonNullable: true }),
    supplierId: new FormControl("", { nonNullable: true }),
    stockStatus: new FormControl("", { nonNullable: true }),
    sort: new FormControl<ReportSort>("nameAsc", { nonNullable: true }),
    pageSize: new FormControl(24, { nonNullable: true }),
  });
  private query: FinanceProductQuery = {};
  private request?: Subscription;
  readonly money = formatAmd;
  readonly percent = formatPercent;
  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.query = financeProductQuery(params);
        this.filters.setValue({
          q: this.query.q ?? "",
          categoryId: this.query.categoryId ?? "",
          supplierId: this.query.supplierId ?? "",
          stockStatus: this.query.stockStatus ?? "",
          sort: this.query.sort ?? "nameAsc",
          pageSize: this.query.pageSize ?? 24,
        });
        this.load();
      });
  }
  load(): void {
    this.request?.unsubscribe();
    this.list.set(null);
    this.loading.set(true);
    this.error.set(false);
    this.request = this.api
      .listProducts(this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.list.set(result);
          this.loading.set(false);
          if (
            !result.items.length &&
            result.meta.page > Math.max(1, result.meta.totalPages)
          )
            this.page(Math.max(1, result.meta.totalPages));
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }
  search(): void {
    const v = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: v.q.trim().slice(0, 120) || null,
        categoryId: v.categoryId || null,
        supplierId: v.supplierId || null,
        stockStatus: v.stockStatus || null,
        sort: v.sort === "nameAsc" ? null : v.sort,
        pageSize: v.pageSize === 24 ? null : v.pageSize,
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
  stockLabel(status: StockStatus): string {
    return {
      IN_STOCK: "In stock",
      LOW_STOCK: "Low stock",
      OUT_OF_STOCK: "Out of stock",
    }[status];
  }
}
