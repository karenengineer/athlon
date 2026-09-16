import { HttpClient, HttpParams } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { forkJoin } from "rxjs";
import { AdminList } from "../shared/admin-api.types";
import { AdminI18nService } from "../shared/admin-i18n.service";

@Component({
  selector: "app-admin-dashboard",
  imports: [RouterLink],
  templateUrl: "./dashboard-page.html",
  styleUrl: "./dashboard-page.scss",
})
export class DashboardPage {
  readonly i18n = inject(AdminI18nService);
  private readonly http = inject(HttpClient);
  readonly resources = ["products", "categories", "brands"] as const;
  readonly counts = signal<Record<string, number> | null>(null);
  readonly error = signal(false);
  constructor() {
    this.load();
  }
  load(): void {
    this.counts.set(null);
    this.error.set(false);
    const params = new HttpParams().set("pageSize", 1);
    forkJoin(
      this.resources.map((resource) =>
        this.http.get<AdminList<unknown>>(`/api/v1/admin/${resource}`, {
          params,
        }),
      ),
    ).subscribe({
      next: (lists) =>
        this.counts.set(
          Object.fromEntries(
            lists.map((list, index) => [
              this.resources[index],
              list.meta.total,
            ]),
          ),
        ),
      error: () => this.error.set(true),
    });
  }
}
