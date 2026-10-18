import { environmentSchema } from "./environment.schema";

describe("environmentSchema", () => {
  const requiredEnvironment = {
    DATABASE_URL: "postgresql://user:password@localhost:5432/athlon",
    ACCESS_TOKEN_SECRET: "access-token-secret-with-at-least-32-characters",
    REFRESH_TOKEN_SECRET: "refresh-token-secret-with-at-least-32-characters",
  };

  it("accepts blank optional Compose values and applies defaults", () => {
    const { error, value } = environmentSchema.validate({
      ...requiredEnvironment,
      TRUST_PROXY_HOPS: "",
      RESEND_API_KEY: "",
      ORDER_FROM_EMAIL: "",
    });

    expect(error).toBeUndefined();
    expect(value.TRUST_PROXY_HOPS).toBe(0);
    expect(value.RESEND_API_KEY).toBeUndefined();
    expect(value.ORDER_FROM_EMAIL).toBe("orders@athlonsport.am");
    expect(value.CARD_PAYMENT_TEST_FLOW_ENABLED).toBe(false);
  });

  it("defaults the isolated card-payment test flow to disabled", () => {
    const defaults = environmentSchema.validate(requiredEnvironment);
    expect(defaults.error).toBeUndefined();
    expect(defaults.value.CARD_PAYMENT_TEST_FLOW_ENABLED).toBe(false);
    expect(defaults.value.CARD_PAYMENT_TEST_MODE).toBe("MOCK");

    const enabled = environmentSchema.validate({
      ...requiredEnvironment,
      CARD_PAYMENT_TEST_FLOW_ENABLED: "true",
    });
    expect(enabled.error).toBeUndefined();
    expect(enabled.value.CARD_PAYMENT_TEST_FLOW_ENABLED).toBe(true);
  });

  it("requires complete separate credentials, access protection and exact canonical origin for sandbox mode", () => {
    const sandbox = {
      ...requiredEnvironment,
      CARD_PAYMENT_TEST_MODE: "AMERIA_SANDBOX",
      AMERIA_SANDBOX_CLIENT_ID: "fixture-client",
      AMERIA_SANDBOX_USERNAME: "fixture-user",
      AMERIA_SANDBOX_PASSWORD: "fixture-password",
      CARD_PAYMENT_TEST_ACCESS_TOKEN:
        "fixture-access-token-longer-than-32-characters",
      AMERIA_SANDBOX_RETURN_ORIGIN: "https://athlon.am",
    };
    expect(environmentSchema.validate(sandbox).error).toBeUndefined();
    expect(
      environmentSchema.validate(sandbox).value.AMERIA_PAYMENTS_ENABLED,
    ).toBe(false);
    for (const key of [
      "AMERIA_SANDBOX_CLIENT_ID",
      "AMERIA_SANDBOX_USERNAME",
      "AMERIA_SANDBOX_PASSWORD",
      "CARD_PAYMENT_TEST_ACCESS_TOKEN",
      "AMERIA_SANDBOX_RETURN_ORIGIN",
    ]) {
      expect(
        environmentSchema.validate({ ...sandbox, [key]: "" }).error,
      ).toBeDefined();
    }
    expect(
      environmentSchema.validate({
        ...sandbox,
        CARD_PAYMENT_TEST_ACCESS_TOKEN: "short",
      }).error,
    ).toBeDefined();
    for (const origin of [
      "http://athlon.am",
      "https://athlon.am/",
      "https://athlonsport.am",
      "https://athlon.am.attacker.test",
      "https://user@athlon.am",
    ]) {
      expect(
        environmentSchema.validate({
          ...sandbox,
          AMERIA_SANDBOX_RETURN_ORIGIN: origin,
        }).error,
      ).toBeDefined();
    }
  });

  it("still validates explicitly configured values", () => {
    const { error, value } = environmentSchema.validate({
      ...requiredEnvironment,
      TRUST_PROXY_HOPS: "2",
      RESEND_API_KEY: "provider-key",
      ORDER_FROM_EMAIL: "sales@example.com",
    });

    expect(error).toBeUndefined();
    expect(value.TRUST_PROXY_HOPS).toBe(2);
    expect(value.RESEND_API_KEY).toBe("provider-key");
    expect(value.ORDER_FROM_EMAIL).toBe("sales@example.com");
  });

  it("keeps Ameria disabled by default and requires the complete HTTPS configuration to enable", () => {
    const defaults = environmentSchema.validate(requiredEnvironment);
    expect(defaults.error).toBeUndefined();
    expect(defaults.value.AMERIA_PAYMENTS_ENABLED).toBe(false);

    const incomplete = environmentSchema.validate({
      ...requiredEnvironment,
      AMERIA_PAYMENTS_ENABLED: true,
    });
    expect(incomplete.error).toBeDefined();

    const configured = environmentSchema.validate({
      ...requiredEnvironment,
      AMERIA_PAYMENTS_ENABLED: true,
      AMERIA_API_BASE_URL: "https://bank.example.test/api",
      AMERIA_CHECKOUT_BASE_URL: "https://bank.example.test/checkout",
      AMERIA_MERCHANT_ID: "merchant-test-id",
      AMERIA_USERNAME: "test-username",
      AMERIA_PASSWORD: "test-password",
    });
    expect(configured.error).toBeUndefined();
  });

  it("rejects non-HTTPS or credential-bearing Ameria endpoints", () => {
    const http = environmentSchema.validate({
      ...requiredEnvironment,
      AMERIA_PAYMENTS_ENABLED: true,
      AMERIA_API_BASE_URL: "http://bank.example.test/api",
      AMERIA_CHECKOUT_BASE_URL: "https://bank.example.test/checkout",
      AMERIA_MERCHANT_ID: "merchant-test-id",
      AMERIA_USERNAME: "test-username",
      AMERIA_PASSWORD: "test-password",
    });
    expect(http.error).toBeDefined();

    const userInfo = environmentSchema.validate({
      ...requiredEnvironment,
      AMERIA_PAYMENTS_ENABLED: true,
      AMERIA_API_BASE_URL: "https://user:password@bank.example.test/api",
      AMERIA_CHECKOUT_BASE_URL: "https://bank.example.test/checkout",
      AMERIA_MERCHANT_ID: "merchant-test-id",
      AMERIA_USERNAME: "test-username",
      AMERIA_PASSWORD: "test-password",
    });
    expect(userInfo.error).toBeDefined();
  });
});

