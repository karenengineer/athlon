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
});
