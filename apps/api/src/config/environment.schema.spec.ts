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
