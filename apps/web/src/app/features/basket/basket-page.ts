import { CurrencyPipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { Title } from "@angular/platform-browser";
import { catchError, of } from "rxjs";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { BasketService } from "../../core/basket/basket.service";
import { I18nService } from "../../core/i18n/i18n.service";
import {
  CardPaymentTestApiService,
  CardPaymentTestConfig,
  MockPaymentSession,
} from "../admin/card-payment-test/card-payment-test-api.service";
import {
  isValidPaymentSession,
  isVerifiedPaymentSuccess,
} from "../admin/card-payment-test/verified-payment-session";
import {
  bindSandboxRequest,
  retainSandboxRequestKey,
  retireSandboxRequest,
} from "../admin/card-payment-test/sandbox-payment-request";

@Component({
  selector: "app-basket-page",
  imports: [CurrencyPipe, RouterLink],
  templateUrl: "./basket-page.html",
  styleUrl: "./basket-page.scss",
})
export class BasketPage {
  readonly basket = inject(BasketService);
  readonly i18n = inject(I18nService);
  readonly submitting = signal(false);
  readonly orderSuccess = signal(false);
  readonly paymentPending = signal(false);
  readonly orderError = signal("");
  readonly validationAttempted = signal(false);
  readonly cardPaymentsEnabled = signal(false);
  private readonly route = inject(ActivatedRoute);
  readonly cardPaymentTestMode =
    this.route.snapshot.data["cardPaymentTestMode"] === true;
  readonly cardPaymentTestResult = signal("");
  readonly sandboxMode = signal(false);
  readonly testReady = signal(false);
  readonly sandboxAccessRequired = signal(true);
  readonly sandboxAccessBusy = signal(false);
  readonly sandboxAccessError = signal(false);
  readonly sandboxStatusPending = signal(false);
  readonly verifyingSandbox = signal(false);
  readonly sandboxStorageBlocked = signal(false);
  readonly sandboxAttemptComplete = signal(false);
  sandboxAccess = "";
  readonly paymentMethod = signal<"CARD" | "CASH_ON_DELIVERY">(
    this.cardPaymentTestMode ? "CARD" : loadPaymentMethod(),
  );
  readonly customer = this.cardPaymentTestMode
    ? { name: "", email: "", phone: "", address: "" }
    : loadCustomerDraft();
  private idempotencyKey = this.cardPaymentTestMode ? "" : loadIdempotencyKey();
  private readonly api = inject(CatalogApiService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly cardPaymentTestApi = inject(CardPaymentTestApiService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.route.parent?.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.i18n.setLocale(params.get("locale"));
        this.title.setTitle(`${this.i18n.t("basket")} | ATHLON`);
      });
    if (this.cardPaymentTestMode) {
      this.paymentMethod.set("CARD");
      const config = this.cardPaymentTestApi.configuration();
      if (config) this.applyTestConfig(config);
      else this.loadTestConfig();
      return;
    }
    this.api
      .settings()
      .pipe(
        catchError(() => of({ cardPaymentsEnabled: false })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((settings) =>
        this.cardPaymentsEnabled.set(settings.cardPaymentsEnabled === true),
      );
  }

  unlockSandbox(event: SubmitEvent): void {
    event.preventDefault();
    if (this.sandboxAccessBusy() || !this.sandboxAccess.trim()) return;
    const accessToken = this.sandboxAccess;
    this.sandboxAccess = "";
    (event.currentTarget as HTMLFormElement | null)?.reset();
    this.sandboxAccessBusy.set(true);
    this.sandboxAccessError.set(false);
    this.cardPaymentTestApi
      .unlockAccess(accessToken)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.sandboxAccessBusy.set(false);
          this.loadTestConfig();
        },
        error: () => {
          this.sandboxAccessBusy.set(false);
          this.sandboxAccessError.set(true);
        },
      });
  }

  recheckSandbox(): void {
    if (!this.verifyingSandbox()) this.verifyCardPaymentTestReturn();
  }

  private loadTestConfig(): void {
    this.cardPaymentTestApi
      .config()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (config) => this.applyTestConfig(config),
        error: () => this.orderError.set(this.i18n.t("paymentTestError")),
      });
  }

  private applyTestConfig(config: CardPaymentTestConfig): void {
    this.testReady.set(
      config.enabled === true &&
        (config.mode === "MOCK" || config.mode === "AMERIA_SANDBOX") &&
        typeof config.csrfToken === "string" &&
        !!config.csrfToken.trim(),
    );
    this.sandboxMode.set(config.mode === "AMERIA_SANDBOX");
    this.sandboxAccessRequired.set(
      config.mode === "AMERIA_SANDBOX" && config.accessRequired !== false,
    );
    if (config.enabled && !this.sandboxAccessRequired())
      this.verifyCardPaymentTestReturn();
  }

  update(id: string, value: string): void {
    if (this.submitting()) return;
    this.clearIdempotencyKey();
    this.basket.update(id, Number(value));
    this.sandboxAttemptComplete.set(false);
  }

  remove(id: string): void {
    if (this.submitting()) return;
    this.clearIdempotencyKey();
    this.basket.remove(id);
    this.sandboxAttemptComplete.set(false);
  }

  clear(): void {
    if (this.submitting()) return;
    this.clearIdempotencyKey();
    this.basket.clear();
    this.sandboxAttemptComplete.set(false);
  }

  updateCustomerField(field: keyof typeof this.customer, value: string): void {
    if (this.customer[field] === value) return;
    this.customer[field] = value;
    if (!this.sandboxMode()) this.clearIdempotencyKey();
    if (!this.cardPaymentTestMode) saveCustomerDraft(this.customer);
  }

  submitOrder(event: SubmitEvent): void {
    event.preventDefault();
    this.orderError.set("");
    this.orderSuccess.set(false);
    this.paymentPending.set(false);
    this.validationAttempted.set(true);

    const name = this.customer.name.trim();
    const email = this.customer.email.trim();
    const phone = this.customer.phone.trim();
    const address = this.customer.address.trim();
    if (
      !name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !phone ||
      !address
    ) {
      this.orderError.set(this.i18n.t("orderRequired"));
      const invalidId = !name
        ? "order-name"
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? "order-email"
          : !phone
            ? "order-phone"
            : "order-address";
      (event.currentTarget as HTMLFormElement | null)
        ?.querySelector<HTMLElement>(`#${invalidId}`)
        ?.focus();
      return;
    }
    if (this.submitting() || !this.basket.items().length) return;

    if (this.cardPaymentTestMode) {
      if (
        !this.testReady() ||
        (this.sandboxMode() &&
          (this.sandboxAccessRequired() ||
            this.sandboxStorageBlocked() ||
            this.sandboxAttemptComplete() ||
            this.sandboxStatusPending() ||
            this.verifyingSandbox()))
      )
        return;
      this.submitCardPaymentTest();
      return;
    }

    if (!this.idempotencyKey) {
      this.idempotencyKey = createIdempotencyKey();
      saveIdempotencyKey(this.idempotencyKey);
    }
    this.submitting.set(true);
    this.api
      .submitOrder(
        {
          locale: this.i18n.locale(),
          paymentMethod: this.paymentMethod(),
          customer: { name, email, phone, address },
          items: this.basket.items().map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            expectedUnitPrice: item.price,
          })),
        },
        this.idempotencyKey,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response?.kind === "CARD_PAYMENT_PENDING") {
            if (
              response.paymentStatus !== "PENDING" ||
              !isSecureCheckoutUrl(response.checkoutUrl)
            ) {
              this.orderError.set(this.i18n.t("orderFailure"));
              this.submitting.set(false);
              return;
            }
            this.paymentPending.set(true);
            this.submitting.set(false);
            this.redirectToCheckout(response.checkoutUrl);
            return;
          }
          if (response?.kind !== "COD_ACCEPTED" || response.accepted !== true) {
            this.orderError.set(this.i18n.t("orderFailure"));
            this.submitting.set(false);
            return;
          }
          this.basket.clear();
          this.clearIdempotencyKey();
          clearCustomerDraft();
          clearPaymentMethodDraft();
          this.paymentMethod.set("CASH_ON_DELIVERY");
          this.customer.name = "";
          this.customer.email = "";
          this.customer.phone = "";
          this.customer.address = "";
          this.orderSuccess.set(true);
          this.submitting.set(false);
          if (typeof window !== "undefined") {
            window.setTimeout(() => this.orderSuccess.set(false), 5_000);
          }
        },
        error: (error: unknown) => {
          const isConflict =
            error instanceof HttpErrorResponse && error.status === 409;
          if (isConflict) this.clearIdempotencyKey();
          const key = isConflict ? "orderConflict" : "orderFailure";
          this.orderError.set(this.i18n.t(key));
          this.submitting.set(false);
        },
      });
  }

  setPaymentMethod(value: string): void {
    if (this.cardPaymentTestMode) {
      this.paymentMethod.set("CARD");
      return;
    }
    if (value === "CARD" && this.cardPaymentsEnabled()) {
      this.paymentMethod.set("CARD");
      savePaymentMethod("CARD");
      return;
    }
    this.paymentMethod.set("CASH_ON_DELIVERY");
    savePaymentMethod("CASH_ON_DELIVERY");
  }

  fieldHasError(field: "name" | "email" | "phone" | "address"): boolean {
    if (!this.validationAttempted()) return false;
    const value = this.customer[field].trim();
    if (field === "email") return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    return !value;
  }

  redirectToCheckout(checkoutUrl: string): void {
    if (typeof window !== "undefined") window.location.assign(checkoutUrl);
  }

  private clearIdempotencyKey(): void {
    this.idempotencyKey = "";
    if (!this.cardPaymentTestMode) clearStoredIdempotencyKey();
  }

  private submitCardPaymentTest(): void {
    if (this.sandboxMode()) {
      try {
        this.idempotencyKey = retainSandboxRequestKey({
          locale: this.i18n.locale(),
          items: this.basket.items().map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            expectedUnitPrice: item.price,
          })),
        });
      } catch {
        this.sandboxStorageBlocked.set(true);
        this.orderError.set(this.i18n.t("paymentSandboxStorageError"));
        return;
      }
    }
    this.submitting.set(true);
    this.cardPaymentTestResult.set("");
    const requestKey = this.idempotencyKey;
    this.cardPaymentTestApi
      .createSession({
        ...(this.sandboxMode() ? { idempotencyKey: requestKey } : {}),
        locale: this.i18n.locale(),
        items: this.basket.items().map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          expectedUnitPrice: item.price,
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          if (
            this.sandboxMode() &&
            ["FAILED", "CANCELLED", "EXPIRED"].includes(session.status) &&
            isValidPaymentSession(
              session,
              session.reference,
              this.cardPaymentTestApi.configuration(),
            )
          ) {
            try {
              // This response belongs to the captured create key; a return GET
              // alone cannot attribute an unbound legacy request to its URL.
              bindSandboxRequest(requestKey, session.reference);
              if (retireSandboxRequest(session.reference) !== true)
                throw new Error("Sandbox cleanup unavailable");
            } catch {
              this.sandboxStorageBlocked.set(true);
              this.orderError.set(this.i18n.t("paymentSandboxStorageError"));
              this.submitting.set(false);
              return;
            }
            this.clearIdempotencyKey();
            this.sandboxStorageBlocked.set(false);
            this.sandboxStatusPending.set(false);
            this.sandboxAttemptComplete.set(false);
            this.cardPaymentTestResult.set(this.returnMessage(session));
            this.submitting.set(false);
            return;
          }
          if (
            this.sandboxMode() &&
            session.mode === "AMERIA_SANDBOX" &&
            session.currency === "AMD" &&
            session.total === "10" &&
            (session.status === "PENDING" ||
              isVerifiedPaymentSuccess(
                session,
                session.reference,
                this.cardPaymentTestApi.configuration(),
              ))
          ) {
            try {
              bindSandboxRequest(requestKey, session.reference);
            } catch {
              this.sandboxStorageBlocked.set(true);
              if (session.status !== "SUCCEEDED") {
                this.orderError.set(this.i18n.t("paymentSandboxStorageError"));
                this.submitting.set(false);
                return;
              }
            }
          }
          if (this.openVerifiedSuccess(session, session.reference)) return;
          if (this.sandboxMode()) {
            if (
              session.mode === "AMERIA_SANDBOX" &&
              session.total === "10" &&
              session.currency === "AMD" &&
              session.status === "SUCCEEDED"
            ) {
              this.sandboxAttemptComplete.set(true);
              this.orderError.set(this.i18n.t("paymentTestError"));
              this.submitting.set(false);
              return;
            }
            if (
              session.mode === "AMERIA_SANDBOX" &&
              session.status === "PENDING" &&
              session.total === "10" &&
              session.currency === "AMD" &&
              session.checkoutUrl &&
              isSandboxCheckoutUrl(session.checkoutUrl, this.i18n.locale())
            ) {
              this.redirectToCheckout(session.checkoutUrl);
            } else {
              this.orderError.set(this.i18n.t("paymentTestError"));
              this.submitting.set(false);
            }
            return;
          }
          if (session.mode !== "MOCK" || session.status !== "PENDING") {
            this.orderError.set(this.i18n.t("paymentTestError"));
            this.submitting.set(false);
            return;
          }
          void this.router.navigate([
            "/card-payment-test",
            this.i18n.locale(),
            "payment",
            session.reference,
          ]);
        },
        error: () => {
          this.orderError.set(this.i18n.t("paymentTestError"));
          this.submitting.set(false);
        },
      });
  }

  private verifyCardPaymentTestReturn(): void {
    const reference = this.route.snapshot.queryParamMap.get("session");
    if (!reference) return;
    this.verifyingSandbox.set(true);
    this.cardPaymentTestApi
      .getSession(reference)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (session) => {
          this.verifyingSandbox.set(false);
          if (this.openVerifiedSuccess(session, reference)) return;
          if (session.status === "SUCCEEDED") {
            this.cardPaymentTestResult.set(this.i18n.t("paymentTestError"));
            if (this.sandboxMode()) this.sandboxStatusPending.set(true);
            return;
          }
          if (
            session.reference !== reference ||
            session.mode !== (this.sandboxMode() ? "AMERIA_SANDBOX" : "MOCK") ||
            (this.sandboxMode() &&
              (session.total !== "10" || session.currency !== "AMD"))
          ) {
            this.cardPaymentTestResult.set(this.i18n.t("paymentTestError"));
            return;
          }
          this.cardPaymentTestResult.set(this.returnMessage(session));
          if (this.sandboxMode()) {
            this.sandboxStatusPending.set(session.status === "PENDING");
            this.sandboxAttemptComplete.set(false);
            if (["FAILED", "CANCELLED", "EXPIRED"].includes(session.status)) {
              this.sandboxStorageBlocked.set(
                retireSandboxRequest(reference) === false,
              );
              this.clearIdempotencyKey();
            }
            return;
          }
          void this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { session: null },
            queryParamsHandling: "merge",
            replaceUrl: true,
          });
        },
        error: () => {
          this.verifyingSandbox.set(false);
          this.cardPaymentTestResult.set(this.i18n.t("paymentTestError"));
          if (this.sandboxMode()) this.sandboxStatusPending.set(true);
        },
      });
  }

  private returnMessage(session: MockPaymentSession): string {
    if (session.mode === "AMERIA_SANDBOX") {
      switch (session.status) {
        case "SUCCEEDED":
          return this.i18n.t("paymentSandboxSuccess");
        case "FAILED":
          return this.i18n.t("orderPaymentFailed");
        case "CANCELLED":
          return this.i18n.t("orderPaymentCancelled");
        case "EXPIRED":
          return this.i18n.t("orderPaymentExpired");
        default:
          return this.i18n.t("paymentSandboxPending");
      }
    }
    switch (session.status) {
      case "SUCCEEDED":
        return this.i18n.t("paymentTestReturnSuccess");
      case "FAILED":
        return this.i18n.t("paymentTestReturnDeclined");
      case "CANCELLED":
        return this.i18n.t("paymentTestReturnCancelled");
      case "EXPIRED":
        return this.i18n.t("paymentTestReturnExpired");
      case "PENDING":
        return this.i18n.t("paymentTestPending");
    }
  }

  private openVerifiedSuccess(
    session: MockPaymentSession,
    reference: string,
  ): boolean {
    if (
      !isVerifiedPaymentSuccess(
        session,
        reference,
        this.cardPaymentTestApi.configuration(),
      )
    )
      return false;
    this.submitting.set(false);
    this.sandboxAttemptComplete.set(true);
    void this.router.navigate(
      ["/card-payment-test", this.i18n.locale(), "success", reference],
      { replaceUrl: true },
    );
    return true;
  }
}

