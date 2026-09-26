import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Subscription } from "rxjs";
import { DeleteConfirmation } from "../../shared/delete-confirmation";
import { AdminFinanceService } from "../shared/admin-finance.service";
import {
  FinanceList,
  Supplier,
  SupplierQuery,
} from "../shared/finance-api.types";

@Component({
  selector: "app-admin-supplier-list",
  imports: [ReactiveFormsModule, RouterLink, DeleteConfirmation],
  templateUrl: "./supplier-list.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class SupplierList {
  private readonly api = inject(AdminFinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly list = signal<FinanceList<Supplier> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly pendingDelete = signal<Supplier | null>(null);
  readonly filters = new FormGroup({
    q: new FormControl("", { nonNullable: true }),
    active: new FormControl("", { nonNullable: true }),
    sort: new FormControl<"name" | "updated">("name", { nonNullable: true }),
    pageSize: new FormControl(24, { nonNullable: true }),
  });
  private query: SupplierQuery = {};
  private request?: Subscription;
  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        const page = Number(p.get("page"));
        const size = Number(p.get("pageSize"));
        const active = p.get("active");
        const sort = p.get("sort");
        this.query = {
          page: Number.isInteger(page) && page > 0 ? page : 1,
          pageSize:
            Number.isInteger(size) && size > 0 && size <= 100 ? size : 24,
          sort: sort === "updated" ? "updated" : "name",
          ...(p.get("q")?.trim()
            ? { q: p.get("q")!.trim().slice(0, 120) }
            : {}),
          ...(active === "true" || active === "false"
            ? { active: active === "true" }
            : {}),
        };
        this.filters.setValue({
          q: this.query.q ?? "",
          active:
            this.query.active === undefined ? "" : String(this.query.active),
          sort: this.query.sort!,
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
      .listSuppliers(this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.list.set(r);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load suppliers.");
        },
      });
  }
  search(): void {
    const v = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: v.q.trim() || null,
        active: v.active || null,
        sort: v.sort === "name" ? null : v.sort,
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
    if (!ok || !item || this.deleting()) return;
    this.deleting.set(true);
    this.api
      .deleteSupplier(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.load();
        },
        error: (e) => {
          this.deleting.set(false);
          this.error.set(
            e.status === 409
              ? "This supplier is used by purchases; deactivate it instead."
              : "Could not delete supplier.",
          );
        },
      });
  }
}
