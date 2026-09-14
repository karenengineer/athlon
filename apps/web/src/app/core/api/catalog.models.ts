export interface Category {
  id: string;
  code: string;
  slug: string;
  name: string;
  description: string | null;
  displayOrder: number;
  children: Omit<Category, "children">[];
}

export type Availability =
  | "IN_STOCK"
  | "OUT_OF_STOCK"
  | "PREORDER"
  | "ON_REQUEST";

export interface ProductImage {
  id: string;
  thumbnailUrl: string;
  cardUrl: string;
  detailUrl: string;
  alt: string;
  primary: boolean;
}

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description?: string | null;
  price: string | null;
  currency: "AMD";
  availability: Availability;
  featured: boolean;
  isNew: boolean;
  characteristics?: Record<string, unknown>;
  category: { slug: string; name: string };
  brand: { slug: string; name: string } | null;
  images: ProductImage[];
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
}

export interface ProductPageResponse {
  items: Product[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ProductQuery {
  locale: string;
  category?: string;
  brand?: string;
  availability?: Availability;
  sort?: "displayOrder" | "priceAsc" | "priceDesc" | "newest";
  page?: number;
  pageSize?: number;
  q?: string;
}
