import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createApplication } from "../src/bootstrap";

describe("API platform", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      "postgresql://athlon:athlon@localhost:5432/athlon_test";
    process.env.ACCESS_TOKEN_SECRET =
      "test-access-secret-with-at-least-32-characters";
    process.env.REFRESH_TOKEN_SECRET =
      "test-refresh-secret-with-at-least-32-characters";
    app = await createApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
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
});
