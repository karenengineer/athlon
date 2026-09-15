import { TestBed } from "@angular/core/testing";
import { API_BASE_URL } from "./api-base-url";

describe("API_BASE_URL", () => {
  it("uses the public relative API path by default", () => {
    TestBed.configureTestingModule({});
    expect(TestBed.inject(API_BASE_URL)).toBe("/api/v1");
  });

  it("can be overridden by the server configuration", () => {
    TestBed.configureTestingModule({
      providers: [{ provide: API_BASE_URL, useValue: "http://api:3000/api/v1" }],
    });
    expect(TestBed.inject(API_BASE_URL)).toBe("http://api:3000/api/v1");
  });
});
