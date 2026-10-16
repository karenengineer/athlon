import { TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { Subject, of } from "rxjs";
import {
  CardPaymentTestApiService,
  MockPaymentOutcome,
  MockPaymentSession,
} from "./card-payment-test-api.service";
import { MockCardCheckoutPage } from "./mock-card-checkout-page";

describe("MockCardCheckoutPage", () => {
  const session: MockPaymentSession = {
    reference: "mock-ref",
    mode: "MOCK" as const,
    status: "PENDING" as const,
    locale: "HY" as const,
    currency: "AMD" as const,
    total: "24000",
    items: [
      {
        productId: "p1",
        sku: "WHEY-1",
        name: "Whey Protein",
        quantity: 2,
        unitPrice: "12000",
        lineTotal: "24000",
      },
    ],
    expiresAt: "2026-10-11T12:15:00.000Z",
  };
  let api: {
    getSession: ReturnType<typeof vi.fn>;
    completeSession: ReturnType<typeof vi.fn>;
  };
  let navigate: ReturnType<typeof vi.fn>;
  let locale = "hy";

  beforeEach(() => {
    locale = "hy";
    api = {
      getSession: vi.fn().mockReturnValue(of(session)),
      completeSession: vi.fn(),
    };
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [MockCardCheckoutPage],
      providers: [
        { provide: CardPaymentTestApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ reference: "mock-ref" }),
              parent: { paramMap: convertToParamMap({ locale }) },
            },
            parent: {
              snapshot: { paramMap: convertToParamMap({ locale }) },
            },
          },
        },
        { provide: Router, useValue: { navigate } },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it("shows a persistent mock notice, server-derived amount, and no card-entry controls", () => {
    const fixture = TestBed.createComponent(MockCardCheckoutPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("ԹԵՍՏ / ՄԱԿԵՏ");
    expect(fixture.nativeElement.textContent).toContain(
      "քարտից գումար չի գանձվում",
    );
    expect(fixture.nativeElement.textContent).toContain("Whey Protein × 2");
    expect(fixture.nativeElement.querySelector("input")).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("24,000");
    expect(api.getSession).toHaveBeenCalledWith("mock-ref");
  });

  it.each(["SUCCESS", "DECLINED", "CANCELLED", "TIMEOUT"] as const)(
    "returns to basket after the %s mock outcome",
    async (outcome) => {
      const pending = new Subject<typeof session>();
      api.completeSession.mockReturnValue(pending);
      const fixture = TestBed.createComponent(MockCardCheckoutPage);
      fixture.detectChanges();
      const button = Array.from(
        fixture.nativeElement.querySelectorAll("button"),
      ).find(
        (candidate) =>
          (candidate as HTMLButtonElement).dataset["outcome"] === outcome,
      ) as HTMLButtonElement;

      button.click();
      fixture.detectChanges();
      expect(api.completeSession).toHaveBeenCalledWith(
        "mock-ref",
        outcome as MockPaymentOutcome,
      );
      expect(
        Array.from(fixture.nativeElement.querySelectorAll("button")).every(
          (item) => (item as HTMLButtonElement).disabled,
        ),
      ).toBe(true);
      pending.next({
        ...session,
        status:
          outcome === "SUCCESS"
            ? "SUCCEEDED"
            : outcome === "DECLINED"
              ? "FAILED"
              : outcome === "CANCELLED"
                ? "CANCELLED"
                : "EXPIRED",
      });
      pending.complete();
      await Promise.resolve();
      expect(navigate).toHaveBeenCalledWith(["/card-payment-test", locale], {
        queryParams: { session: "mock-ref" },
      });
    },
  );

  it("renders the payment instructions in the selected locale", () => {
    locale = "ru";
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: {
        snapshot: {
          paramMap: convertToParamMap({ reference: "mock-ref" }),
        },
        parent: {
          snapshot: { paramMap: convertToParamMap({ locale }) },
        },
      },
    });
    const fixture = TestBed.createComponent(MockCardCheckoutPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("ТЕСТ / МАКЕТ");
  });

  it("refuses to expose mock outcome controls for a bank sandbox session", () => {
    api.getSession.mockReturnValue(
      of({ ...session, mode: "AMERIA_SANDBOX", total: "10" }),
    );
    const fixture = TestBed.createComponent(MockCardCheckoutPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector("[data-outcome]")).toBeNull();
    fixture.componentInstance.chooseOutcome("SUCCESS");
    expect(api.completeSession).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]'),
    ).not.toBeNull();
  });
});
