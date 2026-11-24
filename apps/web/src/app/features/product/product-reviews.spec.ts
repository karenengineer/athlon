import { TestBed } from "@angular/core/testing";
import { ProductReviews as ProductReviewsData } from "../../core/api/catalog.models";
import { I18nService } from "../../core/i18n/i18n.service";
import { ProductReviews } from "./product-reviews";

const data: ProductReviewsData = {
  summary: { count: 2, average: 4.5 },
  items: [
    {
      id: "r1",
      authorName: "Aram",
      rating: 5,
      body: "Great taste.",
      locale: "hy",
      verified: true,
      createdAt: "2026-11-20T10:00:00.000Z",
    },
    {
      id: "r2",
      authorName: "Olga",
      rating: 4,
      body: "Good value.",
      locale: "ru",
      verified: false,
      createdAt: "2026-11-19T10:00:00.000Z",
    },
  ],
};

describe("ProductReviews", () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductReviews],
    }).compileComponents();
    TestBed.inject(I18nService).setLocale("en");
  });

  function render(reviews: ProductReviewsData | null = data) {
    const fixture = TestBed.createComponent(ProductReviews);
    fixture.componentRef.setInput("reviews", reviews);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it("shows the summary and approved reviews with their language", () => {
    const element = render();
    expect(
      element.querySelector("[data-testid=review-summary]")?.textContent,
    ).toContain("2 reviews");
    const items = element.querySelectorAll(".review-list li");
    expect(items).toHaveLength(2);
    expect(items[1].getAttribute("lang")).toBe("ru");
    expect(items[0].textContent).toContain("Great taste.");
  });

  it("marks reviews from verified buyers", () => {
    const items = render().querySelectorAll(".review-list li");
    expect(items[0].querySelector(".verified")?.textContent).toContain(
      "Verified purchase",
    );
    expect(items[1].querySelector(".verified")).toBeNull();
  });

  it("has no open review form and explains who can review", () => {
    const element = render({ summary: { count: 0, average: null }, items: [] });
    expect(element.querySelector("form")).toBeNull();
    expect(element.querySelector("textarea")).toBeNull();
    expect(element.querySelector(".empty")?.textContent).toContain(
      "No reviews yet",
    );
    expect(
      element.querySelector("[data-testid=reviews-only-buyers]")?.textContent,
    ).toContain("Only customers who bought this product");
  });
});
