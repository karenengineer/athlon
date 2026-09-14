import { Component, DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterOutlet } from "@angular/router";
import { I18nService } from "../../core/i18n/i18n.service";
import { Footer } from "../footer/footer";
import { Header } from "../header/header";

@Component({
  selector: "app-public-shell",
  imports: [Header, Footer, RouterOutlet],
  template: `
    <div class="dark-shell"><app-header /></div>
    <main><router-outlet /></main>
    <div class="footer-shell"><app-footer /></div>
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
  `,
})
export class PublicShell {
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((params) => this.i18n.setLocale(params.get("locale")));
  }
}
