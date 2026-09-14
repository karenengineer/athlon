import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";

describe("Public catalog", () => {
  let app: INestApplication;
  const prisma = {
    category: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "c1",
          code: "sports-nutrition",
          slug: "sports-nutrition",
          displayOrder: 0,
          translations: [
            { locale: "RU", name: "Спортивное питание", description: null },
            { locale: "EN", name: "Sports nutrition", description: null },
          ],
          children: [],
        },
      ]),
    },
    brand: { findMany: jest.fn().mockResolvedValue([]) },
    product: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        {
          id: "p1",
          sku: "DEMO-WHEY",
          slug: "demo-whey",
          price: null,
          currency: "AMD",
          availability: "IN_STOCK",
          featured: true,
          isNew: false,
          characteristics: {},
          translations: [
            {
              locale: "RU",
              name: "Демо протеин",
              shortDescription: null,
              description: null,
            },
          ],
          category: {
            slug: "sports-nutrition",
            translations: [{ locale: "RU", name: "Спортивное питание" }],
          },
          brand: null,
          images: [],
        },
      ]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    siteSetting: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeAll(async () => {
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

  it("returns translated public categories", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/categories?locale=en")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            slug: "sports-nutrition",
            name: "Sports nutrition",
          }),
        ]);
      });
  });

  it("falls back to Russian and bounds pagination", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/products?locale=hy&page=1&pageSize=200")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items[0]).toEqual(
          expect.objectContaining({
            name: "Демо протеин",
            price: null,
            currency: "AMD",
          }),
        );
        expect(body.meta).toEqual({
          page: 1,
          pageSize: 48,
          total: 1,
          totalPages: 1,
        });
      });
  });

  it("rejects unsupported sorting", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/products?sort=rawSql")
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe("VALIDATION_ERROR"));
  });
});
