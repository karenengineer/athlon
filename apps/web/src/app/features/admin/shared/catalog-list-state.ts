import { DestroyRef, Directive, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { Observable, Subscription } from "rxjs";
import {
  AdminBrand,
  AdminCategory,
  AdminList,
  AdminListQuery,
} from "./admin-api.types";
import { AdminCatalogService } from "./admin-catalog.service";
import { AdminCopyKey, AdminI18nService } from "./admin-i18n.service";

export function adminListQuery(params: ParamMap): AdminListQuery {
  const integer = (key: string, fallback: number, max: number) => {
    const value = Number(params.get(key));
    return Number.isInteger(value) && value >= 1 && value <= max
      ? value
      : fallback;
  };
  const pageSize = integer("pageSize", 24, 100);
  const sort = params.get("sort");
  const published = params.get("published");
  return {
    page: integer("page", 1, Math.floor(2_147_483_647 / pageSize)),
    pageSize,
    sort: sort === "updated" || sort === "name" ? sort : "order",
    ...(params.get("q")?.trim()
      ? { q: params.get("q")!.trim().slice(0, 120) }
      : {}),
    ...(published === "true" || published === "false"
      ? { published: published === "true" }
      : {}),
  };
}

@Directive()
export abstract class CatalogListState<T extends AdminCategory | AdminBrand> {
  readonly i18n = inject(AdminI18nService);
  protected readonly api = inject(AdminCatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly list = signal<AdminList<T> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<AdminCopyKey | null>(null);
  readonly deleting = signal(false);
  readonly pendingDelete = signal<T | null>(null);
  readonly filters = new FormGroup({
    q: new FormControl("", { nonNullable: true }),
    published: new FormControl("", { nonNullable: true }),
    sort: new FormControl("order", { nonNullable: true }),
    pageSize: new FormControl(24, { nonNullable: true }),
  });
  protected query: AdminListQuery = { page: 1, pageSize: 24, sort: "order" };
  private request?: Subscription;
  protected initialize(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.query = adminListQuery(params);
        this.filters.setValue({
          q: this.query.q ?? "",
          published:
            this.query.published === undefined
              ? ""
              : String(this.query.published),
          sort: this.query.sort!,
          pageSize: this.query.pageSize!,
        });
        this.load();
      });
  }
  abstract readonly resource: "categories" | "brands";
  protected abstract fetch(query: AdminListQuery): Observable<AdminList<T>>;
  protected abstract remove(
    id: string,
  ): ReturnType<AdminCatalogService["deleteCategory"]>;
  name(item: T): string {
    return (
      item.translations.find(
        (value) => value.locale === this.i18n.locale().toUpperCase(),
      )?.name ??
      item.translations[0]?.name ??
      item.slug
    );
  }
  load(): void {
    this.request?.unsubscribe();
    this.list.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.request = this.fetch(this.query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.list.set(result);
          this.loading.set(false);
          if (
            result.items.length === 0 &&
            result.meta.page > Math.max(1, result.meta.totalPages)
          )
            this.page(Math.max(1, result.meta.totalPages));
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
        q: values.q.trim().slice(0, 120) || null,
        published: values.published || null,
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
    this.remove(item.id)
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
