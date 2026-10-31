import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { I18nService } from "../../core/i18n/i18n.service";
import {
  informationNavigation,
  informationPageIds,
} from "../../core/i18n/information-navigation";
import {
  FACEBOOK_PROFILE_URL,
  INSTAGRAM_PROFILE_URL,
} from "../../core/social-links";

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
      <nav
        class="footer-information"
        [attr.aria-label]="information[i18n.locale()].label"
      >
        @for (page of informationPages; track page) {
          <a [routerLink]="['/', i18n.locale(), page]">{{
            information[i18n.locale()].pages[page]
          }}</a>
        }
      </nav>
      <div class="footer-socials" aria-label="Social links">
        <a
          class="footer-social"
          data-testid="footer-social-link"
          data-social="instagram"
          aria-label="Instagram"
          [href]="instagramUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/social/instagram.svg" width="36" height="36" alt="" />
        </a>
        <a
          class="footer-social"
          data-testid="footer-social-link"
          data-social="facebook"
          aria-label="Facebook"
          [href]="facebookUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="/social/facebook.svg" width="36" height="36" alt="" />
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
      flex-wrap: wrap;
      align-items: center;
      gap: 24px 32px;
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
      color: #a2a2a8;
    }
    a {
      margin-left: auto;
      color: #fff;
      font-weight: 700;
      text-decoration: none;
    }
    a:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 4px;
    }
    .footer-information {
      max-width: 360px;
      display: flex;
      flex-wrap: wrap;
      gap: 0 20px;
    }
    .footer-information a {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      margin-left: 0;
      padding-block: 10px;
      overflow-wrap: anywhere;
      font-size: 0.875rem;
    }
    .footer-socials {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .footer-social {
      width: 46px;
      height: 46px;
      min-width: 44px;
      min-height: 44px;
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
      color: #a2a2a8;
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
  readonly instagramUrl = INSTAGRAM_PROFILE_URL;
  readonly facebookUrl = FACEBOOK_PROFILE_URL;
  readonly information = informationNavigation;
  readonly informationPages = informationPageIds;
  readonly year = new Date().getFullYear();
}
