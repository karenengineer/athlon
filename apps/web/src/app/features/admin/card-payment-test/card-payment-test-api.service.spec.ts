import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { provideHttpClient } from "@angular/common/http";
import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";
import { CardPaymentTestApiService } from "./card-payment-test-api.service";

describe("CardPaymentTestApiService", () => {
  let http: HttpTestingController;
  let api: CardPaymentTestApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(CardPaymentTestApiService);
  });

  afterEach(() => http.verify());

  it("reads authenticated mock-flow capability", async () => {
    const result = firstValueFrom(api.config());
    http.expectOne("/api/v1/admin/card-payment-test/config").flush({
      enabled: true,
      mode: "MOCK",
    });
    await expect(result).resolves.toEqual({ enabled: true, mode: "MOCK" });
  });

  it("posts only locale and basket lines to create a test session", async () => {
    const input = {
      locale: "hy" as const,
      items: [
        { productId: "product-id", quantity: 2, expectedUnitPrice: "12000" },
      ],
    };
    const result = firstValueFrom(api.createSession(input));
    const req = http.expectOne("/api/v1/admin/card-payment-test/sessions");
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual(input);
    req.flush({ reference: "mock-ref", mode: "MOCK", status: "PENDING" });
    await expect(result).resolves.toMatchObject({ reference: "mock-ref" });
  });

  it("reads a session by an encoded reference and submits deterministic mock outcomes", async () => {
    const read = firstValueFrom(api.getSession("reference/1"));
    http
      .expectOne("/api/v1/admin/card-payment-test/sessions/reference%2F1")
      .flush({
        reference: "reference/1",
        mode: "MOCK",
        status: "PENDING",
      });
    await read;

    const complete = firstValueFrom(
      api.completeSession("reference/1", "SUCCESS"),
    );
    const req = http.expectOne(
      "/api/v1/admin/card-payment-test/sessions/reference%2F1/outcome",
    );
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ outcome: "SUCCESS" });
    req.flush({ reference: "reference/1", mode: "MOCK", status: "SUCCEEDED" });
    await expect(complete).resolves.toMatchObject({ status: "SUCCEEDED" });
  });

  it("propagates server errors so guards and pages can fail closed", async () => {
    const result = firstValueFrom(api.config()).catch(
      (error: { status: number }) => error.status,
    );
    http
      .expectOne("/api/v1/admin/card-payment-test/config")
      .flush(
        { message: "Unavailable" },
        { status: 503, statusText: "Service Unavailable" },
      );
    await expect(result).resolves.toBe(503);
  });
});
