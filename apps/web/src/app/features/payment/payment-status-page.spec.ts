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
import { BehaviorSubject } from "rxjs";
import { BasketService } from "../../core/basket/basket.service";
import {
  PaymentStatusPage,
  POLL_INTERVAL_MS,
  toView,
} from "./payment-status-page";

const reference = "ATH-1234ABCD1234ABCD1234ABCD1234ABCD";
const statusUrl = `/api/v1/public/orders/${reference}/payment-status`;

describe("PaymentStatusPage", () => {
  let http: HttpTestingController;

  function setup(ref = reference) {
    TestBed.configureTestingModule({
      imports: [PaymentStatusPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: new BehaviorSubject(
              convertToParamMap({ reference: ref }),
            ),
            parent: {
              paramMap: new BehaviorSubject(
                convertToParamMap({ locale: "en" }),
              ),
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(BasketService).add(
      {
        id: "product-id",
        sku: "SKU",
        slug: "product",
        name: "Product",
        price: "13000",
        currency: "AMD",
        availability: "IN_STOCK",
        featured: false,
        isNew: false,
        category: { slug: "protein", name: "Protein" },
        brand: null,
        images: [],
        shortDescription: null,
      },
      1,
    );
    const fixture = TestBed.createComponent(PaymentStatusPage);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => {
    try {
      http.verify();
    } finally {
      vi.useRealTimers();
      TestBed.resetTestingModule();
      localStorage.clear();
      sessionStorage.clear();
    }
  });

  it("shows success and clears the basket only after the server says PAID", () => {
    vi.useFakeTimers();
    const fixture = setup();
    vi.advanceTimersByTime(0);
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(1);
    http
      .expectOne((req) => req.url.endsWith(statusUrl))
      .flush({
        orderReference: reference,
        paymentStatus: "PAID",
        locale: "EN",
      });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Payment complete");
    expect(fixture.nativeElement.textContent).toContain(reference);
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(0);
  });

  it("keeps the basket and offers a retry when the payment failed", () => {
    vi.useFakeTimers();
    const fixture = setup();
    vi.advanceTimersByTime(0);
    http
      .expectOne((req) => req.url.endsWith(statusUrl))
      .flush({
        orderReference: reference,
        paymentStatus: "FAILED",
        locale: "EN",
      });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "Payment not completed",
    );
    expect(fixture.nativeElement.textContent).toContain("Back to basket");
    expect(TestBed.inject(BasketService).totalQuantity()).toBe(1);
  });

  it("polls while the bank has not decided", () => {
    vi.useFakeTimers();
    const fixture = setup();
    vi.advanceTimersByTime(0);
    http
      .expectOne((req) => req.url.endsWith(statusUrl))
      .flush({
        orderReference: reference,
        paymentStatus: "PENDING",
        locale: "EN",
      });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "Payment still processing",
    );
    vi.advanceTimersByTime(POLL_INTERVAL_MS);
    http
      .expectOne((req) => req.url.endsWith(statusUrl))
      .flush({
        orderReference: reference,
        paymentStatus: "PAID",
        locale: "EN",
      });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Payment complete");
    vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
    http.expectNone((req) => req.url.endsWith(statusUrl));
  });

  it("never calls the API for a malformed reference", () => {
    const fixture = setup("../admin");
    fixture.detectChanges();
    http.expectNone(() => true);
    expect(fixture.nativeElement.textContent).toContain(
      "could not check the payment status",
    );
  });

  it("maps every server status to a view", () => {
    expect(toView("PAID")).toBe("PAID");
    expect(toView("EXPIRED")).toBe("FAILED");
    expect(toView("CANCELLED")).toBe("FAILED");
    expect(toView("PENDING")).toBe("PENDING");
    expect(toView("SOMETHING")).toBe("ERROR");
  });
});
