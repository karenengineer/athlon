import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { BasketService } from "../../core/basket/basket.service";
import { BasketPage } from "./basket-page";

describe("BasketPage", () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [BasketPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("keeps quantity and remove controls on one row", () => {
    const basket = TestBed.inject(BasketService);
    basket.add({
      id: "product-1",
      sku: "SKU1",
      slug: "test-product",
      name: "Test Product",
      price: "24000",
      currency: "AMD",
      availability: "IN_STOCK",
      featured: false,
      isNew: false,
      category: { slug: "protein", name: "Protein" },
      brand: null,
      images: [],
      shortDescription: null,
    });

    const fixture = TestBed.createComponent(BasketPage);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith("/public/settings"))
      .flush({});
    fixture.detectChanges();

    const controls = fixture.nativeElement.querySelector(
      ".basket-item-actions",
    );

    expect(controls).not.toBeNull();
    expect(getComputedStyle(controls).display).toBe("flex");
    expect(controls.querySelector("label")).not.toBeNull();
    expect(controls.querySelector("button")).not.toBeNull();
  });

  it("shows continue shopping as a centered white button", () => {
    const fixture = TestBed.createComponent(BasketPage);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url.endsWith("/public/settings"))
      .flush({});
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(".continue-shopping");
    const style = getComputedStyle(link);

    expect(link).not.toBeNull();
    expect(style.display).toBe("inline-flex");
    expect(style.alignItems).toBe("center");
    expect(style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(style.color).toBe("rgb(23, 23, 25)");
  });
});