describe("environmentSchema card payment sandbox", () => {
  const base = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    ACCESS_TOKEN_SECRET: "a".repeat(32),
    REFRESH_TOKEN_SECRET: "b".repeat(32),
  };

  it("defaults to the mock test mode without sandbox credentials", () => {
    const { error, value } = environmentSchema.validate(base);
    expect(error).toBeUndefined();
    expect(value.CARD_PAYMENT_TEST_MODE).toBe("MOCK");
    expect(value.AMERIA_TEST_AMOUNT).toBe(10);
  });

  it("requires credentials and a return URL in sandbox mode", () => {
    const { error } = environmentSchema.validate({
      ...base,
      CARD_PAYMENT_TEST_MODE: "AMERIA_SANDBOX",
    });
    expect(error?.message).toMatch(/AMERIA_TEST_/);
  });

  it("accepts a complete sandbox configuration", () => {
    const { error } = environmentSchema.validate({
      ...base,
      CARD_PAYMENT_TEST_MODE: "AMERIA_SANDBOX",
      AMERIA_TEST_CLIENT_ID: "c",
      AMERIA_TEST_USERNAME: "u",
      AMERIA_TEST_PASSWORD: "p",
      AMERIA_TEST_BACK_URL_BASE: "https://athlon.am",
    });
    expect(error).toBeUndefined();
  });
});
