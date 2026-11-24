import { DatePipe, DecimalPipe } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { catchError, of, Subject, switchMap, tap } from "rxjs";
import {
  AdminOrder,
  AdminOrderFilter,
  AdminOrderList,
  AdminReviewEmailResult,
} from "../shared/admin-api.types";
import { AdminCatalogService } from "../shared/admin-catalog.service";
import { AdminCopyKey, AdminI18nService } from "../shared/admin-i18n.service";

const emailNoticeKey: Record<AdminReviewEmailResult, AdminCopyKey> = {
  SENT: "reviewEmailSent",
  FAILED: "reviewEmailFailed",
  NO_PRODUCTS: "reviewEmailNoProducts",
};

/** Website orders: mark delivered, which emails the buyer a review link. */
@Component({
  selector: "app-admin-order-list",
  imports: [DatePipe, DecimalPipe],
  templateUrl: "./order-list.html",
  styleUrls: ["../shared/catalog.scss", "./order-list.scss"],
})
export class OrderList {
  readonly i18n = inject(AdminI18nService);
  private readonly api = inject(AdminCatalogService);
  readonly filters: readonly { filter: AdminOrderFilter; key: AdminCopyKey }[] =
    [
      { filter: "TO_DELIVER", key: "ordersToDeliver" },
      { filter: "DELIVERED", key: "ordersDelivered" },
      { filter: "ALL", key: "all" },
    ];
  readonly filter = signal<AdminOrderFilter>("TO_DELIVER");
  readonly page = signal(1);
  readonly list = signal<AdminOrderList | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly busy = signal<string | null>(null);
  /** Last email result per order, shown next to that order. */
  readonly notices = signal<Record<string, AdminReviewEmailResult>>({});
  private readonly reload = new Subject<void>();

  constructor() {
    this.reload
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.failed.set(false);
        }),
        switchMap(() =>
          this.api
            .listOrders(this.filter(), this.page())
            .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((list) => {
        this.loading.set(false);
        this.failed.set(list === null);
        this.list.set(list);
      });
    this.load();
  }

  load(): void {
    this.reload.next();
  }

  setFilter(filter: AdminOrderFilter): void {
    this.filter.set(filter);
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  noticeKey(order: AdminOrder): AdminCopyKey | null {
    const result = this.notices()[order.id];
    return result ? emailNoticeKey[result] : null;
  }

  markDelivered(order: AdminOrder): void {
    if (
      this.busy() ||
      !confirm(
        `${order.reference}\n${this.i18n.translate("markDeliveredConfirm")}`,
      )
    )
      return;
    this.busy.set(order.id);
    this.api.markOrderDelivered(order.id).subscribe({
      next: ({ reviewEmail }) => this.done(order, reviewEmail),
      error: () => this.fail(),
    });
  }

  resend(order: AdminOrder): void {
    if (this.busy()) return;
    this.busy.set(order.id);
    this.api.resendReviewEmail(order.id).subscribe({
      next: ({ reviewEmail }) => this.done(order, reviewEmail),
      error: () => this.fail(),
    });
  }

  private done(
    order: AdminOrder,
    reviewEmail: AdminReviewEmailResult | null,
  ): void {
    this.busy.set(null);
    if (reviewEmail) {
      this.notices.update((notices) => ({
        ...notices,
        [order.id]: reviewEmail,
      }));
    }
    this.load();
  }

  private fail(): void {
    this.busy.set(null);
    this.failed.set(true);
  }
}
