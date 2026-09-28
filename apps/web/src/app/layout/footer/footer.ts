import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { I18nService } from "../../core/i18n/i18n.service";

@Component({
  selector: "app-footer",
  imports: [RouterLink],
  template: `
    <footer>
      <div>
        <strong>ATHLON</strong>
        <p>{{ i18n.t("footerText") }}</p>
      </div>
      <a [routerLink]="['/', i18n.locale(), 'catalog']">{{
        i18n.t("catalog")
      }}</a>
      <div class="footer-socials" aria-label="Social links">
        <a
          class="footer-social"
          data-testid="footer-social-link"
          data-social="instagram"
          aria-label="Instagram link placeholder"
          aria-disabled="true"
        >
          <img src="/social/instagram.svg" width="36" height="36" alt="" />
        </a>
        <a
          class="footer-social"
          data-testid="footer-social-link"
          data-social="facebook"
          aria-label="Facebook link placeholder"
          aria-disabled="true"
        >
          <img src="/social/facebook.svg" width="36" height="36" alt="" />
        </a>
        <a
          class="footer-social"
          data-testid="footer-social-link"
          data-social="whatsapp"
          aria-label="WhatsApp link placeholder"
          aria-disabled="true"
        >
          <img src="/social/whatsapp.svg" width="36" height="36" alt="" />
        </a>
        <a
          class="footer-social"
          data-testid="footer-social-link"
          data-social="telegram"
          aria-label="Telegram link placeholder"
          aria-disabled="true"
        >
          <img src="/social/telegram.svg" width="36" height="36" alt="" />
        </a>
      </div>
      <small>© {{ year }} ATHLON</small>
    </footer>
  `,
  styles: `
    footer {
      max-width: 1200px;
      margin: auto;
      min-height: 150px;
      display: flex;
      align-items: center;
      gap: 40px;
      padding: 32px 24px;
      color: #c5c5c8;
    }
    strong {
      color: #fff;
      font-size: 1.25rem;
      font-style: italic;
    }
    p {
      margin: 7px 0 0;
      color: #8c8c92;
    }
    a {
      margin-left: auto;
      color: #fff;
      font-weight: 700;
      text-decoration: none;
    }
    .footer-socials {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .footer-social {
      width: 46px;
      height: 46px;
      display: grid;
      margin-left: 0;
      place-items: center;
      border-radius: 12px;
      background: transparent;
    }
    .footer-social img {
      width: 36px;
      height: 36px;
      border-radius: 12px;
    }
    small {
      color: #737379;
    }
    @media (max-width: 640px) {
      footer {
        align-items: flex-start;
        flex-direction: column;
        gap: 18px;
      }
      a {
        margin-left: 0;
      }
    }
  `,
})
export class Footer {
  readonly i18n = inject(I18nService);
  readonly year = new Date().getFullYear();
}
