import Joi from "joi";

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ["postgresql", "postgres"] })
    .required(),
  CORS_ORIGINS: Joi.string().default("http://localhost:4200"),
  ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
  REFRESH_TOKEN_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  REFRESH_TOKEN_TTL_SECONDS: Joi.number().integer().min(3600).default(2592000),
  CSRF_COOKIE_NAME: Joi.string().default("athlon_csrf"),
  UPLOAD_DIR: Joi.string().default("./uploads"),
  MAX_UPLOAD_BYTES: Joi.number().integer().min(1024).default(5242880),
  ADMIN_EMAIL: Joi.string().email().allow("").optional(),
  ADMIN_PASSWORD: Joi.string().min(12).allow("").optional(),
});
