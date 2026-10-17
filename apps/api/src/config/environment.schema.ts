import Joi from "joi";

const ameriaRequiredWhenEnabled = Joi.string()
  .trim()
  .min(1)
  .when("AMERIA_PAYMENTS_ENABLED", {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional().allow(""),
  });

const ameriaHttpsUrl = Joi.string()
  .uri({ scheme: ["https"] })
  .custom((value, helpers) => {
    const url = new URL(value);
    if (url.username || url.password) return helpers.error("string.uri");
    return value;
  })
  .when("AMERIA_PAYMENTS_ENABLED", {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional().allow(""),
  });

const ameriaSandboxRequired = Joi.string()
  .trim()
  .min(1)
  .when("CARD_PAYMENT_TEST_MODE", {
    is: "AMERIA_SANDBOX",
    then: Joi.required(),
    otherwise: Joi.optional().allow(""),
  });

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  SWAGGER_ENABLED: Joi.boolean().default(process.env.NODE_ENV !== "production"),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ["postgresql", "postgres"] })
    .required(),
  CORS_ORIGINS: Joi.string().default("http://localhost:4200"),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(3).empty("").default(0),
  ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
  REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  REFRESH_TOKEN_TTL_SECONDS: Joi.number().integer().min(3600).default(2592000),
  CSRF_COOKIE_NAME: Joi.string().default("athlon_csrf"),
  UPLOAD_DIR: Joi.string().default("./uploads"),
  MAX_UPLOAD_BYTES: Joi.number().integer().min(1024).default(5242880),
  ADMIN_EMAIL: Joi.string().email().allow("").optional(),
  ADMIN_PASSWORD: Joi.string().min(12).allow("").optional(),
  RESEND_API_KEY: Joi.string().min(1).empty("").optional(),
  ORDER_FROM_EMAIL: Joi.string()
    .email()
    .empty("")
    .default("orders@athlonsport.am"),
  AMERIA_PAYMENTS_ENABLED: Joi.boolean().default(false),
  AMERIA_API_BASE_URL: ameriaHttpsUrl,
  AMERIA_CHECKOUT_BASE_URL: ameriaHttpsUrl,
  AMERIA_MERCHANT_ID: ameriaRequiredWhenEnabled,
  AMERIA_USERNAME: ameriaRequiredWhenEnabled,
  AMERIA_PASSWORD: ameriaRequiredWhenEnabled,
  CARD_PAYMENT_TEST_FLOW_ENABLED: Joi.boolean().default(false),
  CARD_PAYMENT_TEST_MODE: Joi.string()
    .valid("MOCK", "AMERIA_SANDBOX")
    .empty("")
    .default("MOCK"),
  AMERIA_TEST_API_BASE_URL: Joi.string()
    .uri({ scheme: ["https"] })
    .empty("")
    .default("https://servicestest.ameriabank.am/VPOS"),
  AMERIA_TEST_CLIENT_ID: ameriaSandboxRequired,
  AMERIA_TEST_USERNAME: ameriaSandboxRequired,
  AMERIA_TEST_PASSWORD: ameriaSandboxRequired,
  AMERIA_TEST_BACK_URL_BASE: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .when("CARD_PAYMENT_TEST_MODE", {
      is: "AMERIA_SANDBOX",
      then: Joi.required(),
      otherwise: Joi.optional().allow(""),
    }),
  AMERIA_TEST_ORDER_ID_MIN: Joi.number().integer().min(1).default(30543001),
  AMERIA_TEST_ORDER_ID_MAX: Joi.number().integer().min(1).default(30544000),
  AMERIA_TEST_AMOUNT: Joi.number().positive().default(10),
});
