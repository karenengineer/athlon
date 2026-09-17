import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { forkJoin, Subscription } from "rxjs";
import { ProductImages } from "../media/product-images";
import {
  AdminBrand,
  AdminCategory,
  AdminImage,
  AdminProductWrite,
} from "../shared/admin-api.types";
import { AdminCatalogService } from "../shared/admin-catalog.service";
import { AdminDirtyForm } from "../shared/admin-dirty-form.guard";
import { AdminCopyKey, AdminI18nService } from "../shared/admin-i18n.service";
import { translationForms } from "../shared/catalog-form";
import { TranslationTabs } from "../shared/translation-tabs";
import { availabilities, productForm, productPayload } from "./product-form";
import { ProductPreview } from "./product-preview";

@Component({
  selector: "app-admin-product-editor",
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslationTabs,
    ProductPreview,
    ProductImages,
  ],
  templateUrl: "./product-editor.html",
  styleUrl: "../shared/catalog.scss",
})
export class ProductEditor implements AdminDirtyForm {
  readonly i18n = inject(AdminI18nService);
  private readonly api = inject(AdminCatalogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild(ProductImages) private imageManager?: ProductImages;
  readonly form = productForm();
  readonly availabilities = availabilities;
  readonly loading = signal(false);
  readonly optionsLoading = signal(true);
  readonly optionsError = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly preview = signal(false);
  readonly error = signal<AdminCopyKey | null>(null);
  readonly categories = signal<AdminCategory[]>([]);
  readonly brands = signal<AdminBrand[]>([]);
  readonly images = signal<AdminImage[]>([]);
  readonly persisted = signal<AdminProductWrite | null>(null);
  id: string | null = null;
  private baseline = "";
  private generation = 0;
  private detailRequest?: Subscription;
  private optionsRequest?: Subscription;
  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.generation++;
        this.id = params.get("id");
        this.persisted.set(null);
        this.images.set([]);
        this.baseline = "";
        this.saving.set(false);
        this.preview.set(false);
        this.form.reset(productForm().getRawValue());
        this.form.setControl("translations", translationForms([], true));
        this.load();
        this.loadOptions();
      });
  }
  load(): void {
    this.detailRequest?.unsubscribe();
    this.error.set(null);
    this.saved.set(false);
    const generation = this.generation;
    if (!this.id) {
      this.loading.set(false);
      this.baseline = JSON.stringify(this.form.getRawValue());
      return;
    }
    this.loading.set(true);
    this.detailRequest = this.api
      .getProduct(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          if (generation !== this.generation) return;
          this.accept(product);
          this.images.set(
            [...product.images].sort(
              (a, b) => a.position - b.position || a.id.localeCompare(b.id),
            ),
          );
          this.loading.set(false);
        },
        error: () => {
          if (generation !== this.generation) return;
          this.loading.set(false);
          this.error.set("error");
        },
      });
  }
  loadOptions(): void {
    this.optionsRequest?.unsubscribe();
    this.optionsLoading.set(true);
    this.optionsError.set(false);
    const generation = this.generation;
    this.optionsRequest = forkJoin({
      categories: this.api.allCategories(),
      brands: this.api.allBrands(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ categories, brands }) => {
          if (generation !== this.generation) return;
          this.categories.set(categories);
          this.brands.set(brands);
          this.optionsLoading.set(false);
        },
        error: () => {
          if (generation !== this.generation) return;
          this.optionsLoading.set(false);
          this.optionsError.set(true);
        },
      });
  }
  optionName(item: AdminCategory | AdminBrand): string {
    return (
      (item.translations.find(
        (value) => value.locale === this.i18n.locale().toUpperCase(),
      )?.name ??
        item.translations[0]?.name ??
        ("name" in item ? item.name : item.code)) +
      (item.published ? "" : " — " + this.i18n.translate("draft"))
    );
  }
  draft() {
    return productPayload(this.form, this.persisted()?.translations);
  }
  mediaBusy(): boolean {
    return this.imageManager?.busy() ?? false;
  }
  submit(): void {
    this.form.markAllAsTouched();
    if (
      this.form.invalid ||
      this.loading() ||
      this.saving() ||
      this.optionsLoading() ||
      this.optionsError() ||
      this.error() === "error" ||
      this.imageManager?.busy()
    )
      return;
    const input = this.draft();
    const generation = this.generation;
    const editingId = this.id;
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    const request = editingId
      ? this.api.updateProduct(editingId, input)
      : this.api.createProduct(input);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (product) => {
        if (generation !== this.generation) return;
        this.accept(product);
        this.saving.set(false);
        this.saved.set(true);
        if (!editingId)
          void this.router.navigate(["/admin/products", product.id, "edit"], {
            replaceUrl: true,
            queryParamsHandling: "preserve",
          });
      },
      error: (error) => {
        if (generation !== this.generation) return;
        this.saving.set(false);
        this.error.set(
          error.status === 400
            ? "serverValidation"
            : error.status === 409
              ? "productDuplicate"
              : "saveError",
        );
      },
    });
  }
  private accept(product: AdminProductWrite): void {
    this.persisted.set(product);
    this.form.setControl(
      "translations",
      translationForms(product.translations, true),
    );
    this.form.patchValue({
      sku: product.sku,
      slug: product.slug,
      categoryId: product.categoryId,
      brandId: product.brandId ?? "",
      price: product.price === null ? null : Number(product.price),
      availability: product.availability,
      featured: product.featured,
      isNew: product.isNew,
      published: product.published,
      displayOrder: product.displayOrder,
      characteristics: JSON.stringify(product.characteristics, null, 2),
    });
    this.form.markAsPristine();
    this.baseline = JSON.stringify(this.form.getRawValue());
  }
  hasUnsavedChanges(): boolean {
    return (
      (this.baseline !== "" &&
        JSON.stringify(this.form.getRawValue()) !== this.baseline) ||
      !!this.imageManager?.hasUnsavedChanges()
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
