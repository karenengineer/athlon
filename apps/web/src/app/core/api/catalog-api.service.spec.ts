import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { API_BASE_URL } from "./api-base-url";
import { CatalogApiService } from "./catalog-api.service";

describe("CatalogApiService payment status", () => {
  let api: CatalogApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: "/api/v1" },
      ],
    });
    api = TestBed.inject(CatalogApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("requests only the server-owned status for a well-formed order reference", () => {
    let received: unknown;
    api
      .paymentStatus("ATH-1234ABCD1234ABCD1234ABCD1234ABCD")
      .subscribe((status) => (received = status));

    const request = http.expectOne(
      "/api/v1/public/orders/ATH-1234ABCD1234ABCD1234ABCD1234ABCD/payment-status",
    );
    expect(request.request.method).toBe("GET");
    expect(request.request.params.keys()).toEqual([]);
    request.flush({
      orderReference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
      paymentStatus: "PENDING",
      locale: "EN",
    });

    expect(received).toEqual({
      orderReference: "ATH-1234ABCD1234ABCD1234ABCD1234ABCD",
      paymentStatus: "PENDING",
      locale: "EN",
    });
  });

  it("rejects an invalid reference without issuing a request", () => {
    let failure: unknown;
    api
      .paymentStatus("ATH-1234ABCD1234ABCD1234ABCD1234ABCD?status=PAID")
      .subscribe({
      error: (error) => (failure = error),
      });

    expect(failure).toBeInstanceOf(Error);
    expect(http.match(() => true)).toHaveLength(0);
  });
});
