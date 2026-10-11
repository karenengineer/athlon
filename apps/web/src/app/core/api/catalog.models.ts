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
  minPrice?: number;
  maxPrice?: number;
  sort?: "displayOrder" | "priceAsc" | "priceDesc" | "newest";
  page?: number;
  pageSize?: number;
  q?: string;
}

export interface PublicSettings {
  cardPaymentsEnabled?: boolean;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
}

export interface CreateOrderRequest {
  locale: "hy" | "ru" | "en";
  paymentMethod: "CARD" | "CASH_ON_DELIVERY";
  customer: { name: string; email: string; phone: string; address: string };
  items: {
    productId: string;
    quantity: number;
    expectedUnitPrice: string | null;
  }[];
}

export interface CashOnDeliveryOrderResponse {
  kind: "COD_ACCEPTED";
  accepted: true;
  orderReference: string;
}

export interface CardPaymentPendingResponse {
  kind: "CARD_PAYMENT_PENDING";
  accepted: true;
  orderReference: string;
  paymentStatus: "PENDING";
  checkoutUrl: string;
}

export type CreateOrderResponse =
  | CashOnDeliveryOrderResponse
  | CardPaymentPendingResponse;

export interface PaymentStatusResponse {
  orderReference: string;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED";
  locale: "HY" | "RU" | "EN";
}
