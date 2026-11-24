import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
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
      createdAt: "2026-11-20T10:00:00.000Z",
    },
    {
      id: "r2",
      authorName: "Olga",
      rating: 4,
      body: "Good value.",
      locale: "ru",
      createdAt: "2026-11-19T10:00:00.000Z",
    },
  ],
};

describe("ProductReviews", () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductReviews],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(I18nService).setLocale("en");
  });

  afterEach(() => http.verify());

  function render(reviews: ProductReviewsData | null = data) {
    const fixture = TestBed.createComponent(ProductReviews);
    fixture.componentRef.setInput("slug", "whey");
    fixture.componentRef.setInput("reviews", reviews);
    fixture.detectChanges();
    return fixture;
  }

  it("shows the summary and approved reviews with their language", () => {
    const element: HTMLElement = render().nativeElement;
    expect(
      element.querySelector("[data-testid=review-summary]")?.textContent,
    ).toContain("2 reviews");
    const items = element.querySelectorAll(".review-list li");
    expect(items).toHaveLength(2);
    expect(items[1].getAttribute("lang")).toBe("ru");
    expect(items[0].textContent).toContain("Great taste.");
  });

  it("shows an empty state without reviews", () => {
    const element: HTMLElement = render({
      summary: { count: 0, average: null },
      items: [],
    }).nativeElement;
    expect(element.querySelector(".empty")?.textContent).toContain(
      "No reviews yet",
    );
    expect(element.querySelector(".review-list")).toBeNull();
  });

  it("does not submit an invalid review", () => {
    const fixture = render();
    fixture.componentInstance.form.patchValue({ authorName: "A", body: "x" });
    fixture.componentInstance.submit();
    http.expectNone(() => true);
  });

  it("submits a trimmed review and thanks the visitor", () => {
    const fixture = render();
    fixture.componentInstance.form.patchValue({
      authorName: "  Aram ",
      rating: 4,
      body: "  Mixes well, tastes great.  ",
    });
    fixture.componentInstance.submit();
    const request = http.expectOne("/api/v1/products/whey/reviews");
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({
      authorName: "Aram",
      rating: 4,
      body: "Mixes well, tastes great.",
      locale: "en",
    });
    request.flush(
      { status: "PENDING" },
      { status: 202, statusText: "Accepted" },
    );
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector("[role=status]")
        ?.textContent,
    ).toContain("after moderation");
  });

  it("explains the rate limit", () => {
    const fixture = render();
    fixture.componentInstance.form.patchValue({
      authorName: "Aram",
      body: "Mixes well, tastes great.",
    });
    fixture.componentInstance.submit();
    http
      .expectOne("/api/v1/products/whey/reviews")
      .flush(null, { status: 429, statusText: "Too Many Requests" });
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector("[role=alert]")
        ?.textContent,
    ).toContain("Too many attempts");
  });
});
