import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { DeleteConfirmation } from "../../shared/delete-confirmation";
import { AdminFinanceService } from "../shared/admin-finance.service";
import {
  FinanceList,
  Purchase,
  PurchaseQuery,
} from "../shared/finance-api.types";
import { formatAmd, formatFinanceDate } from "../shared/finance-format";

@Component({
  selector: "app-admin-purchase-list",
  imports: [ReactiveFormsModule, RouterLink, DeleteConfirmation],
  templateUrl: "./purchase-list.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class PurchaseList {
  private readonly api = inject(AdminFinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly list = signal<FinanceList<Purchase> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly pendingDelete = signal<Purchase | null>(null);
  readonly money = formatAmd;
  readonly date = formatFinanceDate;
  readonly filters = new FormGroup({
    q: new FormControl("", { nonNullable: true }),
    dateFrom: new FormControl("", { nonNullable: true }),
    dateTo: new FormControl("", { nonNullable: true }),
    supplierId: new FormControl("", { nonNullable: true }),
    productId: new FormControl("", { nonNullable: true }),
    categoryId: new FormControl("", { nonNullable: true }),
    sort: new FormControl<PurchaseQuery["sort"]>("dateDesc", {
      nonNullable: true,
    }),
    pageSize: new FormControl(24, { nonNullable: true }),
  });
  private query: PurchaseQuery = {};
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
          "totalDesc",
          "totalAsc",
        ] as const;
        const sort = allowed.find((v) => v === p.get("sort")) ?? "dateDesc";
        this.query = {
          page: Number.isInteger(page) && page > 0 ? page : 1,
          pageSize:
            Number.isInteger(size) && size > 0 && size <= 100 ? size : 24,
          sort,
          ...Object.fromEntries(
            ["q", "dateFrom", "dateTo", "supplierId", "productId", "categoryId"]
              .map((k) => [k, p.get(k)?.trim() || undefined])
              .filter(([, v]) => v !== undefined),
          ),
        };
        this.filters.setValue({
          q: this.query.q ?? "",
          dateFrom: this.query.dateFrom ?? "",
          dateTo: this.query.dateTo ?? "",
          supplierId: this.query.supplierId ?? "",
          productId: this.query.productId ?? "",
          categoryId: this.query.categoryId ?? "",
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
      .listPurchases(this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.list.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load purchases.");
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
        supplierId: v.supplierId || null,
        productId: v.productId || null,
        categoryId: v.categoryId || null,
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
      .deletePurchase(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.load();
        },
        error: () => {
          this.deleting.set(false);
          this.error.set("Could not delete purchase.");
        },
      });
  }
}
