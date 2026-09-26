import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { DeleteConfirmation } from "../../shared/delete-confirmation";
import { AdminFinanceService } from "../shared/admin-finance.service";
import {
  FinanceList,
  Sale,
  SaleQuery,
  SalesChannel,
} from "../shared/finance-api.types";
import {
  formatAmd,
  formatFinanceDate,
  formatPercent,
} from "../shared/finance-format";

export const salesChannels: readonly SalesChannel[] = [
  "WEBSITE",
  "INSTAGRAM",
  "GYM",
  "TRAINER",
  "DIRECT",
  "MARKETPLACE",
  "OTHER",
];
@Component({
  selector: "app-admin-sale-list",
  imports: [ReactiveFormsModule, RouterLink, DeleteConfirmation],
  templateUrl: "./sale-list.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class SaleList {
  private readonly api = inject(AdminFinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly list = signal<FinanceList<Sale> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly pendingDelete = signal<Sale | null>(null);
  readonly channels = salesChannels;
  readonly money = formatAmd;
  readonly date = formatFinanceDate;
  readonly percent = formatPercent;
  readonly filters = new FormGroup({
    q: new FormControl("", { nonNullable: true }),
    dateFrom: new FormControl("", { nonNullable: true }),
    dateTo: new FormControl("", { nonNullable: true }),
    productId: new FormControl("", { nonNullable: true }),
    categoryId: new FormControl("", { nonNullable: true }),
    channel: new FormControl("", { nonNullable: true }),
    trainerReferralCode: new FormControl("", { nonNullable: true }),
    sort: new FormControl<SaleQuery["sort"]>("dateDesc", { nonNullable: true }),
    pageSize: new FormControl(24, { nonNullable: true }),
  });
  private query: SaleQuery = {};
  private request?: Subscription;
  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        const page = Number(p.get("page"));
        const size = Number(p.get("pageSize"));
        const allowed = [
          "dateDesc",
          "dateAsc",
          "revenueDesc",
          "revenueAsc",
          "profitDesc",
          "profitAsc",
        ] as const;
        const sort = allowed.find((v) => v === p.get("sort")) ?? "dateDesc";
        const channel = salesChannels.find((v) => v === p.get("channel"));
        this.query = {
          page: Number.isInteger(page) && page > 0 ? page : 1,
          pageSize:
            Number.isInteger(size) && size > 0 && size <= 100 ? size : 24,
          sort,
          ...(channel ? { channel } : {}),
          ...Object.fromEntries(
            [
              "q",
              "dateFrom",
              "dateTo",
              "productId",
              "categoryId",
              "trainerReferralCode",
            ]
              .map((k) => [k, p.get(k)?.trim() || undefined])
              .filter(([, v]) => v !== undefined),
          ),
        };
        this.filters.setValue({
          q: this.query.q ?? "",
          dateFrom: this.query.dateFrom ?? "",
          dateTo: this.query.dateTo ?? "",
          productId: this.query.productId ?? "",
          categoryId: this.query.categoryId ?? "",
          channel: this.query.channel ?? "",
          trainerReferralCode: this.query.trainerReferralCode ?? "",
          sort: this.query.sort,
          pageSize: this.query.pageSize!,
        });
        this.load();
      });
  }
  load(): void {
    this.request?.unsubscribe();
    this.list.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api
      .listSales(this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.list.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load sales.");
        },
      });
  }
  search(): void {
    const v = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...v,
        q: v.q.trim() || null,
        dateFrom: v.dateFrom || null,
        dateTo: v.dateTo || null,
        productId: v.productId || null,
        categoryId: v.categoryId || null,
        channel: v.channel || null,
        trainerReferralCode: v.trainerReferralCode.trim() || null,
        sort: v.sort === "dateDesc" ? null : v.sort,
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
  confirmDelete(ok: boolean): void {
    const item = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!ok || !item) return;
    this.deleting.set(true);
    this.api
      .deleteSale(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.load();
        },
        error: () => {
          this.deleting.set(false);
          this.error.set("Could not delete sale.");
        },
      });
  }
}
