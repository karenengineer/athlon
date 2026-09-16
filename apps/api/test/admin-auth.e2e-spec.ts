import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import argon2 from "argon2";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";

describe("Admin authentication", () => {
  let app: INestApplication;
  let passwordHash: string;
  const prisma = {
    adminUser: { findUnique: jest.fn() },
    refreshSession: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };

  beforeAll(async () => {
    passwordHash = await argon2.hash("correct horse battery staple");
    prisma.adminUser.findUnique.mockImplementation(
      ({ where }: { where: { email: string } }) =>
        where.email === "admin@athlon.test"
          ? Promise.resolve({
              id: "55c20c13-3b51-44fb-a6ff-33fe765d29bb",
              email: "admin@athlon.test",
              passwordHash,
              active: true,
              role: "ADMIN",
            })
          : Promise.resolve(null),
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = configureApplication(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("exposes only the non-secret CSRF cookie name without requiring a session", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/admin/auth/config")
      .expect(200);
    expect(response.body).toEqual({ csrfCookieName: "athlon_csrf" });
  });

  it("reports the configured cookie name rather than inventing a second protocol", async () => {
    const config = app.get(ConfigService);
    const previous = config.get("CSRF_COOKIE_NAME");
    config.set("CSRF_COOKIE_NAME", "custom_csrf");
    try {
      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/auth/config")
        .expect(200);
      expect(response.body).toEqual({ csrfCookieName: "custom_csrf" });
    } finally {
      config.set("CSRF_COOKIE_NAME", previous);
    }
  });

  it("sets secure httpOnly session cookies and never returns tokens in JSON", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({
        email: "ADMIN@ATHLON.TEST",
        password: "correct horse battery staple",
      })
      .expect(201);

    expect(response.body).toEqual({
      user: {
        id: "55c20c13-3b51-44fb-a6ff-33fe765d29bb",
        email: "admin@athlon.test",
        role: "ADMIN",
      },
    });
    const cookies = response.headers["set-cookie"] as unknown as string[];
    expect(cookies.join(";")).toContain("athlon_access=");
    expect(cookies.join(";")).toContain("athlon_refresh=");
    expect(cookies.join(";")).toContain("athlon_csrf=");
    expect(cookies.join(";")).toContain("HttpOnly");
    expect(response.body.accessToken).toBeUndefined();
    expect(response.body.refreshToken).toBeUndefined();
  });

  it("uses the same response for unknown email and wrong password", async () => {
    const unknown = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email: "missing@athlon.test", password: "wrong password value" })
      .expect(401);
    const wrong = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email: "admin@athlon.test", password: "wrong password value" })
      .expect(401);
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it("rejects refresh without a matching CSRF header", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/refresh")
      .set("Cookie", ["athlon_refresh=fake-token", "athlon_csrf=known-csrf"])
      .expect(403);
  });
});
