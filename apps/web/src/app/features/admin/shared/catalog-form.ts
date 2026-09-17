import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import {
  AdminCategory,
  AdminProductTranslation,
  AdminTranslationLocale,
} from "./admin-api.types";

export const translationLocales: readonly AdminTranslationLocale[] = [
  "HY",
  "RU",
  "EN",
];
export type TranslationForm = FormGroup<{
  locale: FormControl<AdminTranslationLocale>;
  name: FormControl<string>;
  description: FormControl<string>;
  seoTitle: FormControl<string>;
  seoDescription: FormControl<string>;
  shortDescription: FormControl<string>;
}>;
export const slugValidators = [
  Validators.required,
  Validators.maxLength(160),
  Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
];
export function translationForms(
  existing: readonly AdminProductTranslation[] = [],
  product = false,
): FormArray<TranslationForm> {
  return new FormArray(
    translationLocales.map((locale) => {
      const original = existing.find((item) => item.locale === locale);
      return new FormGroup(
        {
          locale: new FormControl(locale, { nonNullable: true }),
          name: new FormControl(original?.name ?? "", {
            nonNullable: true,
            validators: Validators.maxLength(product ? 220 : 180),
          }),
          description: new FormControl(original?.description ?? "", {
            nonNullable: true,
          }),
          shortDescription: new FormControl(original?.shortDescription ?? "", {
            nonNullable: true,
            validators: Validators.maxLength(500),
          }),
          seoTitle: new FormControl(original?.seoTitle ?? "", {
            nonNullable: true,
            validators: Validators.maxLength(180),
          }),
          seoDescription: new FormControl(original?.seoDescription ?? "", {
            nonNullable: true,
            validators: Validators.maxLength(320),
          }),
        },
        {
          validators: (control: AbstractControl): ValidationErrors | null => {
            const value = control.value;
            const active =
              !!original ||
              [
                value.name,
                value.description,
                value.seoTitle,
                value.seoDescription,
                ...(product ? [value.shortDescription] : []),
              ].some(Boolean);
            return active && !/\S/.test(value.name)
              ? { nameRequired: true }
              : null;
          },
        },
      );
    }),
    {
      validators: (control: AbstractControl): ValidationErrors | null =>
        control.value.some((item: { name: string }) => /\S/.test(item.name))
          ? null
          : { translationRequired: true },
    },
  );
}
export function translationPayload(
  forms: FormArray<TranslationForm>,
  existing: readonly AdminProductTranslation[] = [],
  seo = false,
  product = false,
): AdminProductTranslation[] {
  return forms.controls.flatMap((group) => {
    const value = group.getRawValue();
    const original = existing.find((item) => item.locale === value.locale);
    if (
      !original &&
      ![
        value.name,
        value.description,
        value.seoTitle,
        value.seoDescription,
        ...(product ? [value.shortDescription] : []),
      ].some(Boolean)
    )
      return [];
    const result: AdminProductTranslation = {
      locale: value.locale,
      name: value.name,
    };
    const keys: (keyof Pick<
      AdminProductTranslation,
      "description" | "seoTitle" | "seoDescription" | "shortDescription"
    >)[] = seo
      ? ["description", "seoTitle", "seoDescription"]
      : ["description"];
    if (product) keys.push("shortDescription");
    for (const key of keys) {
      if (original && value[key] === (original[key] ?? "")) {
        if (original[key] !== undefined) result[key] = original[key];
      } else if (value[key] !== "" || original?.[key] !== undefined)
        result[key] = value[key];
    }
    return [result];
  });
}
export function categoryParentOptions(
  categories: readonly AdminCategory[],
  editingId: string | null,
): AdminCategory[] {
  const excluded = new Set(editingId ? [editingId] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories)
      if (
        category.parentId &&
        excluded.has(category.parentId) &&
        !excluded.has(category.id)
      ) {
        excluded.add(category.id);
        changed = true;
      }
  }
  return categories.filter((category) => !excluded.has(category.id));
}