function isSandboxCheckoutUrl(value: string, locale: string): boolean {
  try {
    const url = new URL(value);
    const language = locale === "hy" ? "am" : locale;
    return (
      value.startsWith("https://servicestest.ameriabank.am/") &&
      url.origin === "https://servicestest.ameriabank.am" &&
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      url.pathname === "/VPOS/Payments/Pay" &&
      url.searchParams.getAll("id").length === 1 &&
      /^[A-Za-z0-9-]{1,100}$/.test(url.searchParams.get("id") ?? "") &&
      url.searchParams.getAll("lang").length === 1 &&
      url.searchParams.get("lang") === language &&
      Array.from(url.searchParams.keys()).every(
        (key) => key === "id" || key === "lang",
      )
    );
  } catch {
    return false;
  }
}

const CUSTOMER_DRAFT_KEY = "athlon_checkout_customer_v1";
const IDEMPOTENCY_KEY = "athlon_checkout_idempotency_v1";
const PAYMENT_METHOD_KEY = "athlon_checkout_payment_method_v1";

function loadCustomerDraft() {
  const empty = { name: "", email: "", phone: "", address: "" };
  if (typeof window === "undefined") return empty;
  try {
    const stored = window.sessionStorage.getItem(CUSTOMER_DRAFT_KEY);
    if (!stored) return empty;
    const value = JSON.parse(stored) as Partial<typeof empty>;
    return {
      name: typeof value.name === "string" ? value.name.slice(0, 120) : "",
      email: typeof value.email === "string" ? value.email.slice(0, 320) : "",
      phone: typeof value.phone === "string" ? value.phone.slice(0, 24) : "",
      address:
        typeof value.address === "string" ? value.address.slice(0, 300) : "",
    };
  } catch {
    return empty;
  }
}

