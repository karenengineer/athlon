import { Component, inject, Input, signal } from "@angular/core";
import { FormArray, ReactiveFormsModule } from "@angular/forms";
import { AdminTranslationLocale } from "./admin-api.types";
import { AdminI18nService } from "./admin-i18n.service";
import { TranslationForm } from "./catalog-form";

@Component({
  selector: "app-admin-translation-tabs",
  imports: [ReactiveFormsModule],
  templateUrl: "./translation-tabs.html",
  styleUrl: "./catalog.scss",
})
export class TranslationTabs {
  readonly i18n = inject(AdminI18nService);
  @Input({ required: true }) forms!: FormArray<TranslationForm>;
  @Input() seo = false;
  @Input() product = false;
  readonly active = signal<AdminTranslationLocale>("HY");
  select(locale: AdminTranslationLocale): void {
    this.active.set(locale);
  }
  keydown(event: KeyboardEvent, index: number): void {
    const count = this.forms.length;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % count
        : event.key === "ArrowLeft"
          ? (index + count - 1) % count
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? count - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    const locale = this.forms.at(next).controls.locale.value;
    this.select(locale);
    (event.currentTarget as HTMLElement).parentElement
      ?.querySelector<HTMLButtonElement>(`#translation-tab-${locale}`)
      ?.focus();
  }
}
