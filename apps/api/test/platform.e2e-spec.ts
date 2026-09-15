import type { INestApplication } from "@nestjs/common";
import request from "supertest";

describe("API platform", () => {
  let app: INestApplication;
  let createApplication: typeof import("../src/bootstrap").createApplication;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousAccessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
  const previousRefreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSwaggerEnabled = process.env.SWAGGER_ENABLED;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      "postgresql://athlon:athlon@localhost:5432/athlon_test";
    process.env.ACCESS_TOKEN_SECRET =
      "test-access-secret-with-at-least-32-characters";
    process.env.REFRESH_TOKEN_SECRET =
      "test-refresh-secret-with-at-least-32-characters";
    process.env.NODE_ENV = "production";
    process.env.SWAGGER_ENABLED = "false";
    ({ createApplication } = await import("../src/bootstrap"));
    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    if (previousAccessTokenSecret === undefined) {
      delete process.env.ACCESS_TOKEN_SECRET;
    } else {
      process.env.ACCESS_TOKEN_SECRET = previousAccessTokenSecret;
    }
    if (previousRefreshTokenSecret === undefined) {
      delete process.env.REFRESH_TOKEN_SECRET;
    } else {
      process.env.REFRESH_TOKEN_SECRET = previousRefreshTokenSecret;
    }
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousSwaggerEnabled === undefined) {
      delete process.env.SWAGGER_ENABLED;
    } else {
      process.env.SWAGGER_ENABLED = previousSwaggerEnabled;
    }
  });

  it("reports liveness without touching external dependencies", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/health/live")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ status: "ok" });
      });
  });

  it("returns the stable error envelope without a stack trace", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/does-not-exist")
      .expect(404)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            code: "NOT_FOUND",
            path: "/api/v1/does-not-exist",
          }),
        );
        expect(body.requestId).toEqual(expect.any(String));
        expect(body.stack).toBeUndefined();
      });
  });

  it("does not register API documentation when Swagger is disabled in production", async () => {
    await request(app.getHttpServer()).get("/api/docs").expect(404);
  });
});
