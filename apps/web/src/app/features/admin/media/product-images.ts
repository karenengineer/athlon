import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Observable } from "rxjs";
import { AdminImage, AdminImageInput } from "../shared/admin-api.types";
import { AdminCatalogService } from "../shared/admin-catalog.service";
import { AdminCopyKey, AdminI18nService } from "../shared/admin-i18n.service";
import { DeleteConfirmation } from "../shared/delete-confirmation";
import { productImageUrl } from "../products/product-preview";

function altForm(image?: AdminImage) {
  const alt = (locale: string) =>
    image?.translations.find((value) => value.locale === locale)?.altText ?? "";
  return new FormGroup({
    altRu: new FormControl(alt("RU"), {
      nonNullable: true,
      validators: image
        ? Validators.maxLength(250)
        : [
            Validators.required,
            Validators.pattern(/\S/),
            Validators.maxLength(250),
          ],
    }),
    altHy: new FormControl(alt("HY"), {
      nonNullable: true,
      validators: Validators.maxLength(250),
    }),
    altEn: new FormControl(alt("EN"), {
      nonNullable: true,
      validators: Validators.maxLength(250),
    }),
    primary: new FormControl(image?.primary ?? false, { nonNullable: true }),
  });
}
type AltForm = ReturnType<typeof altForm>;
@Component({
  selector: "app-admin-product-images",
  imports: [ReactiveFormsModule, DeleteConfirmation],
  templateUrl: "./product-images.html",
  styleUrls: ["../shared/catalog.scss", "./product-images.scss"],
})
export class ProductImages implements OnChanges {
  readonly i18n = inject(AdminI18nService);
  private readonly api = inject(AdminCatalogService);
  private readonly destroyRef = inject(DestroyRef);
  @Input() productId: string | null = null;
  @Input() images: AdminImage[] = [];
  @Input() disabled = false;
  @Output() readonly imagesChange = new EventEmitter<AdminImage[]>();
  @ViewChild("fileInput") private fileInput?: ElementRef<HTMLInputElement>;
  readonly uploadForm = altForm();
  readonly forms = new Map<string, AltForm>();
  private readonly baselines = new Map<string, Required<AdminImageInput>>();
  readonly file = signal<File | null>(null);
  readonly busy = signal(false);
  readonly error = signal<AdminCopyKey | null>(null);
  readonly pendingDelete = signal<AdminImage | null>(null);
  readonly imageUrl = productImageUrl;
  private generation = 0;
  ngOnChanges(changes: SimpleChanges): void {
    if (changes["productId"]) {
      this.generation++;
      this.busy.set(false);
      this.error.set(null);
      this.pendingDelete.set(null);
      this.file.set(null);
      this.uploadForm.reset(altForm().getRawValue());
      this.forms.clear();
      this.baselines.clear();
      if (this.fileInput) this.fileInput.nativeElement.value = "";
    }
    if (changes["images"] || changes["productId"]) this.synchronize();
  }
  private synchronize(): void {
    for (const id of this.forms.keys())
      if (!this.images.some((image) => image.id === id)) {
        this.forms.delete(id);
        this.baselines.delete(id);
      }
    for (const image of this.images) {
      const canonical = altForm(image).getRawValue();
      let form = this.forms.get(image.id);
      if (!form) {
        form = altForm(image);
        this.forms.set(image.id, form);
      } else {
        const baseline = this.baselines.get(image.id)!;
        for (const key of ["altRu", "altHy", "altEn"] as const)
          if (form.controls[key].value === baseline[key])
            form.controls[key].setValue(canonical[key]);
        if (form.controls.primary.value === baseline.primary)
          form.controls.primary.setValue(canonical.primary);
      }
      this.baselines.set(image.id, canonical);
    }
  }
  alt(image: AdminImage): string {
    return (
      image.translations.find(
        (value) => value.locale === this.i18n.locale().toUpperCase(),
      )?.altText ??
      image.translations[0]?.altText ??
      image.id
    );
  }
  chooseFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.file.set(file);
    this.error.set(null);
    if (file && !this.validFile(file)) this.error.set("imageValidation");
  }
  private validFile(file: File): boolean {
    return (
      ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
      file.size <= 5_242_880 &&
      file.size > 0
    );
  }
  upload(): void {
    this.uploadForm.markAllAsTouched();
    const file = this.file();
    const productId = this.productId;
    if (
      !file ||
      !productId ||
      this.busy() ||
      this.disabled ||
      this.uploadForm.invalid
    )
      return;
    if (!this.validFile(file)) {
      this.error.set("imageValidation");
      return;
    }
    this.run(
      this.api.uploadImage(productId, file, this.uploadForm.getRawValue()),
      (image) => {
        this.emit([
          ...this.images.map((item) =>
            image.primary ? { ...item, primary: false } : item,
          ),
          image,
        ]);
        this.file.set(null);
        this.uploadForm.reset(altForm().getRawValue());
        if (this.fileInput) this.fileInput.nativeElement.value = "";
      },
    );
  }
  save(image: AdminImage): void {
    const form = this.forms.get(image.id)!;
    form.markAllAsTouched();
    if (!this.productId || this.busy() || this.disabled || form.invalid) return;
    this.run(
      this.api.updateImage(this.productId, image.id, form.getRawValue()),
      (saved) => {
        this.forms.delete(image.id);
        this.baselines.delete(image.id);
        this.emit(
          this.images.map((item) =>
            item.id === saved.id
              ? saved
              : saved.primary
                ? { ...item, primary: false }
                : item,
          ),
        );
      },
    );
  }
  move(image: AdminImage, delta: number): void {
    if (!this.productId || this.busy() || this.disabled) return;
    const next = [...this.images];
    const index = next.findIndex((item) => item.id === image.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const ordered = next.map((item, position) => ({ ...item, position }));
    this.run(
      this.api.orderImages(
        this.productId,
        ordered.map(({ id, position }) => ({ id, position })),
      ),
      () => this.emit(ordered),
    );
  }
  confirmDelete(confirmed: boolean): void {
    const image = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!confirmed || !image || !this.productId || this.busy() || this.disabled)
      return;
    this.run(this.api.deleteImage(this.productId, image.id), () =>
      this.emit(this.images.filter((item) => item.id !== image.id)),
    );
  }
  private emit(images: AdminImage[]): void {
    this.images = [...images].sort(
      (a, b) => a.position - b.position || a.id.localeCompare(b.id),
    );
    this.synchronize();
    this.imagesChange.emit(this.images);
  }
  private run<T>(request: Observable<T>, accept: (value: T) => void): void {
    const generation = this.generation;
    this.busy.set(true);
    this.error.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        if (generation !== this.generation) return;
        accept(value);
        this.busy.set(false);
      },
      error: (error) => {
        if (generation !== this.generation) return;
        this.busy.set(false);
        this.error.set(error.status === 400 ? "serverValidation" : "saveError");
      },
    });
  }
  hasUnsavedChanges(): boolean {
    return (
      this.busy() ||
      !!this.file() ||
      JSON.stringify(this.uploadForm.getRawValue()) !==
        JSON.stringify(altForm().getRawValue()) ||
      [...this.forms].some(
        ([id, form]) =>
          JSON.stringify(form.getRawValue()) !==
          JSON.stringify(this.baselines.get(id)),
      )
    );
  }
}
