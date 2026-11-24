import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from "@angular/router";
import { of } from "rxjs";
import { ReviewInvitation } from "../../core/api/catalog.models";
import { ReviewInvitationPage } from "./review-invitation-page";

const token = "A".repeat(43);
const productId = "b7c1e2d3-4a5b-4c6d-8e7f-901234567890";
const invitation: ReviewInvitation = {
  authorName: "Aram",
  locale: "hy",
  expiresAt: "2027-01-24T10:00:00.000Z",
  items: [
    {
      productId,
      slug: "whey",
      name: "Whey",
      imageUrl: "/api/v1/media/w.webp",
      reviewed: false,
    },
    {
      productId: "c8d2f3e4-5b6c-4d7e-9f80-a12345678901",
      slug: null,
      name: "Creatine",
      imageUrl: null,
      reviewed: true,
    },
  ],
};

describe("ReviewInvitationPage", () => {
  let http: HttpTestingController;

  function render(routeToken = token) {
    TestBed.configureTestingModule({
      imports: [ReviewInvitationPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ token: routeToken })),
            parent: { paramMap: of(convertToParamMap({ locale: "en" })) },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ReviewInvitationPage);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  const describeRequest = () =>
    http.expectOne(
      (request) =>
        request.url === `/api/v1/public/review-invitations/${token}` &&
        request.params.get("locale") === "en",
    );

  it("lists bought products, marks reviewed ones and sends a review", () => {
    const fixture = render();
    describeRequest().flush(invitation);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const items = element.querySelectorAll("[data-testid=review-item]");
    expect(items).toHaveLength(2);
    expect(items[1].textContent).toContain("Review already sent");
    expect(items[1].querySelector("form")).toBeNull();
    expect(
      (element.querySelector("#review-author") as HTMLInputElement).value,
    ).toBe("Aram");

    const page = fixture.componentInstance;
    page.patch(invitation.items[0]!, {
      rating: 4,
      body: "  Mixes well, tastes great.  ",
    });
    (items[0].querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit"),
    );
    const post = http.expectOne(
      `/api/v1/public/review-invitations/${token}/reviews`,
    );
    expect(post.request.body).toEqual({
      productId,
      authorName: "Aram",
      rating: 4,
      body: "Mixes well, tastes great.",
      locale: "en",
    });
    post.flush({ status: "PENDING" }, { status: 202, statusText: "Accepted" });
    fixture.detectChanges();
    expect(element.textContent).toContain("after moderation");
    expect(page.allDone()).toBe(true);
  });

  it("does not send a too-short review", () => {
    const fixture = render();
    describeRequest().flush(invitation);
    fixture.detectChanges();
    fixture.componentInstance.submit(invitation.items[0]!, new Event("submit"));
    http.expectNone(`/api/v1/public/review-invitations/${token}/reviews`);
  });

  it("explains an expired link", () => {
    const fixture = render();
    describeRequest().flush(null, { status: 410, statusText: "Gone" });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("expired");
  });

  it("rejects a malformed link without calling the API", () => {
    const fixture = render("not-a-token");
    fixture.detectChanges();
    http.expectNone(() => true);
    expect(fixture.componentInstance.state()).toBe("NOT_FOUND");
  });
});
