import { CurrencyPipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { catchError, of } from "rxjs";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { BasketService } from "../../core/basket/basket.service";
import { I18nService } from "../../core/i18n/i18n.service";

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
  readonly cardPaymentsEnabled = signal(false);
  readonly paymentMethod = signal<"CARD" | "CASH_ON_DELIVERY">(
    loadPaymentMethod(),
  );
  readonly customer = loadCustomerDraft();
  private idempotencyKey = loadIdempotencyKey();
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.i18n.setLocale(this.route.parent?.snapshot.paramMap.get("locale"));
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

  update(id: string, value: string): void {
    if (this.submitting()) return;
    this.clearIdempotencyKey();
    this.basket.update(id, Number(value));
  }

  remove(id: string): void {
    if (this.submitting()) return;
    this.clearIdempotencyKey();
    this.basket.remove(id);
  }

  clear(): void {
    if (this.submitting()) return;
    this.clearIdempotencyKey();
    this.basket.clear();
  }

  updateCustomerField(field: keyof typeof this.customer, value: string): void {
    if (this.customer[field] === value) return;
    this.customer[field] = value;
    this.clearIdempotencyKey();
    saveCustomerDraft(this.customer);
  }

  submitOrder(event: SubmitEvent): void {
    event.preventDefault();
    this.orderError.set("");
    this.orderSuccess.set(false);
    this.paymentPending.set(false);

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
      return;
    }
    if (this.submitting() || !this.basket.items().length) return;

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
    if (value === "CARD" && this.cardPaymentsEnabled()) {
      this.paymentMethod.set("CARD");
      savePaymentMethod("CARD");
      return;
    }
    this.paymentMethod.set("CASH_ON_DELIVERY");
    savePaymentMethod("CASH_ON_DELIVERY");
  }

  redirectToCheckout(checkoutUrl: string): void {
    if (typeof window !== "undefined") window.location.assign(checkoutUrl);
  }

  private clearIdempotencyKey(): void {
    this.idempotencyKey = "";
    clearStoredIdempotencyKey();
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
