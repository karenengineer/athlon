import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, ParamMap, Router, RouterLink } from "@angular/router";
import { forkJoin, Subscription } from "rxjs";
import {
  AdminBrand,
  AdminCategory,
  AdminList,
  AdminProductListItem,
  AdminProductQuery,
} from "../shared/admin-api.types";
import { AdminCatalogService } from "../shared/admin-catalog.service";
import { AdminCopyKey, AdminI18nService } from "../shared/admin-i18n.service";
import { adminListQuery } from "../shared/catalog-list-state";
import { DeleteConfirmation } from "../shared/delete-confirmation";
import { availabilities } from "./product-form";

export function productListQuery(params: ParamMap): AdminProductQuery {
  const query: AdminProductQuery = adminListQuery(params);
  if (params.get("sort") === "priceAsc" || params.get("sort") === "priceDesc")
    query.sort = params.get("sort") as "priceAsc" | "priceDesc";
  for (const key of ["categoryId", "brandId"] as const) {
    const value = params.get(key);
    if (
      value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    )
      query[key] = value;
  }
  const availability = availabilities.find(
    (value) => value === params.get("availability"),
  );
  if (availability) query.availability = availability;
  for (const key of ["featured", "isNew"] as const) {
    const value = params.get(key);
    if (value === "true" || value === "false") query[key] = value === "true";
  }
  return query;
}
@Component({
  selector: "app-admin-product-list",
  imports: [ReactiveFormsModule, RouterLink, DeleteConfirmation],
  templateUrl: "./product-list.html",
  styleUrl: "../shared/catalog.scss",
})
export class ProductList {
  readonly i18n = inject(AdminI18nService);
  private readonly api = inject(AdminCatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly availabilities = availabilities;
  readonly list = signal<AdminList<AdminProductListItem> | null>(null);
  readonly categories = signal<AdminCategory[]>([]);
  readonly brands = signal<AdminBrand[]>([]);
  readonly optionsError = signal(false);
  readonly loading = signal(true);
  readonly error = signal<AdminCopyKey | null>(null);
  readonly deleting = signal(false);
  readonly pendingDelete = signal<AdminProductListItem | null>(null);
  readonly filters = new FormGroup({
    q: new FormControl("", { nonNullable: true }),
    published: new FormControl("", { nonNullable: true }),
    sort: new FormControl("order", { nonNullable: true }),
    pageSize: new FormControl(24, { nonNullable: true }),
    categoryId: new FormControl("", { nonNullable: true }),
    brandId: new FormControl("", { nonNullable: true }),
    availability: new FormControl("", { nonNullable: true }),
    featured: new FormControl("", { nonNullable: true }),
    isNew: new FormControl("", { nonNullable: true }),
  });
  private query: AdminProductQuery = {};
  private request?: Subscription;
  private optionsRequest?: Subscription;
  constructor() {
    this.loadOptions();
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.query = productListQuery(params);
        this.filters.setValue({
          q: this.query.q ?? "",
          published:
            this.query.published === undefined
              ? ""
              : String(this.query.published),
          sort: this.query.sort!,
          pageSize: this.query.pageSize!,
          categoryId: this.query.categoryId ?? "",
          brandId: this.query.brandId ?? "",
          availability: this.query.availability ?? "",
          featured:
            this.query.featured === undefined
              ? ""
              : String(this.query.featured),
          isNew: this.query.isNew === undefined ? "" : String(this.query.isNew),
        });
        this.load();
      });
  }
  loadOptions(): void {
    this.optionsRequest?.unsubscribe();
    this.optionsError.set(false);
    this.optionsRequest = forkJoin({
      categories: this.api.allCategories(),
      brands: this.api.allBrands(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ categories, brands }) => {
          this.categories.set(categories);
          this.brands.set(brands);
        },
        error: () => this.optionsError.set(true),
      });
  }
  name(item: AdminProductListItem | AdminCategory | AdminBrand): string {
    return (
      item.translations.find(
        (value) => value.locale === this.i18n.locale().toUpperCase(),
      )?.name ??
      item.translations[0]?.name ??
      ("name" in item ? item.name : item.slug)
    );
  }
  load(): void {
    this.request?.unsubscribe();
    this.list.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.request = this.api
      .listProducts(this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.list.set(list);
          this.loading.set(false);
          if (
            list.items.length === 0 &&
            list.meta.page > Math.max(1, list.meta.totalPages)
          )
            this.page(Math.max(1, list.meta.totalPages));
        },
        error: () => {
          this.loading.set(false);
          this.error.set("error");
        },
      });
  }
  search(): void {
    const values = this.filters.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...Object.fromEntries(
          Object.entries(values).map(([key, value]) => [
            key,
            value === "" ? null : value,
          ]),
        ),
        q: values.q.trim().slice(0, 120) || null,
        sort: values.sort === "order" ? null : values.sort,
        pageSize: values.pageSize === 24 ? null : values.pageSize,
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
  confirmDelete(confirmed: boolean): void {
    const item = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!confirmed || !item || this.deleting()) return;
    this.deleting.set(true);
    this.error.set(null);
    this.api
      .deleteProduct(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.load();
        },
        error: (error) => {
          this.deleting.set(false);
          this.error.set(
            error.status === 409 ? "deleteConflict" : "deleteError",
          );
        },
      });
  }
}
