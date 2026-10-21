import { CurrencyPipe } from "@angular/common";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, RouterLink } from "@angular/router";
import {
  catchError,
  combineLatest,
  map,
  of,
  Subject,
  switchMap,
  startWith,
} from "rxjs";
import { BasketService } from "../../../core/basket/basket.service";
import { I18nService } from "../../../core/i18n/i18n.service";
import {
  CardPaymentTestApiService,
  MockPaymentSession,
} from "./card-payment-test-api.service";
import { isVerifiedPaymentSuccess } from "./verified-payment-session";
import { retireSandboxRequest } from "./sandbox-payment-request";

@Component({
  selector: "app-payment-success-page",
  imports: [CurrencyPipe, RouterLink],
  templateUrl: "./payment-success-page.html",
  styleUrl: "./payment-success-page.scss",
})
export class PaymentSuccessPage {
  readonly i18n = inject(I18nService);
  readonly basket = inject(BasketService);
  readonly session = signal<MockPaymentSession | null>(null);
  readonly busy = signal(false);
  readonly error = signal(false);
  readonly pending = signal(false);
  readonly cleanupWarning = signal(false);
  private readonly api = inject(CardPaymentTestApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly refresh = new Subject<void>();

  constructor() {
    combineLatest([this.route.paramMap, this.route.parent!.paramMap])
      .pipe(
        switchMap(([params, parent]) => {
          this.i18n.setLocale(parent.get("locale"));
          this.session.set(null);
          this.cleanupWarning.set(false);
          this.title.setTitle(
            `${this.i18n.t("paymentSuccessChecking")} | ATHLON`,
          );
          const reference = params.get("reference") ?? "";
          return this.refresh.pipe(
            startWith(undefined),
            switchMap(() => {
              this.busy.set(true);
              this.error.set(false);
              this.pending.set(false);
              return this.api.config().pipe(
                switchMap((config) =>
                  reference.trim() &&
                  config.enabled === true &&
                  ["MOCK", "AMERIA_SANDBOX"].includes(config.mode) &&
                  config.csrfToken?.trim()
                    ? this.api.getSession(reference)
                    : of(null),
                ),
                map((session) => ({ session, reference })),
                catchError(() => of({ session: null, reference })),
              );
            }),
          );
        }),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(({ session, reference }) => {
        this.busy.set(false);
        if (
          !session ||
          !isVerifiedPaymentSuccess(
            session,
            reference,
            this.api.configuration(),
          )
        ) {
          this.pending.set(
            !this.session() &&
              session?.reference === reference &&
              session?.status === "PENDING",
          );
          this.error.set(!this.pending());
          return;
        }
        this.session.set(session);
        this.title.setTitle(`${this.i18n.t("paymentSuccessTitle")} | ATHLON`);
        this.cleanupWarning.set(
          !this.basket.settlePayment(reference, session.items) ||
            (session.mode === "AMERIA_SANDBOX" &&
              !retireSandboxRequest(reference)),
        );
      });
  }

  verify(): void {
    if (!this.busy()) this.refresh.next();
  }
}
