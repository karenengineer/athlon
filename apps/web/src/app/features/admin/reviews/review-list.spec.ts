import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { AdminReviewList } from "../shared/admin-api.types";
import { ReviewList } from "./review-list";

const page = (status: "PENDING" | "APPROVED"): AdminReviewList => ({
  items: [
    {
      id: "r1",
      authorName: "Aram",
      rating: 4,
      body: "Good value.",
      locale: "hy",
      status,
      moderatedAt: null,
      createdAt: "2026-11-20T10:00:00.000Z",
      product: { slug: "whey", name: "Շիճուկ" },
    },
  ],
  meta: { page: 1, pageSize: 24, total: 1, totalPages: 1, pending: 1 },
});

describe("Admin ReviewList", () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewList],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function list(status: string | null) {
    return http.expectOne(
      (request) =>
        request.url === "/api/v1/admin/reviews" &&
        request.params.get("status") === status,
    );
  }

  it("loads pending reviews first and approves one", () => {
    const fixture = TestBed.createComponent(ReviewList);
    fixture.detectChanges();
    list("PENDING").flush(page("PENDING"));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain("Good value.");
    expect(element.textContent).toContain("Շիճուկ");
    (element.querySelector("[data-approve]") as HTMLButtonElement).click();
    const patch = http.expectOne("/api/v1/admin/reviews/r1");
    expect(patch.request.method).toBe("PATCH");
    expect(patch.request.body).toEqual({ status: "APPROVED" });
    patch.flush({ id: "r1", status: "APPROVED" });
    list("PENDING").flush({ ...page("PENDING"), items: [] });
    fixture.detectChanges();
    expect(element.querySelector("[data-approve]")).toBeNull();
  });

  it("filters by status and hides the approve action on approved reviews", () => {
    const fixture = TestBed.createComponent(ReviewList);
    fixture.detectChanges();
    list("PENDING").flush(page("PENDING"));
    fixture.componentInstance.filter("APPROVED");
    list("APPROVED").flush(page("APPROVED"));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector("[data-approve]")).toBeNull();
    expect(element.querySelector("[data-reject]")).not.toBeNull();
  });
});
