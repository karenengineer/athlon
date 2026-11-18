import {
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Injectable,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  signal,
  SimpleChanges,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ProductPreviewVideo } from "../../../core/api/catalog.models";
import { AdminCatalogService } from "../shared/admin-catalog.service";
import { AdminCopyKey, AdminI18nService } from "../shared/admin-i18n.service";
import { DeleteConfirmation } from "../shared/delete-confirmation";

@Injectable({ providedIn: "root" })
export class PendingProductVideo {
  private pending?: { productId: string; file: File };

  save(productId: string, file: File): void {
    this.pending = { productId, file };
  }

  take(productId: string | null): File | null {
    if (this.pending?.productId !== productId) return null;
    const file = this.pending.file;
    this.pending = undefined;
    return file;
  }
}

@Component({
  selector: "app-admin-product-video",
  imports: [DeleteConfirmation],
  templateUrl: "./product-video.html",
  styleUrls: ["../shared/catalog.scss", "./product-video.scss"],
})
export class ProductVideo implements OnChanges, OnDestroy {
  readonly i18n = inject(AdminI18nService);
  private readonly api = inject(AdminCatalogService);
  private readonly pending = inject(PendingProductVideo);
  private readonly destroyRef = inject(DestroyRef);
  @Input() productId: string | null = null;
  @Input() video: ProductPreviewVideo | null = null;
  @Input() coverUrl: string | null = null;
  @Input() disabled = false;
  @Output() readonly videoChange =
    new EventEmitter<ProductPreviewVideo | null>();
  readonly file = signal<File | null>(null);
  readonly localUrl = signal<string | null>(null);
  readonly durationValid = signal(false);
  readonly busy = signal(false);
  readonly error = signal<AdminCopyKey | null>(null);
  readonly confirmingDelete = signal(false);
  private generation = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes["productId"]) return;
    this.generation++;
    this.busy.set(false);
    this.error.set(null);
    this.confirmingDelete.set(false);
    this.clearSelection();
    const pending = this.pending.take(this.productId);
    if (pending) this.select(pending);
  }

  chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = "";
    if (this.busy() || this.disabled) return;
    this.select(file);
  }

  private select(file: File | null): void {
    this.clearSelection();
    this.error.set(null);
    if (!file) return;
    if (
      !["video/mp4", "video/webm"].includes(file.type) ||
      file.size === 0 ||
      file.size > 20 * 1024 * 1024
    ) {
      this.error.set("videoValidation");
      return;
    }
    this.file.set(file);
    this.localUrl.set(URL.createObjectURL(file));
  }

  metadata(event: Event): void {
    const video = event.target as HTMLVideoElement;
    const valid =
      Number.isFinite(video.duration) &&
      video.duration > 0 &&
      video.duration <= 15;
    this.durationValid.set(valid);
    this.error.set(valid ? null : "videoValidation");
  }

  previewError(): void {
    this.durationValid.set(false);
    this.error.set("videoValidation");
  }

  clearSelection(): void {
    const url = this.localUrl();
    if (url) URL.revokeObjectURL(url);
    this.localUrl.set(null);
    this.file.set(null);
    this.durationValid.set(false);
  }

  preserveForCreatedProduct(productId: string): void {
    const file = this.file();
    if (file) this.pending.save(productId, file);
    this.clearSelection();
  }

  upload(): void {
    const id = this.productId;
    const file = this.file();
    if (
      !id ||
      !file ||
      !this.coverUrl ||
      !this.durationValid() ||
      this.busy() ||
      this.disabled
    )
      return;
    this.busy.set(true);
    this.error.set(null);
    const generation = this.generation;
    this.api
      .uploadVideo(id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (video) => {
          if (generation !== this.generation) return;
          this.busy.set(false);
          this.clearSelection();
          this.videoChange.emit(video);
        },
        error: (error) => {
          if (generation !== this.generation) return;
          this.busy.set(false);
          this.error.set(
            error.status === 400 || error.status === 413
              ? "videoValidation"
              : "videoUploadError",
          );
        },
      });
  }

  remove(confirmed: boolean): void {
    this.confirmingDelete.set(false);
    if (!confirmed || !this.productId || this.busy() || this.disabled) return;
    const generation = this.generation;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .deleteVideo(this.productId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (generation !== this.generation) return;
          this.busy.set(false);
          this.videoChange.emit(null);
        },
        error: () => {
          if (generation !== this.generation) return;
          this.busy.set(false);
          this.error.set("videoRemoveError");
        },
      });
  }

  hasUnsavedChanges(): boolean {
    return !!this.file() || this.busy();
  }

  ngOnDestroy(): void {
    this.generation++;
    this.clearSelection();
  }
}
