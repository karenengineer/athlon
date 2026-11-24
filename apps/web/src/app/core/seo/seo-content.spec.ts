import { Product, ProductReviews } from "../api/catalog.models";
import { productSchema } from "./seo-content";

const product = {
  id: "p1",
  sku: "ON-WHEY",
  slug: "on-whey",
  name: "ON Whey",
  shortDescription: "Whey protein",
  description: null,
  price: "29000",
  currency: "AMD",
  availability: "IN_STOCK",
  featured: false,
  isNew: false,
  characteristics: {},
  category: { slug: "protein", name: "Protein" },
  brand: { slug: "on", name: "Optimum Nutrition" },
  previewVideo: null,
  images: [],
} as unknown as Product;

const reviews: ProductReviews = {
  summary: { count: 7, average: 4.6 },
  items: Array.from({ length: 7 }, (_, index) => ({
    id: `r${index}`,
    authorName: `Buyer ${index}`,
    rating: 5,
    body: "Great",
    locale: "hy" as const,
    verified: true,
    createdAt: "2026-11-20T10:00:00.000Z",
  })),
};

describe("productSchema ratings", () => {
  it("adds AggregateRating and at most five reviews from approved reviews", () => {
    const schema = productSchema(product, "hy", reviews);
    expect(schema["aggregateRating"]).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.6,
      reviewCount: 7,
      bestRating: 5,
      worstRating: 1,
    });
    const items = schema["review"] as Record<string, unknown>[];
    expect(items).toHaveLength(5);
    expect(items[0]).toMatchObject({
      "@type": "Review",
      author: { "@type": "Person", name: "Buyer 0" },
      datePublished: "2026-11-20",
      reviewRating: { ratingValue: 5 },
    });
  });

  it("omits ratings when there are no approved reviews", () => {
    for (const value of [
      undefined,
      null,
      { summary: { count: 0, average: null }, items: [] },
    ]) {
      const schema = productSchema(product, "hy", value);
      expect(schema["aggregateRating"]).toBeUndefined();
      expect(schema["review"]).toBeUndefined();
    }
  });
});