function saveCustomerDraft(customer: {
  name: string;
  email: string;
  phone: string;
  address: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CUSTOMER_DRAFT_KEY, JSON.stringify(customer));
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function clearCustomerDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CUSTOMER_DRAFT_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function loadPaymentMethod(): "CARD" | "CASH_ON_DELIVERY" {
  if (typeof window === "undefined") return "CASH_ON_DELIVERY";
  try {
    return window.sessionStorage.getItem(PAYMENT_METHOD_KEY) === "CARD"
      ? "CARD"
      : "CASH_ON_DELIVERY";
  } catch {
    return "CASH_ON_DELIVERY";
  }
}

function savePaymentMethod(value: "CARD" | "CASH_ON_DELIVERY"): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PAYMENT_METHOD_KEY, value);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function clearPaymentMethodDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PAYMENT_METHOD_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function loadIdempotencyKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const value = window.sessionStorage.getItem(IDEMPOTENCY_KEY) ?? "";
    return /^[A-Za-z0-9._:-]{8,120}$/.test(value) ? value : "";
  } catch {
    return "";
  }
}

function saveIdempotencyKey(value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(IDEMPOTENCY_KEY, value);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function clearStoredIdempotencyKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(IDEMPOTENCY_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function createIdempotencyKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function isSecureCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
