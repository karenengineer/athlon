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
import { Subscription } from "rxjs";
import { AdminBrand, AdminBrandInput } from "../shared/admin-api.types";
import { AdminCatalogService } from "../shared/admin-catalog.service";
import { AdminDirtyForm } from "../shared/admin-dirty-form.guard";
import { AdminCopyKey, AdminI18nService } from "../shared/admin-i18n.service";
import {
  slugValidators,
  translationForms,
  translationPayload,
} from "../shared/catalog-form";
import { TranslationTabs } from "../shared/translation-tabs";

@Component({
  selector: "app-admin-brand-editor",
  imports: [ReactiveFormsModule, RouterLink, TranslationTabs],
  templateUrl: "./brand-editor.html",
  styleUrl: "../shared/catalog.scss",
})
export class BrandEditor implements AdminDirtyForm {
  readonly i18n = inject(AdminI18nService);
  private readonly api = inject(AdminCatalogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly preview = signal(false);
  readonly error = signal<AdminCopyKey | null>(null);
  id: string | null = null;
  private original: AdminBrand | null = null;
  private baseline = "";
  private editorGeneration = 0;
  private detailRequest?: Subscription;
  readonly form = new FormGroup({
    name: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(180),
      ],
    }),
    slug: new FormControl("", {
      nonNullable: true,
      validators: slugValidators,
    }),
    logoKey: new FormControl("", {
      nonNullable: true,
      validators: Validators.maxLength(500),
    }),
    published: new FormControl(true, { nonNullable: true }),
    translations: translationForms(),
  });
  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.editorGeneration++;
        this.original = null;
        this.baseline = "";
        this.saving.set(false);
        this.preview.set(false);
        this.id = params.get("id");
        this.load();
      });
  }
  load(): void {
    this.detailRequest?.unsubscribe();
    this.error.set(null);
    this.saved.set(false);
    if (!this.id) {
      this.baseline = JSON.stringify(this.form.getRawValue());
      return;
    }
    this.loading.set(true);
    this.detailRequest = this.api
      .getBrand(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (brand) => {
          this.accept(brand);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("error");
        },
      });
  }
  draftTranslations() {
    return translationPayload(
      this.form.controls.translations,
      this.original?.translations,
    );
  }
  submit(): void {
    this.form.markAllAsTouched();
    if (
      this.form.invalid ||
      this.saving() ||
      this.loading() ||
      this.error() === "error"
    )
      return;
    const values = this.form.getRawValue();
    const input: AdminBrandInput = {
      ...values,
      logoKey:
        values.logoKey === (this.original?.logoKey ?? "")
          ? (this.original?.logoKey ?? null)
          : values.logoKey || null,
      translations: this.draftTranslations(),
    };
    this.saving.set(true);
    this.error.set(null);
    this.saved.set(false);
    const generation = this.editorGeneration;
    const editingId = this.id;
    const create = !editingId;
    const request = editingId
      ? this.api.updateBrand(editingId, input)
      : this.api.createBrand(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (brand) => {
        // A server write can finish after accepted navigation; it belongs only
        // to the editor generation that submitted it, not the reused component.
        if (generation !== this.editorGeneration) return;
        this.accept(brand);
        this.saving.set(false);
        this.saved.set(true);
        if (create)
          void this.router.navigate(["/admin/brands", brand.id, "edit"], {
            replaceUrl: true,
            queryParamsHandling: "preserve",
          });
      },
      error: (error) => {
        if (generation !== this.editorGeneration) return;
        this.saving.set(false);
        this.error.set(
          error.status === 400
            ? "serverValidation"
            : error.status === 409
              ? "duplicate"
              : "saveError",
        );
      },
    });
  }
  private accept(brand: AdminBrand): void {
    this.original = brand;
    this.form.setControl("translations", translationForms(brand.translations));
    this.form.patchValue({
      name: brand.name,
      slug: brand.slug,
      logoKey: brand.logoKey ?? "",
      published: brand.published ?? true,
    });
    this.form.markAsPristine();
    this.baseline = JSON.stringify(this.form.getRawValue());
  }
  hasUnsavedChanges(): boolean {
    return (
      this.baseline !== "" &&
      JSON.stringify(this.form.getRawValue()) !== this.baseline
    );
  }
  confirmDiscard(): boolean {
    return window.confirm(this.i18n.translate("discard"));
  }
  @HostListener("window:beforeunload", ["$event"])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
}
