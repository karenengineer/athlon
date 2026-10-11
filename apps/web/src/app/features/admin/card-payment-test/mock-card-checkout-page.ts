import { CurrencyPipe } from "@angular/common";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { I18nService } from "../../../core/i18n/i18n.service";
import {
  CardPaymentTestApiService,
  MockPaymentOutcome,
  MockPaymentSession,
} from "./card-payment-test-api.service";

@Component({
  selector: "app-mock-card-checkout-page",
  imports: [CurrencyPipe],
  templateUrl: "./mock-card-checkout-page.html",
  styleUrl: "./mock-card-checkout-page.scss",
})
export class MockCardCheckoutPage {
  private readonly api = inject(CardPaymentTestApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(I18nService);
  readonly session = signal<MockPaymentSession | null>(null);
  readonly busy = signal(false);
  readonly error = signal(false);

  constructor() {
    this.i18n.setLocale(this.route.parent?.snapshot.paramMap.get("locale"));
    this.loadSession();
  }

  loadSession(): void {
    const reference = this.route.snapshot.paramMap.get("reference");
    if (!reference) {
      this.error.set(true);
      return;
    }
    this.busy.set(true);
    this.error.set(false);
    this.api
      .getSession(reference)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.session.set(session);
          this.busy.set(false);
        },
        error: () => {
          this.error.set(true);
          this.busy.set(false);
        },
      });
  }

  chooseOutcome(outcome: MockPaymentOutcome): void {
    const session = this.session();
    if (!session || session.status !== "PENDING" || this.busy()) return;
    this.busy.set(true);
    this.error.set(false);
    this.api
      .completeSession(session.reference, outcome)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const locale =
            this.route.parent?.snapshot.paramMap.get("locale") ?? "hy";
          void this.router.navigate(["/admin/card-payment-test", locale], {
            queryParams: { session: session.reference },
          });
        },
        error: () => {
          this.error.set(true);
          this.busy.set(false);
        },
      });
  }

  statusCopy(session: MockPaymentSession): string {
    switch (session.status) {
      case "PENDING":
        return this.i18n.t("paymentTestPending");
      case "SUCCEEDED":
        return this.i18n.t("paymentTestSuccess");
      case "FAILED":
        return this.i18n.t("paymentTestDeclined");
      case "CANCELLED":
        return this.i18n.t("paymentTestCancelled");
      case "EXPIRED":
        return this.i18n.t("paymentTestExpired");
    }
  }
}
