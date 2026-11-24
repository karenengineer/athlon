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

export interface ProductPreviewVideo {
  url: string;
  mobileUrl: string;
  mimeType: "video/mp4";
  durationSeconds: number;
  sizeBytes: number;
  mobileSizeBytes: number;
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
  previewVideo?: ProductPreviewVideo | null;
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
  retryAllowed?: true;
}

export type CheckoutStatusResponse =
  | PaymentStatusResponse
  | { paymentStatus: "NOT_FOUND" };

export interface ProductReview {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  locale: "hy" | "ru" | "en";
  /** Written through a delivered order's review link. */
  verified: boolean;
  createdAt: string;
}

export interface ProductReviews {
  /** Approved reviews only; average is null when there are none. */
  summary: { count: number; average: number | null };
  items: ProductReview[];
}

/** A review sent through the buyer's personal link after delivery. */
export interface InvitedReviewRequest {
  productId: string;
  authorName: string;
  rating: number;
  body: string;
  locale: string;
}

export interface ReviewInvitationItem {
  productId: string;
  /** Null when the product is no longer published. */
  slug: string | null;
  name: string;
  imageUrl: string | null;
  reviewed: boolean;
}

export interface ReviewInvitation {
  authorName: string;
  locale: "hy" | "ru" | "en";
  expiresAt: string;
  items: ReviewInvitationItem[];
}
