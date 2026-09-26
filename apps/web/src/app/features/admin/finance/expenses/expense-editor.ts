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
  Expense,
  ExpenseCategory,
  ExpenseInput,
} from "../shared/finance-api.types";

@Component({
  selector: "app-finance-expense-editor",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./expense-editor.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class ExpenseEditor implements AdminDirtyForm {
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
  source: Expense["source"] = "ONE_TIME";
  private baseline = "";
  readonly form = new FormGroup({
    date: new FormControl("", {
      nonNullable: true,
      validators: Validators.required,
    }),
    categoryId: new FormControl("", {
      nonNullable: true,
      validators: Validators.required,
    }),
    description: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(500),
        Validators.pattern(/\S/),
      ],
    }),
    amount: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/^\d+(?:\.\d{1,2})?$/),
      ],
    }),
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
      this.form.reset();
      this.capture();
      return;
    }
    this.loading.set(true);
    this.api
      .getExpense(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (e) => {
          this.source = e.source;
          this.form.setValue({
            date: e.date.slice(0, 10),
            categoryId: e.categoryId,
            description: e.description,
            amount: e.amount,
            paymentMethod: e.paymentMethod || "",
            notes: e.notes || "",
          });
          this.capture();
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load expense.");
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
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const input: ExpenseInput = {
      date: v.date,
      categoryId: v.categoryId,
      description: v.description.trim(),
      amount: v.amount,
      paymentMethod: v.paymentMethod.trim() || null,
      notes: v.notes.trim() || null,
    };
    this.saving.set(true);
    this.error.set(null);
    const create = !this.id;
    const request = this.id
      ? this.api.updateExpense(this.id, input)
      : this.api.createExpense(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (e) => {
        this.saving.set(false);
        this.saved.set(true);
        this.form.setValue({
          date: e.date.slice(0, 10),
          categoryId: e.categoryId,
          description: e.description,
          amount: e.amount,
          paymentMethod: e.paymentMethod || "",
          notes: e.notes || "",
        });
        this.capture();
        if (create)
          void this.router.navigate(["/admin/finance/expenses", e.id, "edit"], {
            replaceUrl: true,
            queryParamsHandling: "preserve",
          });
      },
      error: () => {
        this.saving.set(false);
        this.error.set(
          "Could not save expense. Check the fields and try again.",
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
