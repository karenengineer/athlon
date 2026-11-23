import { DatePipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { Component, computed, inject, input, signal } from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { CatalogApiService } from "../../core/api/catalog-api.service";
import { ProductReviews as ProductReviewsData } from "../../core/api/catalog.models";
import { I18nService } from "../../core/i18n/i18n.service";
import { reviewsCopy } from "./product-reviews-copy";

/** Approved reviews and a moderated review form for one product. */
@Component({
  selector: "app-product-reviews",
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: "./product-reviews.html",
  styleUrl: "./product-reviews.scss",
})
export class ProductReviews {
  readonly slug = input.required<string>();
  readonly reviews = input<ProductReviewsData | null>(null);
  readonly i18n = inject(I18nService);
  private readonly api = inject(CatalogApiService);
  readonly copy = computed(() => reviewsCopy[this.i18n.locale()]);
  readonly ratings = [5, 4, 3, 2, 1] as const;
  readonly status = signal<"idle" | "sending" | "sent" | "error" | "limited">(
    "idle",
  );
  readonly form = new FormGroup({
    authorName: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(80),
      ],
    }),
    rating: new FormControl(5, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(5)],
    }),
    body: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(2000),
      ],
    }),
    website: new FormControl("", { nonNullable: true }),
  });

  starsText(rating: number): string {
    const full = Math.round(rating);
    return "★".repeat(full) + "☆".repeat(5 - full);
  }

  submit(): void {
    if (this.status() === "sending") return;
    this.form.controls.authorName.setValue(
      this.form.controls.authorName.value.trim(),
    );
    this.form.controls.body.setValue(this.form.controls.body.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.status.set("sending");
    this.api
      .submitReview(this.slug(), {
        authorName: value.authorName,
        rating: Number(value.rating),
        body: value.body,
        locale: this.i18n.locale(),
        ...(value.website ? { website: value.website } : {}),
      })
      .subscribe({
        next: () => {
          this.status.set("sent");
          this.form.reset();
        },
        error: (error: unknown) =>
          this.status.set(
            error instanceof HttpErrorResponse && error.status === 429
              ? "limited"
              : "error",
          ),
      });
  }
}
