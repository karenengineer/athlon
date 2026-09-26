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
import {
  ExpenseCategory,
  RecurringExpenseInput,
} from "../shared/finance-api.types";

@Component({
  selector: "app-finance-recurring-editor",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./recurring-expense-editor.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class RecurringExpenseEditor implements AdminDirtyForm {
  private readonly api = inject(AdminFinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly categories = signal<ExpenseCategory[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);
  readonly addingCategory = signal(false);
  id: string | null = null;
  private baseline = "";
  readonly form = new FormGroup({
    name: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(180),
      ],
    }),
    categoryId: new FormControl("", {
      nonNullable: true,
      validators: Validators.required,
    }),
    amount: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/^\d+(?:\.\d{1,2})?$/),
      ],
    }),
    startDate: new FormControl("", {
      nonNullable: true,
      validators: Validators.required,
    }),
    endDate: new FormControl("", { nonNullable: true }),
    active: new FormControl(true, { nonNullable: true }),
    paymentMethod: new FormControl("", { nonNullable: true }),
    notes: new FormControl("", { nonNullable: true }),
  });
  readonly newCategory = new FormControl("", {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(180)],
  });
  constructor() {
    this.api
      .allExpenseCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () => this.error.set("Could not load categories."),
      });
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
      .getRecurringExpense(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (e) => {
          this.form.setValue({
            name: e.name,
            categoryId: e.categoryId,
            amount: e.amount,
            startDate: e.startDate.slice(0, 10),
            endDate: e.endDate?.slice(0, 10) || "",
            active: e.active,
            paymentMethod: e.paymentMethod || "",
            notes: e.notes || "",
          });
          this.capture();
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load template.");
        },
      });
  }
  addCategory(): void {
    const name = this.newCategory.value.trim();
    if (!name || this.addingCategory()) return;
    this.addingCategory.set(true);
    this.api
      .createExpenseCategory({ name })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (category) => {
          this.categories.update((items) => [...items, category]);
          this.form.controls.categoryId.setValue(category.id);
          this.newCategory.reset();
          this.addingCategory.set(false);
        },
        error: () => {
          this.addingCategory.set(false);
          this.error.set("Could not create category.");
        },
      });
  }
  submit(): void {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (this.form.invalid || this.saving()) return;
    if (v.endDate && v.endDate < v.startDate) {
      this.error.set("End date must be on or after start date.");
      return;
    }
    const input: RecurringExpenseInput = {
      name: v.name.trim(),
      categoryId: v.categoryId,
      amount: v.amount,
      startDate: v.startDate,
      endDate: v.endDate || null,
      active: v.active,
      paymentMethod: v.paymentMethod.trim() || null,
      notes: v.notes.trim() || null,
    };
    this.saving.set(true);
    this.error.set(null);
    const create = !this.id;
    const request = this.id
      ? this.api.updateRecurringExpense(this.id, input)
      : this.api.createRecurringExpense(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (e) => {
        this.saving.set(false);
        this.saved.set(true);
        this.form.setValue({
          name: e.name,
          categoryId: e.categoryId,
          amount: e.amount,
          startDate: e.startDate.slice(0, 10),
          endDate: e.endDate?.slice(0, 10) || "",
          active: e.active,
          paymentMethod: e.paymentMethod || "",
          notes: e.notes || "",
        });
        this.capture();
        if (create)
          void this.router.navigate(
            ["/admin/finance/recurring-expenses", e.id, "edit"],
            { replaceUrl: true, queryParamsHandling: "preserve" },
          );
      },
      error: () => {
        this.saving.set(false);
        this.error.set(
          "Could not save template. Check the fields and try again.",
        );
      },
    });
  }
  private capture(): void {
    this.form.markAsPristine();
    this.baseline = JSON.stringify(this.form.getRawValue());
  }
  hasUnsavedChanges(): boolean {
    return this.baseline !== JSON.stringify(this.form.getRawValue());
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
