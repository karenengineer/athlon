import { Component, DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink, RouterOutlet } from "@angular/router";
import { BasketService } from "../../core/basket/basket.service";
import { I18nService } from "../../core/i18n/i18n.service";
import { Footer } from "../footer/footer";
import { Header } from "../header/header";

@Component({
  selector: "app-public-shell",
  imports: [Header, Footer, RouterLink, RouterOutlet],
  template: `
    <div class="dark-shell"><app-header /></div>
    <main><router-outlet /></main>
    <div class="footer-shell"><app-footer /></div>
    <a
      class="floating-basket"
      data-testid="floating-basket-link"
      [routerLink]="['/', i18n.locale(), 'basket']"
      [attr.aria-label]="i18n.t('basket')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M3 4h2.2l2.1 10.2a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 1.9-1.4l1.4-5.4H6.2"
        />
        <circle cx="9.2" cy="20" r="1.3" />
        <circle cx="17.2" cy="20" r="1.3" />
      </svg>
      <span data-testid="floating-basket-count">{{
        basket.totalQuantity()
      }}</span>
    </a>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: #080809;
    }
    .dark-shell,
    .footer-shell {
      background: #080809;
    }
    main {
      min-height: 60vh;
      background: #f0f0f2;
    }
    .floating-basket {
      position: fixed;
      z-index: 100;
      right: max(18px, env(safe-area-inset-right));
      bottom: max(18px, env(safe-area-inset-bottom));
      width: 62px;
      height: 62px;
      display: grid;
      place-items: center;
      border: 1px solid #2d2d31;
      border-radius: 50%;
      color: black;
      background: white;
      box-shadow: 0 18px 48px rgb(0 0 0 / 28%);
      text-decoration: none;
    }
    .floating-basket svg {
      width: 28px;
      height: 28px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }
    .floating-basket span {
      position: absolute;
      top: -5px;
      right: -5px;
      min-width: 25px;
      height: 25px;
      display: grid;
      place-items: center;
      border: 2px solid #f0f0f2;
      border-radius: 999px;
      color: #111113;
      background: #fff;
      font-size: 0.78rem;
      font-weight: 900;
    }
  `,
})
export class PublicShell {
  private readonly route = inject(ActivatedRoute);
  readonly basket = inject(BasketService);
  readonly i18n = inject(I18nService);

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((params) => this.i18n.setLocale(params.get("locale")));
  }
}
