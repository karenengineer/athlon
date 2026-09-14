import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";

describe("Admin catalog", () => {
  let app: INestApplication;
  let accessToken: string;
  const csrf = "known-csrf-token";
  const prisma = {
    product: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: "p1", ...data }),
        ),
      update: jest.fn(),
      delete: jest.fn(),
    },
    category: {
      count: jest.fn().mockResolvedValue(2),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    brand: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: "b1", ...data }),
        ),
      update: jest.fn(),
      delete: jest.fn(),
    },
    siteSetting: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest
        .fn()
        .mockImplementation(({ create }) => Promise.resolve(create)),
    },
  };

  beforeAll(async () => {
    accessToken = await new JwtService().signAsync(
      {
        sub: "55c20c13-3b51-44fb-a6ff-33fe765d29bb",
        email: "admin@athlon.test",
        role: "ADMIN",
        type: "access",
      },
      {
        secret: "test-access-secret-with-at-least-32-characters",
        expiresIn: 900,
      },
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = configureApplication(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => app?.close());

  it("rejects unauthenticated product administration", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/products")
      .expect(401);
  });

  it("creates a draft product with three structured translations", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/products")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({
        sku: "DEMO-CREATINE",
        slug: "demo-creatine",
        categoryId: "24d3f1a3-8413-4bc6-b32d-437871a22b54",
        price: null,
        availability: "ON_REQUEST",
        characteristics: {},
        featured: true,
        isNew: true,
        published: false,
        displayOrder: 1,
        translations: [
          { locale: "HY", name: "Դեմո կրեատին" },
          { locale: "RU", name: "Демо креатин" },
          { locale: "EN", name: "Demo creatine" },
        ],
      })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toEqual(
          expect.objectContaining({ id: "p1", sku: "DEMO-CREATINE" }),
        ),
      );

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currency: "AMD",
          translations: {
            create: expect.arrayContaining([
              expect.objectContaining({ locale: "RU" }),
            ]),
          },
        }),
      }),
    );
  });

  it("prevents a third top-level category", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/categories")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({
        code: "third-root",
        slug: "third-root",
        translations: [
          { locale: "HY", name: "Երրորդ" },
          { locale: "RU", name: "Третья" },
          { locale: "EN", name: "Third" },
        ],
      })
      .expect(409);
  });

  it("creates a localized brand", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/admin/brands")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({
        slug: "demo-brand",
        name: "Demo Brand",
        published: true,
        translations: [
          { locale: "HY", name: "Դեմո բրենդ" },
          { locale: "RU", name: "Демо бренд" },
          { locale: "EN", name: "Demo Brand" },
        ],
      })
      .expect(201)
      .expect(({ body }) => expect(body.slug).toBe("demo-brand"));
  });

  it("rejects unknown site-setting keys", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/admin/settings")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({ settings: { databasePassword: "must-never-be-accepted" } })
      .expect(400);
  });
});
