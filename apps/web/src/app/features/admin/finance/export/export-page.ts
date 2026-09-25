import { Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { AdminFinanceService } from "../shared/admin-finance.service";
import {
  FinanceExportEndpoint,
  ReportQuery,
} from "../shared/finance-api.types";
import { normalizedFinanceDate } from "../shared/date-range-filter";
import { saveFinanceDownload } from "./save-download";

@Component({
  selector: "app-finance-export",
  imports: [ReactiveFormsModule],
  templateUrl: "./export-page.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class FinanceExportPage {
  private readonly api = inject(AdminFinanceService);
  private readonly destroyRef = inject(DestroyRef);
  readonly downloading = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly options: { endpoint: FinanceExportEndpoint; label: string }[] = [
    { endpoint: "products.csv", label: "Products CSV" },
    { endpoint: "purchases.csv", label: "Purchases CSV" },
    { endpoint: "sales.csv", label: "Sales CSV" },
    { endpoint: "expenses.csv", label: "Expenses CSV" },
    { endpoint: "monthly-summary.csv", label: "Monthly summary CSV" },
    { endpoint: "profitability.csv", label: "Profitability CSV" },
  ];
  readonly form = new FormGroup({
    dateFrom: new FormControl("", { nonNullable: true }),
    dateTo: new FormControl("", { nonNullable: true }),
    endpoint: new FormControl<FinanceExportEndpoint>("products.csv", {
      nonNullable: true,
    }),
  });
  download(accounting = false): void {
    if (this.downloading()) return;
    const v = this.form.getRawValue();
    const from = normalizedFinanceDate(v.dateFrom);
    const to = normalizedFinanceDate(v.dateTo);
    if (!from || !to || from > to) {
      this.error.set("Choose a valid date range.");
      this.success.set(null);
      return;
    }
    const endpoint: FinanceExportEndpoint = accounting
      ? "accounting.xlsx"
      : v.endpoint;
    const query: ReportQuery = { period: "custom", dateFrom: from, dateTo: to };
    this.downloading.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api
      .download(endpoint, query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (file) => {
          try {
            saveFinanceDownload(file);
            this.success.set(`Downloaded ${file.filename}.`);
          } catch {
            this.error.set("Could not save the download.");
          } finally {
            this.downloading.set(false);
          }
        },
        error: () => {
          this.downloading.set(false);
          this.error.set("Could not download the export. Try again.");
        },
      });
  }
}
