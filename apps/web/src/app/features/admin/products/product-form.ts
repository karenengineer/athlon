import {
  AbstractControl,
  FormControl,
  FormGroup,
  Validators,
} from "@angular/forms";
import {
  AdminAvailability,
  AdminProductInput,
  AdminProductTranslation,
} from "../shared/admin-api.types";
import { translationForms, translationPayload } from "../shared/catalog-form";

export const availabilities: readonly AdminAvailability[] = [
  "IN_STOCK",
  "OUT_OF_STOCK",
  "PREORDER",
  "ON_REQUEST",
];
export function objectJson(control: AbstractControl) {
  try {
    const value: unknown = JSON.parse(control.value);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? null
      : { objectJson: true };
  } catch {
    return { objectJson: true };
  }
}
export function productForm() {
  return new FormGroup({
    sku: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(100),
        Validators.pattern(/\S/),
      ],
    }),
    slug: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(180),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    }),
    categoryId: new FormControl("", {
      nonNullable: true,
      validators: Validators.required,
    }),
    brandId: new FormControl("", { nonNullable: true }),
    price: new FormControl<number | null>(null, {
      validators: (control) =>
        control.value === null ||
        (typeof control.value === "number" &&
          Number.isFinite(control.value) &&
          control.value >= 0 &&
          control.value <= 9_999_999_999.99 &&
          Math.abs(control.value * 100 - Math.round(control.value * 100)) <
            0.0001)
          ? null
          : { price: true },
    }),
    availability: new FormControl<AdminAvailability>("ON_REQUEST", {
      nonNullable: true,
      validators: (control) =>
        availabilities.includes(control.value) ? null : { availability: true },
    }),
    characteristics: new FormControl("{}", {
      nonNullable: true,
      validators: objectJson,
    }),
    featured: new FormControl(false, { nonNullable: true }),
    isNew: new FormControl(false, { nonNullable: true }),
    published: new FormControl(false, { nonNullable: true }),
    displayOrder: new FormControl(0, {
      nonNullable: true,
      validators: (control) =>
        Number.isInteger(control.value) &&
        control.value >= -2_147_483_648 &&
        control.value <= 2_147_483_647
          ? null
          : { integer: true },
    }),
    translations: translationForms([], true),
  });
}
export function productPayload(
  form: ReturnType<typeof productForm>,
  existing: readonly AdminProductTranslation[] = [],
): AdminProductInput {
  const values = form.getRawValue();
  return {
    ...values,
    brandId: values.brandId || null,
    characteristics: JSON.parse(values.characteristics) as Record<
      string,
      unknown
    >,
    translations: translationPayload(
      form.controls.translations,
      existing,
      true,
      true,
    ),
  };
}
