import { CurrencyPipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
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
  readonly orderError = signal("");
  readonly customer = { name: "", phone: "", address: "" };
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.i18n.setLocale(this.route.parent?.snapshot.paramMap.get("locale"));
  }

  update(id: string, value: string): void {
    if (this.submitting()) return;
    this.basket.update(id, Number(value));
  }

  remove(id: string): void {
    if (this.submitting()) return;
    this.basket.remove(id);
  }

  clear(): void {
    if (this.submitting()) return;
    this.basket.clear();
  }

  submitOrder(event: SubmitEvent): void {
    event.preventDefault();
    this.orderError.set("");
    this.orderSuccess.set(false);

    const name = this.customer.name.trim();
    const phone = this.customer.phone.trim();
    const address = this.customer.address.trim();
    if (!name || !phone || !address) {
      this.orderError.set(this.i18n.t("orderRequired"));
      return;
    }
    if (this.submitting() || !this.basket.items().length) return;

    this.submitting.set(true);
    this.api
      .submitOrder({
        locale: this.i18n.locale(),
        customer: { name, phone, address },
        items: this.basket.items().map((item) => ({
          productId: item.id,
          quantity: item.quantity,
          expectedUnitPrice: item.price,
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response?.accepted !== true) {
            this.orderError.set(this.i18n.t("orderFailure"));
            this.submitting.set(false);
            return;
          }
          this.basket.clear();
          this.orderSuccess.set(true);
          this.submitting.set(false);
          if (typeof window !== "undefined") {
            window.setTimeout(() => this.orderSuccess.set(false), 5_000);
          }
        },
        error: (error: unknown) => {
          const key =
            error instanceof HttpErrorResponse && error.status === 409
              ? "orderConflict"
              : "orderFailure";
          this.orderError.set(this.i18n.t(key));
          this.submitting.set(false);
        },
      });
  }
}
