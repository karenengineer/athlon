import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { I18nService } from "../../core/i18n/i18n.service";

@Component({
  selector: "app-not-found-page",
  imports: [RouterLink],
  template: `
    <section>
      <b>404</b>
      <h1>Page not found</h1>
      <a [routerLink]="['/', i18n.locale()]">{{ i18n.t("home") }}</a>
    </section>
  `,
  styles: `
    section {
      min-height: 60vh;
      display: grid;
      place-content: center;
      justify-items: center;
      color: #171719;
    }
    b {
      color: #e5001b;
      font-size: 5rem;
      font-style: italic;
    }
    h1 {
      margin: 0 0 20px;
    }
    a {
      color: #171719;
      font-weight: 900;
    }
  `,
})
export class NotFoundPage {
  readonly i18n = inject(I18nService);
}
