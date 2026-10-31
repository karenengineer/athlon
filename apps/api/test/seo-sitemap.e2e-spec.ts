import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";

describe("Public SEO sitemap inventory", () => {
  let app: INestApplication;
  const categoryDate = new Date("2026-03-01T00:00:00.000Z");
  const category = (slug: string) => ({
    slug,
    updatedAt: categoryDate.toISOString(),
  });
  const prisma = {
    product: { findMany: jest.fn() },
    category: { findMany: jest.fn() },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = configureApplication(moduleRef.createNestApplication());
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.product.findMany.mockResolvedValue([
      { slug: "zinc", updatedAt: new Date("2026-02-01T00:00:00.000Z") },
      { slug: "creatine", updatedAt: new Date("2026-01-01T00:00:00.000Z") },
      { slug: "creatine", updatedAt: new Date("2026-01-01T00:00:00.000Z") },
    ]);
    prisma.category.findMany.mockResolvedValue([
      {
        slug: "sports-nutrition",
        updatedAt: categoryDate,
        children: [
          { slug: "protein", updatedAt: categoryDate },
          { slug: "amino-acids", updatedAt: categoryDate },
        ],
      },
      {
        slug: "accessories",
        updatedAt: categoryDate,
        children: [{ slug: "protein", updatedAt: categoryDate }],
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it("exposes sorted unique product and category entries through the public GET route", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/public/seo/sitemap")
      .expect(200)
      .expect({
        products: [
          { slug: "creatine", updatedAt: "2026-01-01T00:00:00.000Z" },
          { slug: "zinc", updatedAt: "2026-02-01T00:00:00.000Z" },
        ],
        categories: [
          category("accessories"),
          category("amino-acids"),
          category("protein"),
          category("sports-nutrition"),
        ],
      });
  });

  it("selects only published product entries independently of category publication", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/public/seo/sitemap")
      .expect(200);

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    });
  });

  it("selects only published root categories and their published direct children", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/public/seo/sitemap")
      .expect(200);

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { parentId: null, published: true },
      select: {
        slug: true,
        updatedAt: true,
        children: {
          where: { published: true },
          select: { slug: true, updatedAt: true },
        },
      },
    });
  });

  it("returns a complete empty inventory when no public records exist", async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.category.findMany.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get("/api/v1/public/seo/sitemap")
      .expect(200)
      .expect({ products: [], categories: [] });
  });

  it.each(["product", "category"] as const)(
    "fails without a partial inventory when the %s read fails",
    async (entity) => {
      prisma[entity].findMany.mockRejectedValueOnce(
        new Error("Synthetic inventory read failure"),
      );

      await request(app.getHttpServer())
        .get("/api/v1/public/seo/sitemap")
        .expect(500)
        .expect(({ body }) => {
          expect(body.code).toBe("INTERNAL_ERROR");
          expect(body).not.toHaveProperty("products");
          expect(body).not.toHaveProperty("categories");
          expect(body.message).toBe("Internal server error");
        });
    },
  );

  it("does not register a POST inventory operation", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/public/seo/sitemap")
      .expect(404);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });
});
