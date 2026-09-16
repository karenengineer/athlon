import { Component, inject, signal } from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { finalize } from "rxjs";
import { AdminI18nService } from "../shared/admin-i18n.service";
import { safeAdminReturnUrl } from "./admin-auth.guard";
import { AdminSessionService } from "./admin-session.service";

@Component({
  selector: "app-admin-login",
  imports: [ReactiveFormsModule],
  templateUrl: "./login-page.html",
  styleUrl: "./login-page.scss",
})
export class LoginPage {
  readonly i18n = inject(AdminI18nService);
  private readonly session = inject(AdminSessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly busy = signal(false);
  readonly failed = signal(false);
  readonly form = new FormGroup({
    email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  submit(): void {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.failed.set(false);
    const { email, password } = this.form.getRawValue();
    this.session
      .login(email, password)
      .pipe(
        finalize(() => {
          this.busy.set(false);
          this.form.controls.password.reset();
        }),
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(
            safeAdminReturnUrl(
              this.route.snapshot.queryParamMap.get("returnUrl"),
            ),
            { replaceUrl: true },
          );
        },
        error: () => this.failed.set(true),
      });
  }
}
