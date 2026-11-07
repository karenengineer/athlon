import { DatePipe, DOCUMENT } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { AdminCopyKey, AdminI18nService } from "../shared/admin-i18n.service";

const endpoint = "/api/v1/admin/sandbox-payments";
const statusLabels = {
  PENDING: "sandboxPaymentPending",
  SUCCEEDED: "sandboxPaymentCaptured",
  FAILED: "sandboxPaymentFailed",
  CANCELLED: "sandboxPaymentCancelled",
  EXPIRED: "sandboxPaymentExpired",
  REFUNDED: "sandboxPaymentRefunded",
  REFUND_UNCONFIRMED: "sandboxPaymentRefundUnconfirmed",
  CANCELLATION_UNCONFIRMED: "sandboxPaymentCancellationUnconfirmed",
} as const satisfies Record<string, AdminCopyKey>;

interface SandboxPayment {
  reference: string;
  ameriaOrderId: number;
  createdAt: string;
  status: keyof typeof statusLabels;
  canRefund: boolean;
  canCancel: boolean;
}

interface SandboxPaymentList {
  items: SandboxPayment[];
  hasNext: boolean;
  refundsEnabled: boolean;
}

@Component({
  selector: "app-admin-sandbox-payments",
  imports: [DatePipe],
  templateUrl: "./sandbox-payments-page.html",
  styleUrl: "../shared/catalog.scss",
})
export class SandboxPaymentsPage {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  readonly i18n = inject(AdminI18nService);
  readonly page = signal(1);
  readonly list = signal<SandboxPaymentList | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal<AdminCopyKey | null>(null);
  readonly statusLabels = statusLabels;

  constructor() {
    this.load();
  }

  load(page = this.page()): void {
    if (page < 1 || this.busy() || this.loading()) return;
    this.page.set(page);
    this.list.set(null);
    this.error.set(null);
    this.loading.set(true);
    this.http
      .get<SandboxPaymentList>(endpoint, { params: { page } })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.list.set(list);
          this.loading.set(false);
        },
        error: () => {
          this.error.set("error");
          this.loading.set(false);
        },
      });
  }

  refund(item: SandboxPayment): void {
    if (!this.canActOn(item) || !item.canRefund) return;
    const confirmation = this.i18n
      .translate("sandboxPaymentRefundConfirmation")
      .replace("{orderId}", String(item.ameriaOrderId));
    if (!this.document.defaultView?.confirm(confirmation)) return;
    this.submit(item, "refund");
  }

  cancel(item: SandboxPayment): void {
    if (!this.canActOn(item) || !item.canCancel) return;
    const confirmation = this.i18n
      .translate("sandboxPaymentCancelConfirmation")
      .replace("{orderId}", String(item.ameriaOrderId));
    if (!this.document.defaultView?.confirm(confirmation)) return;
    this.submit(item, "cancel");
  }

  recheck(item: SandboxPayment): void {
    if (
      !this.canActOn(item) ||
      !["REFUND_UNCONFIRMED", "CANCELLATION_UNCONFIRMED"].includes(item.status)
    )
      return;
    this.submit(item, "recheck");
  }

  private canActOn(item: SandboxPayment): boolean {
    const list = this.list();
    return !this.busy() && !!list?.refundsEnabled && list.items.includes(item);
  }

  private submit(
    item: SandboxPayment,
    action: "refund" | "cancel" | "recheck",
  ): void {
    this.busy.set(true);
    this.error.set(null);
    this.http
      .post<SandboxPayment>(
        `${endpoint}/${encodeURIComponent(item.reference)}/${action}`,
        {},
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.list.update(
            (list) =>
              list && {
                ...list,
                items: list.items.map((payment) =>
                  payment.reference === item.reference ? updated : payment,
                ),
              },
          );
          this.busy.set(false);
        },
        error: () => {
          if (action !== "recheck") this.list.set(null);
          this.error.set("sandboxPaymentActionError");
          this.busy.set(false);
        },
      });
  }
}
