import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { I18nService } from "../../core/i18n/i18n.service";
import { PwaService } from "../../core/pwa/pwa.service";

/**
 * Offline notice, "new version" bar and the install suggestion for the
 * storefront. The install card stays out of the way during checkout.
 */
@Component({
  selector: "app-pwa-banners",
  template: `
    @if (part() === "offline") {
      @if (!pwa.online()) {
        <p class="offline" role="status" data-testid="pwa-offline">
          {{ i18n.t("pwaOffline") }}
        </p>
      }
    } @else if (pwa.updateReady()) {
      <div class="update" role="status" data-testid="pwa-update">
        <span>{{ i18n.t("pwaUpdateAvailable") }}</span>
        <button type="button" (click)="pwa.reload()">
          {{ i18n.t("pwaReload") }}
        </button>
      </div>
    } @else if (showInstall()) {
      <aside
        class="install"
        data-testid="pwa-install"
        [attr.aria-label]="i18n.t('pwaInstallTitle')"
      >
        <img src="/icons/icon-192.png" alt="" width="44" height="44" />
        <div class="copy">
          <b>{{ i18n.t("pwaInstallTitle") }}</b>
          <span>{{
            pwa.install() === "ios"
              ? i18n.t("pwaIosHint")
              : i18n.t("pwaInstallText")
          }}</span>
        </div>
        @if (pwa.install() === "ios") {
          <button
            type="button"
            class="primary"
            data-testid="pwa-ios-howto"
            aria-haspopup="dialog"
            (click)="openGuide()"
          >
            {{ i18n.t("pwaHowTo") }}
          </button>
        }
        @if (pwa.install() === "prompt") {
          <button
            type="button"
            class="primary"
            data-testid="pwa-install-button"
            (click)="pwa.promptInstall()"
          >
            {{ i18n.t("pwaInstallAction") }}
          </button>
        }
        <button
          type="button"
          class="close"
          data-testid="pwa-install-dismiss"
          [attr.aria-label]="i18n.t('pwaDismiss')"
          (click)="pwa.dismissInstall()"
        >
          ×
        </button>
      </aside>
    }
    @if (guideOpen() && part() === "floating") {
      <button
        type="button"
        class="guide-backdrop"
        tabindex="-1"
        [attr.aria-label]="i18n.t('pwaDismiss')"
        (click)="closeGuide()"
      ></button>
      @if (pwa.iosBrowser() === "chrome") {
        <span class="guide-arrow up" aria-hidden="true">↑</span>
      }
      <section
        class="guide"
        [class.top]="pwa.iosBrowser() === 'safari'"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-guide-title"
        data-testid="pwa-ios-guide"
      >
        <h2 id="pwa-guide-title">{{ i18n.t("pwaGuideTitle") }}</h2>
        <ol>
          <li>
            <span class="step">1</span>
            <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
              <path
                d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"
              />
            </svg>
            <span data-testid="pwa-guide-step-share">{{ shareStep() }}</span>
          </li>
          <li>
            <span class="step">2</span>
            <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="4" />
              <path d="M12 8.5v7M8.5 12h7" />
            </svg>
            <span>{{ i18n.t("pwaStepAdd") }}</span>
          </li>
        </ol>
        <button
          #guideDone
          type="button"
          class="primary done"
          data-testid="pwa-guide-done"
          (click)="closeGuide()"
        >
          {{ i18n.t("pwaGuideDone") }}
        </button>
      </section>
    }
  `,
  styles: `
    .offline {
      position: sticky;
      z-index: 10;
      top: var(--header-height);
      margin: 0;
      padding: 10px 16px;
      color: #fff;
      background: #a41622;
      font-size: 0.88rem;
      font-weight: 700;
      text-align: center;
    }
    .update,
    .install {
      box-sizing: border-box;
      position: fixed;
      z-index: 99;
      bottom: max(18px, env(safe-area-inset-bottom));
      left: max(16px, env(safe-area-inset-left));
      right: calc(max(18px, env(safe-area-inset-right)) + 76px);
      max-width: 460px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 12px 12px 14px;
      border: 1px solid #2d2d31;
      border-radius: 16px;
      color: #fff;
      background: #111113;
      box-shadow: 0 18px 48px rgb(0 0 0 / 30%);
      font-size: 0.86rem;
      line-height: 1.35;
    }
    .update span {
      flex: 1;
    }
    .install {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 40px;
      align-items: start;
      gap: 8px 12px;
    }
    .install img {
      border-radius: 12px;
    }
    .copy {
      min-width: 0;
      display: grid;
      gap: 2px;
    }
    .install .primary {
      grid-column: 2;
      justify-self: start;
    }
    .install .close {
      grid-column: 3;
      grid-row: 1;
      margin: -6px -6px 0 0;
    }
    .copy span {
      color: #c9c9ce;
    }
    button {
      min-height: 40px;
      padding: 0 14px;
      border: 1px solid #fff;
      border-radius: 10px;
      color: #111113;
      background: #fff;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 2px;
    }
    .guide-backdrop {
      position: fixed;
      z-index: 1100;
      inset: 0;
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: rgb(0 0 0 / 55%);
      cursor: default;
    }
    .guide {
      position: fixed;
      z-index: 1101;
      right: 0;
      bottom: 0;
      left: 0;
      max-width: 520px;
      margin: 0 auto;
      padding: 22px 20px max(20px, env(safe-area-inset-bottom));
      border-radius: 20px 20px 0 0;
      color: #fff;
      background: #111113;
      box-shadow: 0 -12px 40px rgb(0 0 0 / 35%);
    }
    /* Safari's Share button is in the bottom toolbar: keep it uncovered. */
    .guide.top {
      top: 0;
      bottom: auto;
      padding-top: max(22px, env(safe-area-inset-top));
      border-radius: 0 0 20px 20px;
    }
    .guide h2 {
      margin: 0 0 14px;
      font-size: 1.08rem;
    }
    .guide ol {
      display: grid;
      gap: 12px;
      margin: 0 0 18px;
      padding: 0;
      list-style: none;
    }
    .guide li {
      display: grid;
      grid-template-columns: 26px 30px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      font-size: 0.95rem;
      line-height: 1.4;
    }
    .step {
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #111113;
      background: #fff;
      font-size: 0.85rem;
      font-weight: 900;
    }
    .glyph {
      width: 30px;
      height: 30px;
      fill: none;
      stroke: #4da3ff;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .done {
      width: 100%;
      min-height: 46px;
    }
    /* Chrome on iPhone: Share sits in the address bar, just above the page. */
    .guide-arrow {
      position: fixed;
      z-index: 1101;
      top: 6px;
      right: 22px;
      width: 46px;
      height: 46px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #111113;
      background: #fff;
      font-size: 1.6rem;
      font-weight: 900;
      animation: nudge 1s ease-in-out infinite;
    }
    @keyframes nudge {
      50% {
        transform: translateY(-8px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .guide-arrow {
        animation: none;
      }
    }
    .close {
      min-width: 40px;
      padding: 0;
      border-color: transparent;
      color: #c9c9ce;
      background: transparent;
      font-size: 1.4rem;
      font-weight: 400;
    }
  `,
})
export class PwaBanners {
  readonly i18n = inject(I18nService);
  readonly pwa = inject(PwaService);
  /** "offline" sits in the page flow under the header; "floating" is the
   * update bar or install card at the bottom of the screen. */
  readonly part = input<"offline" | "floating">("floating");
  /** Hide the install card on pages where it would get in the way. */
  readonly quiet = input(false);
  readonly showInstall = computed(
    () => !this.quiet() && this.pwa.install() !== "none",
  );
  readonly guideOpen = signal(false);
  readonly shareStep = computed(() =>
    this.i18n.t(
      this.pwa.iosBrowser() === "chrome"
        ? "pwaStepShareChrome"
        : this.pwa.iosBrowser() === "safari"
          ? "pwaStepShareSafari"
          : "pwaStepShareOther",
    ),
  );
  private readonly guideDone =
    viewChild<ElementRef<HTMLButtonElement>>("guideDone");
  private returnFocus: HTMLElement | null = null;

  openGuide(): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.guideOpen.set(true);
    // Move focus into the dialog once it has rendered.
    queueMicrotask(() =>
      setTimeout(() => this.guideDone()?.nativeElement.focus()),
    );
  }

  @HostListener("document:keydown.escape")
  closeGuide(): void {
    if (!this.guideOpen()) return;
    this.guideOpen.set(false);
    this.returnFocus?.focus();
    this.returnFocus = null;
  }
}
