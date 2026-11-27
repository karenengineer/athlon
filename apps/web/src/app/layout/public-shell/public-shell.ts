import { DOCUMENT, isPlatformBrowser } from "@angular/common";
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { BasketService } from "../../core/basket/basket.service";
import { BasketBumpDirective } from "../../shared/basket-bump/basket-bump.directive";
import { I18nService } from "../../core/i18n/i18n.service";
import { PwaBanners } from "../../shared/pwa-banners/pwa-banners";
import { filter, map } from "rxjs";
import { Footer } from "../footer/footer";
import { Header } from "../header/header";

@Component({
  selector: "app-public-shell",
  imports: [
    Header,
    Footer,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    BasketBumpDirective,
    PwaBanners,
  ],
  template: `
    <div class="dark-shell" data-testid="header-spacer">
      <app-header #siteHeader data-testid="fixed-header" />
    </div>
    <app-pwa-banners part="offline" />
    <main><router-outlet /></main>
    <div class="footer-shell"><app-footer /></div>
    <app-pwa-banners [quiet]="checkoutFlow()" />
    <a
      class="floating-basket"
      data-testid="floating-basket-link"
      [routerLink]="['/', i18n.locale(), 'basket']"
      routerLinkActive="is-hidden"
      [routerLinkActiveOptions]="{ exact: true }"
      [attr.aria-label]="i18n.t('basket')"
      [appBasketBump]="basket.totalQuantity()"
      basketBumpBadge="span"
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
    /* The header stays on screen: a full-width black bar fixed to the top,
       with its content centred. The shell keeps its height free below it. */
    .dark-shell {
      height: var(--header-height);
    }
    app-header {
      position: fixed;
      z-index: 11;
      top: 0;
      right: 0;
      left: 0;
      background: #080809;
      box-shadow: 0 1px 0 rgb(255 255 255 / 8%);
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
    .floating-basket.is-hidden {
      display: none;
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
  private readonly document = inject(DOCUMENT);
  readonly basket = inject(BasketService);
  readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  /** Basket, bank return and review pages: no install suggestion there. */
  readonly checkoutFlow = computed(() =>
    /^\/[a-z]{2}\/(basket|payment|review)(\/|\?|$)/.test(this.url()),
  );
  private readonly siteHeader = viewChild.required("siteHeader", {
    read: ElementRef<HTMLElement>,
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    // CSS gives a close default; measuring keeps the spacer, sticky panels
    // and anchor scrolling exact when the header wraps or fonts load.
    afterNextRender(() => {
      const view = this.document.defaultView;
      if (!browser || !view || !("ResizeObserver" in view)) return;
      const root = this.document.documentElement;
      const header = this.siteHeader().nativeElement;
      const observer = new view.ResizeObserver(() => {
        const height = Math.ceil(header.getBoundingClientRect().height);
        if (height > 0)
          root.style.setProperty("--header-height", `${height}px`);
      });
      observer.observe(header);
      destroyRef.onDestroy(() => {
        observer.disconnect();
        root.style.removeProperty("--header-height");
      });
    });

    this.route.paramMap
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((params) => {
        this.i18n.setLocale(params.get("locale"));
        this.document.documentElement.lang = this.i18n.locale();
      });
  }
}
