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
import { AdminDirtyForm } from "../../shared/admin-dirty-form.guard";
import { AdminFinanceService } from "../shared/admin-finance.service";
import {
  FinanceProductRow,
  Sale,
  SaleInput,
  SaleItemInput,
  SalesChannel,
} from "../shared/finance-api.types";
import { formatAmd } from "../shared/finance-format";
import { salesChannels } from "./sale-list";

type SaleLineForm = FormGroup<{
  productId: FormControl<string>;
  quantity: FormControl<number>;
  actualUnitPrice: FormControl<string>;
  lineDiscount: FormControl<string>;
}>;
const money = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/;
function uniqueProducts(control: AbstractControl): ValidationErrors | null {
  const ids = (control as FormArray<SaleLineForm>).controls
    .map((row) => row.controls.productId.value)
    .filter(Boolean);
  return new Set(ids).size === ids.length ? null : { duplicateProducts: true };
}
function discountWithinRevenue(
  control: AbstractControl,
): ValidationErrors | null {
  const row = control as SaleLineForm;
  const price = Number(row?.controls.actualUnitPrice.value ?? 0);
  const quantity = Number(row?.controls.quantity.value ?? 0);
  const discount = Number(row?.controls.lineDiscount.value || 0);
  return discount <= price * quantity ? null : { discount: true };
}
function line(item?: {
  productId: string;
  quantity: number;
  actualUnitPrice: string;
  lineDiscount?: string;
}): SaleLineForm {
  return new FormGroup(
    {
      productId: new FormControl(item?.productId ?? "", {
        nonNullable: true,
        validators: Validators.required,
      }),
      quantity: new FormControl(item?.quantity ?? 1, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(1)],
      }),
      actualUnitPrice: new FormControl(item?.actualUnitPrice ?? "", {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(money)],
      }),
      lineDiscount: new FormControl(item?.lineDiscount ?? "", {
        nonNullable: true,
        validators: Validators.pattern(money),
      }),
    },
    { validators: discountWithinRevenue },
  );
}

@Component({
  selector: "app-admin-sale-editor",
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: "./sale-editor.html",
  styleUrls: ["../../shared/catalog.scss", "../shared/finance-ui.scss"],
})
export class SaleEditor implements AdminDirtyForm {
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
  readonly channels: readonly SalesChannel[] = salesChannels;
  readonly authoritativeNet = signal<string | null>(null);
  id: string | null = null;
  private baseline = "";
  readonly form = new FormGroup({
    date: new FormControl("", {
      nonNullable: true,
      validators: Validators.required,
    }),
    orderId: new FormControl("", {
      nonNullable: true,
      validators: Validators.maxLength(100),
    }),
    channel: new FormControl<SalesChannel>("DIRECT", {
      nonNullable: true,
      validators: Validators.required,
    }),
    trainerReferralCode: new FormControl("", {
      nonNullable: true,
      validators: Validators.maxLength(100),
    }),
    customerName: new FormControl("", {
      nonNullable: true,
      validators: Validators.maxLength(180),
    }),
    customerPhone: new FormControl("", {
      nonNullable: true,
      validators: Validators.maxLength(50),
    }),
    notes: new FormControl("", {
      nonNullable: true,
      validators: Validators.maxLength(5000),
    }),
    items: new FormArray<SaleLineForm>([line()], {
      validators: uniqueProducts,
    }),
  });
  get items(): FormArray<SaleLineForm> {
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
    this.api
      .listProducts({ pageSize: 100, sort: "nameAsc" })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          this.products.set(r.items);
          this.optionsLoading.set(false);
        },
        error: () => {
          this.optionsLoading.set(false);
          this.error.set("Could not load products.");
        },
      });
  }
  load(): void {
    this.error.set(null);
    this.saved.set(false);
    this.authoritativeNet.set(null);
    if (!this.id) {
      this.capture();
      return;
    }
    this.loading.set(true);
    this.api
      .getSale(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.accept(s);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("Could not load sale.");
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
  selectedProduct(index: number): FinanceProductRow | undefined {
    const id = this.items.at(index).controls.productId.value;
    return this.products().find((p) => p.productId === id);
  }
  availableStock(index: number): number | null {
    return this.selectedProduct(index)?.currentStock ?? null;
  }
  lineNetNumber(index: number): number {
    const v = this.items.at(index).getRawValue();
    return Math.max(
      0,
      Number(v.actualUnitPrice || 0) * Number(v.quantity || 0) -
        Number(v.lineDiscount || 0),
    );
  }
  lineNet(index: number): string {
    return formatAmd(this.lineNetNumber(index));
  }
  draftNet(): string {
    return formatAmd(
      this.items.controls.reduce(
        (sum, _row, i) => sum + this.lineNetNumber(i),
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
    const items: SaleItemInput[] = v.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      actualUnitPrice: item.actualUnitPrice,
      ...(item.lineDiscount ? { lineDiscount: item.lineDiscount } : {}),
    }));
    const input: SaleInput = {
      date: v.date,
      orderId: v.orderId.trim() || null,
      channel: v.channel,
      trainerReferralCode: v.trainerReferralCode.trim() || null,
      customerName: v.customerName.trim() || null,
      customerPhone: v.customerPhone.trim() || null,
      notes: v.notes.trim() || null,
      items,
    };
    this.saving.set(true);
    this.error.set(null);
    const create = !this.id;
    const request = this.id
      ? this.api.updateSale(this.id, input)
      : this.api.createSale(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => {
        this.accept(s);
        this.saving.set(false);
        this.saved.set(true);
        if (create)
          void this.router.navigate(["/admin/finance/sales", s.id, "edit"], {
            replaceUrl: true,
            queryParamsHandling: "preserve",
          });
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(
          typeof e.error?.message === "string"
            ? e.error.message
            : e.status === 400
              ? "Check the sale fields."
              : "Could not save sale.",
        );
        queueMicrotask(() => this.errorSummary?.nativeElement.focus());
      },
    });
  }
  private accept(s: Sale): void {
    this.form.controls.date.setValue(s.date.slice(0, 10));
    this.form.controls.orderId.setValue(s.orderId ?? "");
    this.form.controls.channel.setValue(s.channel);
    this.form.controls.trainerReferralCode.setValue(
      s.trainerReferralCode ?? "",
    );
    this.form.controls.customerName.setValue(s.customerName ?? "");
    this.form.controls.customerPhone.setValue(s.customerPhone ?? "");
    this.form.controls.notes.setValue(s.notes ?? "");
    this.form.setControl(
      "items",
      new FormArray<SaleLineForm>(
        s.items.map((i) => line(i)),
        { validators: uniqueProducts },
      ),
    );
    this.authoritativeNet.set(s.totalNetRevenue);
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
