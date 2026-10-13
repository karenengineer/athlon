import { Component, DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { Title } from "@angular/platform-browser";
import { I18nService } from "../../core/i18n/i18n.service";

@Component({
  selector: "app-not-found-page",
  imports: [RouterLink],
  template: `
    <section class="not-found page-width">
      <b>404</b>
      <h1>{{ i18n.t("notFoundTitle") }}</h1>
      <p>{{ i18n.t("notFoundText") }}</p>
      <a [routerLink]="['/', i18n.locale()]">{{ i18n.t("home") }}</a>
    </section>
  `,
  styles: `
    .not-found {
      min-height: 60vh;
      display: grid;
      place-content: center;
      justify-items: center;
      color: #171719;
      text-align: center;
      overflow-wrap: anywhere;
    }
    b {
      color: #171719;
      font-size: 5rem;
      font-style: italic;
    }
    h1 {
      margin: 0;
    }
    p {
      max-width: 38rem;
      color: #595960;
      line-height: 1.5;
    }
    a {
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 16px;
      border-radius: 10px;
      color: #fff;
      background: #171719;
      font-weight: 900;
      text-decoration: none;
    }
  `,
})
export class NotFoundPage {
  readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.route.parent?.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.i18n.setLocale(params.get("locale"));
        this.title.setTitle(`${this.i18n.t("notFoundTitle")} | ATHLON`);
      });
  }
}
