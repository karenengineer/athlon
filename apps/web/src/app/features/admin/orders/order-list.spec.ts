import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { AdminOrder, AdminOrderList } from "../shared/admin-api.types";
import { OrderList } from "./order-list";

const order = (overrides: Partial<AdminOrder> = {}): AdminOrder => ({
  id: "o1",
  reference: "ATH-0001",
  createdAt: "2026-11-24T10:00:00.000Z",
  customerName: "Aram Petrosyan",
  customerPhone: "+37400000000",
  customerEmail: "buyer@example.test",
  deliveryAddress: "Yerevan",
  paymentMethod: "CASH_ON_DELIVERY",
  status: "PENDING",
  total: "29000",
  currency: "AMD",
  deliveredAt: null,
  canDeliver: true,
  reviewEmailSentAt: null,
  reviewEmailCount: 0,
  reviewCount: 0,
  items: [{ name: "Whey", sku: "W1", quantity: 2 }],
  ...overrides,
});

const page = (items: AdminOrder[]): AdminOrderList => ({
  items,
  meta: {
    page: 1,
    pageSize: 25,
    total: items.length,
    totalPages: 1,
    toDeliver: 1,
  },
});

describe("Admin OrderList", () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderList],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  const list = (filter: string) =>
    http.expectOne(
      (request) =>
        request.url === "/api/v1/admin/orders" &&
        request.params.get("filter") === filter,
    );

  it("marks an order delivered after confirmation and reports the email", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fixture = TestBed.createComponent(OrderList);
    fixture.detectChanges();
    list("TO_DELIVER").flush(page([order()]));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain("Whey × 2");
    (element.querySelector("[data-deliver]") as HTMLButtonElement).click();
    const post = http.expectOne("/api/v1/admin/orders/o1/delivered");
    expect(post.request.method).toBe("POST");
    post.flush({
      deliveredAt: "2026-11-25T10:00:00.000Z",
      reviewEmail: "SENT",
    });
    list("TO_DELIVER").flush(page([]));
    fixture.detectChanges();
    expect(fixture.componentInstance.notices()).toEqual({ o1: "SENT" });
  });

  it("does nothing when the confirmation is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const fixture = TestBed.createComponent(OrderList);
    fixture.detectChanges();
    list("TO_DELIVER").flush(page([order()]));
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector("[data-deliver]") as HTMLButtonElement
    ).click();
    http.expectNone("/api/v1/admin/orders/o1/delivered");
  });

  it("offers a resend for delivered orders and hides deliver for unpaid ones", () => {
    const fixture = TestBed.createComponent(OrderList);
    fixture.detectChanges();
    list("TO_DELIVER").flush(page([]));
    fixture.componentInstance.setFilter("ALL");
    list("ALL").flush(
      page([
        order({
          id: "o1",
          deliveredAt: "2026-11-24T12:00:00.000Z",
          canDeliver: false,
          reviewEmailSentAt: "2026-11-24T12:00:01.000Z",
        }),
        order({
          id: "o2",
          paymentMethod: "CARD",
          status: "PAYMENT_PENDING",
          canDeliver: false,
        }),
      ]),
    );
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll(
      "[data-testid=admin-order]",
    );
    expect(rows[0].querySelector("[data-resend]")).not.toBeNull();
    expect(rows[1].querySelector("[data-deliver]")).toBeNull();
    expect(rows[1].querySelector("[data-resend]")).toBeNull();
    (rows[0].querySelector("[data-resend]") as HTMLButtonElement).click();
    http
      .expectOne("/api/v1/admin/orders/o1/review-email")
      .flush({ reviewEmail: "FAILED" });
    list("ALL").flush(page([]));
    expect(fixture.componentInstance.notices()).toEqual({ o1: "FAILED" });
  });
});
