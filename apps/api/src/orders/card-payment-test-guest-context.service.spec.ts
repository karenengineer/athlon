import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { CardPaymentTestGuestContextService } from "./card-payment-test-guest-context.service";

describe("CardPaymentTestGuestContextService", () => {
  let service: CardPaymentTestGuestContextService;
  let config: ConfigService;
  const cookie = jest.fn();
  const response = { cookie } as unknown as Response;
  const read = (id?: string) =>
    ({
      method: "GET",
      headers: {},
      cookies: id ? { athlon_card_payment_test_owner: id } : {},
    }) as Request;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-11T10:00:00Z"));
    cookie.mockReset();
    config = new ConfigService({
      NODE_ENV: "development",
      CARD_PAYMENT_TEST_FLOW_ENABLED: true,
      CORS_ORIGINS: "http://localhost:4200,https://shop.example",
    });
    service = new CardPaymentTestGuestContextService(config);
  });
  afterEach(() => jest.useRealTimers());

  function browser() {
    const csrf = service.bootstrap(read(), response);
    return { id: cookie.mock.lastCall![1] as string, csrf };
  }

  it("bounds live browser contexts and lets an existing browser continue at capacity", () => {
    const first = browser();
    for (let count = 1; count < 500; count++) browser();
    expect(() => browser()).toThrow("Too many active mock browsers");
    expect(service.bootstrap(read(first.id), response)).toBe(first.csrf);
    expect(service.requireOwner(read(first.id))).toEqual({
      id: first.id,
      expiresAtMs: Date.now() + 15 * 60_000,
    });
  });

  it("prunes expired contexts before creating a new browser at capacity", () => {
    const expired = browser();
    for (let count = 1; count < 500; count++) browser();
    jest.advanceTimersByTime(15 * 60_000);
    const replacement = browser();
    expect(service.requireOwner(read(replacement.id)).id).toBe(replacement.id);
    expect(() => service.requireOwner(read(expired.id))).toThrow(
      "Valid mock browser and CSRF token required",
    );
  });

  it("never extends the original browser lifetime when config is refreshed", () => {
    const first = browser();
    jest.advanceTimersByTime(14 * 60_000);
    expect(service.bootstrap(read(first.id), response)).toBe(first.csrf);
    expect(cookie.mock.lastCall![2]).toMatchObject({
      maxAge: 60_000,
      secure: false,
    });
    jest.advanceTimersByTime(60_000);
    expect(() => service.requireOwner(read(first.id))).toThrow(
      "Valid mock browser and CSRF token required",
    );
    expect(service.bootstrap(read(first.id), response)).not.toBe(first.csrf);
  });

  it("accepts only exact configured origins and the token bound to that owner", () => {
    const first = browser();
    const second = browser();
    const mutation = {
      ...read(first.id),
      method: "POST",
      headers: {
        origin: "https://shop.example",
        "x-card-payment-test-csrf": first.csrf,
      },
    } as unknown as Request;
    expect(service.requireOwner(mutation).id).toBe(first.id);
    mutation.headers["x-card-payment-test-csrf"] = second.csrf;
    expect(() => service.requireOwner(mutation)).toThrow(
      "Valid mock browser and CSRF token required",
    );
    mutation.headers["x-card-payment-test-csrf"] = first.csrf;
    mutation.headers.origin = "https://shop.example.attacker.test";
    expect(() => service.requireOwner(mutation)).toThrow(
      "Mock payment origin is not allowed",
    );
  });

  it("fails closed for an established browser after the flag is disabled", () => {
    const guest = browser();
    config.set("CARD_PAYMENT_TEST_FLOW_ENABLED", false);
    expect(() => service.requireOwner(read(guest.id))).toThrow(
      "Mock payment test flow is disabled",
    );
  });
});
