import { DatePipe } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Subject, switchMap, catchError, of, tap } from "rxjs";
import {
  AdminReview,
  AdminReviewList,
  AdminReviewStatus,
} from "../shared/admin-api.types";
import { AdminCatalogService } from "../shared/admin-catalog.service";
import { AdminCopyKey, AdminI18nService } from "../shared/admin-i18n.service";

/** Review moderation: approve, reject or delete customer reviews. */
@Component({
  selector: "app-admin-review-list",
  imports: [DatePipe],
  templateUrl: "./review-list.html",
  styleUrl: "../shared/catalog.scss",
})
export class ReviewList {
  readonly i18n = inject(AdminI18nService);
  private readonly api = inject(AdminCatalogService);
  readonly filters: readonly {
    status: AdminReviewStatus | "";
    key: AdminCopyKey;
  }[] = [
    { status: "PENDING", key: "reviewPending" },
    { status: "APPROVED", key: "reviewApproved" },
    { status: "REJECTED", key: "reviewRejected" },
    { status: "", key: "all" },
  ];
  readonly status = signal<AdminReviewStatus | "">("PENDING");
  readonly page = signal(1);
  readonly list = signal<AdminReviewList | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly busy = signal<string | null>(null);
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
            .listReviews(this.status(), this.page())
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

  filter(status: AdminReviewStatus | ""): void {
    this.status.set(status);
    this.page.set(1);
    this.load();
  }

  goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  stars(rating: number): string {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  statusKey(status: AdminReviewStatus): AdminCopyKey {
    return status === "PENDING"
      ? "reviewPending"
      : status === "APPROVED"
        ? "reviewApproved"
        : "reviewRejected";
  }

  moderate(review: AdminReview, status: AdminReviewStatus): void {
    this.act(review.id, this.api.moderateReview(review.id, status));
  }

  remove(review: AdminReview): void {
    if (!confirm(`${this.i18n.translate("delete")}: ${review.authorName}?`))
      return;
    this.act(review.id, this.api.deleteReview(review.id));
  }

  private act(
    id: string,
    request: ReturnType<AdminCatalogService["moderateReview"]>,
  ): void {
    if (this.busy()) return;
    this.busy.set(id);
    request.subscribe({
      next: () => {
        this.busy.set(null);
        this.load();
      },
      error: () => {
        this.busy.set(null);
        this.failed.set(true);
      },
    });
  }
}
