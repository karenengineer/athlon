import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import {
  catchError,
  combineLatest,
  map,
  of,
  startWith,
  Subject,
  switchMap,
  takeWhile,
  timer,
} from "rxjs";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { BasketService } from "../../core/basket/basket.service";
import { I18nService } from "../../core/i18n/i18n.service";
import { createPageMetadata } from "../../core/seo/page-metadata";

export type PaymentView = "CHECKING" | "PAID" | "FAILED" | "PENDING" | "ERROR";

/** Polls while the bank has not decided: every 4 s for about two minutes. */
export const POLL_INTERVAL_MS = 4_000;
export const MAX_POLLS = 30;

const referencePattern = /^ATH-[A-F0-9]{32}$/;

/**
 * Where the bank sends the shopper back after the hosted card page. The query
 * string the bank appends is ignored: only the server's bank-verified status
 * decides what is shown.
 */
@Component({
  selector: "app-payment-status-page",
  imports: [RouterLink],
  template: `
    <section
      class="payment page-width"
      role="status"
      aria-live="polite"
      [attr.aria-busy]="view() === 'CHECKING'"
    >
      @switch (view()) {
        @case ("PAID") {
          <span class="icon ok" aria-hidden="true">✓</span>
          <h1>{{ i18n.t("paymentReturnPaidTitle") }}</h1>
          <p>{{ i18n.t("paymentReturnPaidText") }}</p>
        }
        @case ("FAILED") {
          <span class="icon fail" aria-hidden="true">!</span>
          <h1>{{ i18n.t("paymentReturnFailedTitle") }}</h1>
          <p>{{ i18n.t("paymentReturnFailedText") }}</p>
        }
        @case ("PENDING") {
          <span class="icon wait" aria-hidden="true">…</span>
          <h1>{{ i18n.t("paymentReturnPendingTitle") }}</h1>
          <p>{{ i18n.t("paymentReturnPendingText") }}</p>
        }
        @case ("ERROR") {
          <span class="icon fail" aria-hidden="true">!</span>
          <h1>{{ i18n.t("paymentReturnPendingTitle") }}</h1>
          <p>{{ i18n.t("paymentReturnErrorText") }}</p>
        }
        @default {
          <span class="icon wait" aria-hidden="true">…</span>
          <h1>{{ i18n.t("paymentReturnChecking") }}</h1>
        }
      }
      @if (reference()) {
        <p class="reference">
          {{ i18n.t("paymentReturnReference") }}: <b>{{ reference() }}</b>
        </p>
      }
      <div class="actions">
        @if (view() === "FAILED") {
          <a class="primary" [routerLink]="['/', i18n.locale(), 'basket']">{{
            i18n.t("paymentReturnBackToBasket")
          }}</a>
        }
        @if (view() === "PENDING" || view() === "ERROR") {
          <button class="primary" type="button" (click)="recheck()">
            {{ i18n.t("paymentReturnRecheck") }}
          </button>
        }
        @if (view() !== "CHECKING") {
          <a [routerLink]="['/', i18n.locale()]">{{
            i18n.t("paymentReturnContinue")
          }}</a>
        }
      </div>
    </section>
  `,
  styles: `
    .payment {
      min-height: 60vh;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 12px;
      padding-block: 48px;
      color: #171719;
      text-align: center;
      overflow-wrap: anywhere;
    }
    .icon {
      width: 64px;
      height: 64px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      font-size: 2rem;
      font-weight: 900;
      color: #fff;
      background: #595960;
    }
    .icon.ok {
      background: #1f7a3f;
    }
    .icon.fail {
      background: #b3261e;
    }
    h1 {
      margin: 0;
    }
    p {
      max-width: 38rem;
      margin: 0;
      color: #595960;
      line-height: 1.5;
    }
    .reference b {
      color: #171719;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 8px;
    }
    a,
    button {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      border: 1px solid #171719;
      border-radius: 10px;
      color: #171719;
      background: #fff;
      font: inherit;
      font-weight: 900;
      text-decoration: none;
      cursor: pointer;
    }
    .primary {
      color: #fff;
      background: #171719;
    }
  `,
})
export class PaymentStatusPage {
  readonly i18n = inject(I18nService);
  readonly view = signal<PaymentView>("CHECKING");
  readonly reference = signal("");
  private readonly api = inject(CatalogApiService);
  private readonly basket = inject(BasketService);
  private readonly route = inject(ActivatedRoute);
  private readonly metadata = createPageMetadata();
  private readonly refresh = new Subject<void>();
  private basketCleared = false;

  constructor() {
    combineLatest([this.route.paramMap, this.route.parent!.paramMap])
      .pipe(
        switchMap(([params, parent]) => {
          this.i18n.setLocale(parent.get("locale"));
          this.metadata.set({
            title: `${this.i18n.t("paymentReturnChecking")} | ATHLON`,
            description: this.i18n.t("paymentReturnPendingText"),
            noindex: true,
          });
          const reference = params.get("reference") ?? "";
          this.reference.set(referencePattern.test(reference) ? reference : "");
          if (!this.reference()) return of<PaymentView>("ERROR");
          return this.refresh.pipe(
            startWith(undefined),
            switchMap(() => this.poll(reference)),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((view) => {
        this.view.set(view);
        if (view === "PAID" && !this.basketCleared) {
          this.basketCleared = true;
          this.basket.clear();
        }
      });
  }

  recheck(): void {
    this.refresh.next();
  }

  private poll(reference: string) {
    this.view.set("CHECKING");
    return timer(0, POLL_INTERVAL_MS).pipe(
      switchMap((attempt) =>
        this.api.paymentStatus(reference).pipe(
          map(({ paymentStatus }) => toView(paymentStatus)),
          catchError(() => of<PaymentView>("ERROR")),
          map((view) => ({ view, attempt })),
        ),
      ),
      takeWhile(
        ({ view, attempt }) => view === "PENDING" && attempt < MAX_POLLS - 1,
        true,
      ),
      map(({ view }) => view),
    );
  }
}

export function toView(status: string): PaymentView {
  switch (status) {
    case "PAID":
      return "PAID";
    case "FAILED":
    case "CANCELLED":
    case "EXPIRED":
      return "FAILED";
    case "PENDING":
      return "PENDING";
    default:
      return "ERROR";
  }
}
