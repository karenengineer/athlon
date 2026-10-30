import { Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { combineLatest } from "rxjs";
import { I18nService, parseLocale } from "../../core/i18n/i18n.service";
import {
  InformationPageId,
  informationNavigation,
} from "../../core/i18n/information-navigation";
import { createPageMetadata } from "../../core/seo/page-metadata";
import { informationContent } from "./information-content";

@Component({
  selector: "app-information-page",
  imports: [RouterLink],
  templateUrl: "./information-page.html",
  styleUrl: "./information-page.scss",
})
export class InformationPage {
  readonly i18n = inject(I18nService);
  readonly pageId = signal<InformationPageId>("about");
  readonly content = signal(informationContent.hy.about);
  readonly navigation = informationNavigation;
  private readonly route = inject(ActivatedRoute);
  private readonly metadata = createPageMetadata();

  constructor() {
    combineLatest([this.route.data, this.route.parent!.paramMap])
      .pipe(takeUntilDestroyed())
      .subscribe(([data, params]) => {
        const locale = parseLocale(params.get("locale"));
        const pageId = data["informationPage"] as InformationPageId;
        const content = informationContent[locale][pageId];
        this.pageId.set(pageId);
        this.content.set(content);
        this.metadata.set({
          title: `${content.heading} | ATHLON`,
          description: content.description,
        });
      });
  }
}
