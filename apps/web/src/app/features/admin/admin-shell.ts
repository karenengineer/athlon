import { Component, inject, signal } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { AdminSessionService } from "./auth/admin-session.service";
import { AdminI18nService } from "./shared/admin-i18n.service";

@Component({
  selector: "app-admin-shell",
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: "./admin-shell.html",
  styleUrl: "./admin-shell.scss",
})
export class AdminShell {
  readonly i18n = inject(AdminI18nService);
  readonly session = inject(AdminSessionService);
  readonly links = ["dashboard", "products", "categories", "brands"] as const;
  readonly leaving = signal(false);
  readonly logoutFailed = signal(false);
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
