import { Component, inject, signal } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { AdminSessionService } from "./auth/admin-session.service";
import { AdminCopyKey, AdminI18nService } from "./shared/admin-i18n.service";

@Component({
  selector: "app-admin-shell",
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: "./admin-shell.html",
  styleUrl: "./admin-shell.scss",
})
export class AdminShell {
  readonly i18n = inject(AdminI18nService);
  readonly session = inject(AdminSessionService);
  readonly links: readonly {
    key: AdminCopyKey;
    path: string;
    exact?: boolean;
  }[] = [
    { key: "dashboard", path: "/admin", exact: true },
    { key: "products", path: "/admin/products" },
    { key: "categories", path: "/admin/categories" },
    { key: "brands", path: "/admin/brands" },
  ];
  readonly financeLinks: readonly {
    key: AdminCopyKey;
    path: string;
    exact?: boolean;
  }[] = [
    { key: "financeDashboard", path: "/admin/finance", exact: true },
    { key: "financeProducts", path: "/admin/finance/products" },
    { key: "purchases", path: "/admin/finance/purchases" },
    { key: "sales", path: "/admin/finance/sales" },
    { key: "expenses", path: "/admin/finance/expenses" },
    { key: "monthlySummary", path: "/admin/finance/monthly-summary" },
    { key: "export", path: "/admin/finance/export" },
  ];
  readonly financeOpen = signal(true);
  readonly leaving = signal(false);
  readonly logoutFailed = signal(false);
  toggleFinance(): void {
    this.financeOpen.update((open) => !open);
  }
  logout(): void {
    if (this.leaving()) return;
    this.leaving.set(true);
    this.logoutFailed.set(false);
    this.session.logout().subscribe({
      complete: () => this.leaving.set(false),
      error: () => {
        this.leaving.set(false);
        this.logoutFailed.set(true);
      },
    });
  }
}
