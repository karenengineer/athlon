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
import { AdminCategory, AdminCategoryInput } from "../shared/admin-api.types";
import { AdminCatalogService } from "../shared/admin-catalog.service";
import { AdminDirtyForm } from "../shared/admin-dirty-form.guard";
import { AdminCopyKey, AdminI18nService } from "../shared/admin-i18n.service";
import {
  categoryParentOptions,
  slugValidators,
  translationForms,
  translationPayload,
} from "../shared/catalog-form";
import { TranslationTabs } from "../shared/translation-tabs";

@Component({
  selector: "app-admin-category-editor",
  imports: [ReactiveFormsModule, RouterLink, TranslationTabs],
  templateUrl: "./category-editor.html",
  styleUrl: "../shared/catalog.scss",
})
export class CategoryEditor implements AdminDirtyForm {
  readonly i18n = inject(AdminI18nService);
  private readonly api = inject(AdminCatalogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(false);
  readonly parentLoading = signal(true);
  readonly parentError = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly preview = signal(false);
  readonly error = signal<AdminCopyKey | null>(null);
  readonly parents = signal<AdminCategory[]>([]);
  id: string | null = null;
  private original: AdminCategory | null = null;
  private baseline = "";
  private detailRequest?: Subscription;
  private parentRequest?: Subscription;
  readonly form = new FormGroup({
    code: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(80),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    }),
    slug: new FormControl("", {
      nonNullable: true,
      validators: slugValidators,
    }),
    parentId: new FormControl("", { nonNullable: true }),
    published: new FormControl(true, { nonNullable: true }),
    displayOrder: new FormControl(0, {
      nonNullable: true,
      validators: (control) =>
        Number.isInteger(control.value) ? null : { integer: true },
    }),
    translations: translationForms(),
  });
  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.id = params.get("id");
        this.load();
        this.loadParents();
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
      .getCategory(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (category) => {
          this.accept(category);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set("error");
        },
      });
  }
  loadParents(): void {
    this.parentRequest?.unsubscribe();
    this.parentLoading.set(true);
    this.parentError.set(false);
    this.parentRequest = this.api
      .allCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          this.parents.set(categoryParentOptions(categories, this.id));
          this.parentLoading.set(false);
        },
        error: () => {
          this.parentLoading.set(false);
          this.parentError.set(true);
        },
      });
  }
  parentName(category: AdminCategory): string {
    return `${category.translations.find((value) => value.locale === this.i18n.locale().toUpperCase())?.name ?? category.translations[0]?.name ?? category.code} (${category.code})${category.published ? "" : " — " + this.i18n.translate("draft")}`;
  }
  draftTranslations() {
    return translationPayload(
      this.form.controls.translations,
      this.original?.translations,
      true,
    );
  }
  submit(): void {
    this.form.markAllAsTouched();
    if (
      this.form.invalid ||
      this.saving() ||
      this.loading() ||
      this.parentLoading() ||
      this.parentError() ||
      this.error() === "error"
    )
      return;
    const values = this.form.getRawValue();
    const input: AdminCategoryInput = {
      ...values,
      parentId: values.parentId || null,
      translations: this.draftTranslations(),
    };
    this.saving.set(true);
    this.error.set(null);
    this.saved.set(false);
    const create = !this.id;
    const request = this.id
      ? this.api.updateCategory(this.id, input)
      : this.api.createCategory(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (category) => {
        this.accept(category);
        this.saving.set(false);
        this.saved.set(true);
        if (create)
          void this.router.navigate(["/admin/categories", category.id], {
            replaceUrl: true,
            queryParamsHandling: "preserve",
          });
      },
      error: (error) => {
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
  private accept(category: AdminCategory): void {
    this.original = category;
    this.form.setControl(
      "translations",
      translationForms(category.translations),
    );
    this.form.patchValue({
      code: category.code,
      slug: category.slug,
      parentId: category.parentId ?? "",
      published: category.published ?? true,
      displayOrder: category.displayOrder ?? 0,
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
