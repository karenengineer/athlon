export interface AdminUser {
  id: string;
  email: string;
  role: "ADMIN";
}
export type AdminTranslationLocale = "HY" | "RU" | "EN";
export type AdminAvailability =
  | "IN_STOCK"
  | "OUT_OF_STOCK"
  | "PREORDER"
  | "ON_REQUEST";
export interface AdminList<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
export interface AdminListQuery {
  q?: string;
  page?: number;
  pageSize?: number;
  published?: boolean;
  sort?: "order" | "updated" | "name";
}
export interface AdminProductQuery extends Omit<AdminListQuery, "sort"> {
  categoryId?: string;
  brandId?: string;
  availability?: AdminAvailability;
  featured?: boolean;
  isNew?: boolean;
  sort?: AdminListQuery["sort"] | "priceAsc" | "priceDesc";
}
export interface AdminTranslation {
  locale: AdminTranslationLocale;
  name: string;
  description?: string | null;
}
export interface AdminCategoryTranslation extends AdminTranslation {
  seoTitle?: string | null;
  seoDescription?: string | null;
}
export interface AdminProductTranslation extends AdminCategoryTranslation {
  shortDescription?: string | null;
}
export interface AdminCategoryInput {
  code: string;
  slug: string;
  parentId?: string | null;
  published?: boolean;
  displayOrder?: number;
  translations: AdminCategoryTranslation[];
}
export interface AdminBrandInput {
  slug: string;
  name: string;
  logoKey?: string | null;
  published?: boolean;
  translations: AdminTranslation[];
}
export interface AdminProductInput {
  sku: string;
  slug: string;
  categoryId: string;
  brandId?: string | null;
  price?: number | null;
  availability: AdminAvailability;
  characteristics: Record<string, unknown>;
  featured: boolean;
  isNew: boolean;
  published: boolean;
  displayOrder: number;
  translations: AdminProductTranslation[];
}
export interface AdminCategory extends AdminCategoryInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export interface AdminBrand extends AdminBrandInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export interface AdminImage {
  id: string;
  productId: string;
  originalKey: string;
  thumbnailKey: string;
  cardKey: string;
  detailKey: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  position: number;
  primary: boolean;
  translations: { locale: AdminTranslationLocale; altText: string }[];
}
export interface AdminProduct extends Omit<AdminProductInput, "price"> {
  id: string;
  price: string | null;
  currency: string;
  images: AdminImage[];
  createdAt: string;
  updatedAt: string;
}
// Create/PATCH currently return translations, but not the image relation.
export type AdminProductWrite = Omit<AdminProduct, "images">;
export interface AdminImageInput {
  altRu: string;
  altHy?: string;
  altEn?: string;
  primary?: boolean;
}
export interface AdminProductListItem extends Omit<AdminProduct, "images"> {
  images: Omit<AdminImage, "translations">[];
  category: Omit<AdminCategory, "translations">;
  brand: Omit<AdminBrand, "translations"> | null;
}
