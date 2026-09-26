import { Component, DestroyRef, inject, output, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import {
  AdminCopyKey,
  AdminI18nService,
} from "../../shared/admin-i18n.service";
import { FinanceDate, FinanceReportPeriod } from "./finance-api.types";

export interface DateRangeSelection {
  preset: FinanceReportPeriod;
  from?: FinanceDate;
  to?: FinanceDate;
}

export const dateRangePresets: readonly FinanceReportPeriod[] = [
  "today",
  "thisMonth",
  "previousMonth",
  "thisYear",
  "custom",
];

const presetLabels: Record<FinanceReportPeriod, AdminCopyKey> = {
  today: "today",
  thisMonth: "thisMonth",
  previousMonth: "previousMonth",
  thisYear: "thisYear",
  custom: "custom",
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function normalizedFinanceDate(value: string): FinanceDate | null {
  if (!datePattern.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : null;
}

@Component({
  selector: "app-date-range-filter",
  templateUrl: "./date-range-filter.html",
})
export class DateRangeFilter {
  readonly i18n = inject(AdminI18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly presets = dateRangePresets;
  readonly preset = signal<FinanceReportPeriod>("thisMonth");
  readonly from = signal("");
  readonly to = signal("");
  readonly invalid = signal(false);
  readonly rangeChange = output<DateRangeSelection>();

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const requested = params.get("period");
        const preset = dateRangePresets.includes(
          requested as FinanceReportPeriod,
        )
          ? (requested as FinanceReportPeriod)
          : "thisMonth";
        this.preset.set(preset);
        this.from.set(params.get("dateFrom") ?? "");
        this.to.set(params.get("dateTo") ?? "");
        this.invalid.set(false);
      });
  }

  selectPreset(preset: FinanceReportPeriod): void {
    this.preset.set(preset);
    this.invalid.set(false);
    if (preset === "custom") return;
    this.from.set("");
    this.to.set("");
    this.commit({ preset });
  }

  applyCustom(): void {
    const from = normalizedFinanceDate(this.from());
    const to = normalizedFinanceDate(this.to());
    if (!from || !to || from > to) {
      this.invalid.set(true);
      return;
    }
    this.invalid.set(false);
    this.commit({ preset: "custom", from, to });
  }

  presetLabel(preset: FinanceReportPeriod): string {
    return this.i18n.translate(presetLabels[preset]);
  }

  private commit(selection: DateRangeSelection): void {
    this.rangeChange.emit(selection);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: "merge",
      queryParams: {
        period: selection.preset,
        dateFrom: selection.from ?? null,
        dateTo: selection.to ?? null,
        page: null,
      },
    });
  }
}
