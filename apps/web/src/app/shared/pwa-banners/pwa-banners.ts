import { Component, computed, inject, input } from "@angular/core";
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
}
