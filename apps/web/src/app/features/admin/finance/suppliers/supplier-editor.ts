import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AdminDirtyForm } from "../../shared/admin-dirty-form.guard";
import { AdminFinanceService } from "../shared/admin-finance.service";
import { Supplier, SupplierInput } from "../shared/finance-api.types";

@Component({
  selector: "app-admin-supplier-editor",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./supplier-editor.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class SupplierEditor implements AdminDirtyForm {
  private readonly api = inject(AdminFinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);
  id: string | null = null;
  private baseline = "";
  readonly form = new FormGroup({
    name: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(180),
        Validators.pattern(/\S/),
      ],
    }),
    contactName: new FormControl("", {
      nonNullable: true,
      validators: Validators.maxLength(180),
    }),
    phone: new FormControl("", {
      nonNullable: true,
      validators: Validators.maxLength(50),
    }),
    email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(320)],
    }),
    notes: new FormControl("", {
      nonNullable: true,
      validators: Validators.maxLength(5000),
    }),
    active: new FormControl(true, { nonNullable: true }),
  });
  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        this.id = p.get("id");
        this.load();
      });
  }
  load(): void {
    this.error.set(null);
    this.saved.set(false);
    if (!this.id) {
      this.form.reset({ active: true });
      this.capture();
      return;
    }
    this.loading.set(true);
    this.api
      .getSupplier(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.accept(s);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load supplier.");
        },
      });
  }
  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const input: SupplierInput = {
      name: v.name.trim(),
      contactName: v.contactName.trim() || null,
      phone: v.phone.trim() || null,
      email: v.email.trim() || null,
      notes: v.notes.trim() || null,
      active: v.active,
    };
    this.saving.set(true);
    this.error.set(null);
    const create = !this.id;
    const request = this.id
      ? this.api.updateSupplier(this.id, input)
      : this.api.createSupplier(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => {
        this.accept(s);
        this.saving.set(false);
        this.saved.set(true);
        if (create)
          void this.router.navigate(
            ["/admin/finance/suppliers", s.id, "edit"],
            { replaceUrl: true, queryParamsHandling: "preserve" },
          );
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(
          e.status === 409
            ? "A supplier with this name already exists."
            : e.status === 400
              ? "Check the supplier fields."
              : "Could not save supplier.",
        );
      },
    });
  }
  private accept(s: Supplier): void {
    this.form.setValue({
      name: s.name,
      contactName: s.contactName ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      notes: s.notes ?? "",
      active: s.active,
    });
    this.capture();
  }
  private capture(): void {
    this.form.markAsPristine();
    this.baseline = JSON.stringify(this.form.getRawValue());
  }
  hasUnsavedChanges(): boolean {
    return (
      !!this.baseline &&
      this.baseline !== JSON.stringify(this.form.getRawValue())
    );
  }
  confirmDiscard(): boolean {
    return window.confirm("Unsaved changes will be lost. Continue?");
  }
  @HostListener("window:beforeunload", ["$event"]) beforeUnload(
    event: BeforeUnloadEvent,
  ): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
}
