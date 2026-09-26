import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { forkJoin } from "rxjs";
import { AdminDirtyForm } from "../../shared/admin-dirty-form.guard";
import { AdminFinanceService } from "../shared/admin-finance.service";
import {
  FinanceProductRow,
  Purchase,
  PurchaseInput,
  Supplier,
} from "../shared/finance-api.types";
import { formatAmd } from "../shared/finance-format";

type PurchaseLineForm = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<number>;
  purchaseUnitPrice: FormControl<string>;
}>;
const money = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
function uniqueProducts(control: AbstractControl): ValidationErrors | null {
  const ids = (control as FormArray<PurchaseLineForm>).controls
    .map((row) => row.controls.productId.value)
    .filter(Boolean);
  return new Set(ids).size === ids.length ? null : { duplicateProducts: true };
}
function line(item?: {
  productId: string;
  quantity: number;
  purchaseUnitPrice: string;
}): PurchaseLineForm {
  return new FormGroup({
    productId: new FormControl(item?.productId ?? "", {
      nonNullable: true,
      validators: Validators.required,
    }),
    quantity: new FormControl(item?.quantity ?? 1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
    purchaseUnitPrice: new FormControl(item?.purchaseUnitPrice ?? "", {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(money)],
    }),
  });
}

@Component({
  selector: "app-admin-purchase-editor",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./purchase-editor.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class PurchaseEditor implements AdminDirtyForm {
  private readonly api = inject(AdminFinanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild("errorSummary") errorSummary?: ElementRef<HTMLElement>;
  readonly loading = signal(false);
  readonly optionsLoading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);
  readonly products = signal<FinanceProductRow[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly authoritativeTotal = signal<string | null>(null);
  id: string | null = null;
  private baseline = "";
  readonly form = new FormGroup({
    date: new FormControl("", {
      nonNullable: true,
      validators: Validators.required,
    }),
    supplierId: new FormControl("", {
      nonNullable: true,
      validators: Validators.required,
    }),
    notes: new FormControl("", {
      nonNullable: true,
      validators: Validators.maxLength(5000),
    }),
    items: new FormArray<PurchaseLineForm>([line()], {
      validators: uniqueProducts,
    }),
  });
  get items(): FormArray<PurchaseLineForm> {
    return this.form.controls.items;
  }
  constructor() {
    this.loadOptions();
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        this.id = p.get("id");
        this.load();
      });
  }
  loadOptions(): void {
    this.optionsLoading.set(true);
    forkJoin({
      products: this.api.allProducts(),
      suppliers: this.api.allSuppliers(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ products, suppliers }) => {
          this.products.set(products);
          this.suppliers.set(suppliers);
          this.optionsLoading.set(false);
        },
        error: () => {
          this.optionsLoading.set(false);
          this.error.set("Could not load product or supplier options.");
        },
      });
  }
  load(): void {
    this.error.set(null);
    this.saved.set(false);
    this.authoritativeTotal.set(null);
    if (!this.id) {
      this.capture();
      return;
    }
    this.loading.set(true);
    this.api
      .getPurchase(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (p) => {
          this.accept(p);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load purchase.");
        },
      });
  }
  addItem(): void {
    this.items.push(line());
    this.items.markAsDirty();
  }
  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
    this.items.markAsDirty();
    this.items.updateValueAndValidity();
  }
  lineTotal(index: number): string {
    const v = this.items.at(index).getRawValue();
    const total = v.quantity * Number(v.purchaseUnitPrice);
    return Number.isFinite(total) ? formatAmd(total) : "—";
  }
  draftTotal(): string {
    return formatAmd(
      this.items.controls.reduce(
        (sum, _row, i) =>
          sum +
          Number(this.items.at(i).controls.quantity.value) *
            Number(this.items.at(i).controls.purchaseUnitPrice.value || 0),
        0,
      ),
    );
  }
  submit(): void {
    this.form.markAllAsTouched();
    this.items.updateValueAndValidity();
    if (
      this.form.invalid ||
      this.saving() ||
      this.loading() ||
      this.optionsLoading()
    )
      return;
    const v = this.form.getRawValue();
    const input: PurchaseInput = {
      date: v.date,
      supplierId: v.supplierId,
      notes: v.notes.trim() || null,
      items: v.items,
    };
    this.saving.set(true);
    this.error.set(null);
    const create = !this.id;
    const request = this.id
      ? this.api.updatePurchase(this.id, input)
      : this.api.createPurchase(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (p) => {
        this.accept(p);
        this.saving.set(false);
        this.saved.set(true);
        if (create)
          void this.router.navigate(
            ["/admin/finance/purchases", p.id, "edit"],
            { replaceUrl: true, queryParamsHandling: "preserve" },
          );
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(
          typeof e.error?.message === "string"
            ? e.error.message
            : e.status === 400
              ? "Check the purchase fields."
              : "Could not save purchase.",
        );
        queueMicrotask(() => this.errorSummary?.nativeElement.focus());
      },
    });
  }
  private accept(p: Purchase): void {
    this.form.controls.date.setValue(p.date.slice(0, 10));
    this.form.controls.supplierId.setValue(p.supplierId);
    this.form.controls.notes.setValue(p.notes ?? "");
    this.form.setControl(
      "items",
      new FormArray<PurchaseLineForm>(
        p.items.map((i) => line(i)),
        { validators: uniqueProducts },
      ),
    );
    this.authoritativeTotal.set(p.totalPurchaseCost);
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
