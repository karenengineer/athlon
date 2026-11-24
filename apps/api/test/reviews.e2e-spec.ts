import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";

const reviewId = "6f0f3f3e-8f3a-4c7e-9d65-0f3c2b1a9e11";

describe("Product reviews", () => {
  let app: INestApplication;
  let accessToken: string;
  const csrf = "known-csrf-token";
  const prisma = {
    product: { findFirst: jest.fn() },
    productReview: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    siteSetting: { findMany: jest.fn().mockResolvedValue([]) },
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

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.product.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(
        where.slug === "whey" && where.published === true ? { id: "p1" } : null,
      ),
    );
  });

  const server = () => app.getHttpServer();
  const valid = {
    authorName: "Aram",
    rating: 5,
    body: "Great taste and mixes well.",
    locale: "hy",
  };

  it("lists only approved reviews with a rounded summary", async () => {
    prisma.productReview.findMany.mockResolvedValue([
      {
        id: "r1",
        authorName: "Aram",
        rating: 5,
        body: "Great",
        locale: "HY",
        orderId: "a1d2f6c0-5f37-4d55-9f0e-7f8a0c2b9e01",
        createdAt: new Date("2026-11-20T10:00:00Z"),
      },
    ]);
    prisma.productReview.aggregate.mockResolvedValue({
      _count: { _all: 3 },
      _avg: { rating: 4.666 },
    });
    const response = await request(server())
      .get("/api/v1/products/whey/reviews")
      .expect(200);
    expect(response.body).toEqual({
      summary: { count: 3, average: 4.7 },
      items: [
        {
          id: "r1",
          authorName: "Aram",
          rating: 5,
          body: "Great",
          locale: "hy",
          verified: true,
          createdAt: "2026-11-20T10:00:00.000Z",
        },
      ],
    });
    expect(prisma.productReview.findMany.mock.calls[0][0].where).toEqual({
      productId: "p1",
      status: "APPROVED",
    });
  });

  it("returns 404 for unknown or unpublished products", async () => {
    await request(server()).get("/api/v1/products/missing/reviews").expect(404);
  });

  it("has no anonymous review submission", async () => {
    await request(server())
      .post("/api/v1/products/whey/reviews")
      .send(valid)
      .expect(404);
    expect(prisma.productReview.create).not.toHaveBeenCalled();
  });

  it("requires admin auth and CSRF for moderation", async () => {
    await request(server()).get("/api/v1/admin/reviews").expect(401);
    await request(server())
      .patch(`/api/v1/admin/reviews/${reviewId}`)
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .send({ status: "APPROVED" })
      .expect(403);
    expect(prisma.productReview.update).not.toHaveBeenCalled();
  });

  it("lets an admin list, approve and delete reviews", async () => {
    const cookies = [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`];
    prisma.productReview.findMany.mockResolvedValue([
      {
        id: reviewId,
        authorName: "Aram",
        rating: 4,
        body: "Good",
        locale: "RU",
        status: "PENDING",
        moderatedAt: null,
        createdAt: new Date("2026-11-20T10:00:00Z"),
        order: { reference: "ATH-0001" },
        product: {
          slug: "whey",
          translations: [
            { locale: "EN", name: "Whey" },
            { locale: "HY", name: "Շիճուկ" },
          ],
        },
      },
    ]);
    prisma.productReview.count.mockResolvedValue(1);
    const list = await request(server())
      .get("/api/v1/admin/reviews?status=PENDING")
      .set("Cookie", cookies)
      .expect(200);
    expect(list.body.items[0]).toMatchObject({
      id: reviewId,
      locale: "ru",
      status: "PENDING",
      orderReference: "ATH-0001",
      product: { slug: "whey", name: "Շիճուկ" },
    });
    expect(list.body.meta).toMatchObject({ total: 1, pending: 1 });

    prisma.productReview.findUnique.mockResolvedValue({ id: reviewId });
    prisma.productReview.update.mockResolvedValue({
      id: reviewId,
      status: "APPROVED",
    });
    await request(server())
      .patch(`/api/v1/admin/reviews/${reviewId}`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrf)
      .send({ status: "APPROVED" })
      .expect(200);
    expect(
      prisma.productReview.update.mock.calls[0][0].data.moderatedAt,
    ).toBeInstanceOf(Date);

    await request(server())
      .delete(`/api/v1/admin/reviews/${reviewId}`)
      .set("Cookie", cookies)
      .set("x-csrf-token", csrf)
      .expect(204);
    expect(prisma.productReview.delete).toHaveBeenCalledWith({
      where: { id: reviewId },
    });
  });

  it("returns 404 when moderating an unknown review", async () => {
    prisma.productReview.findUnique.mockResolvedValue(null);
    await request(server())
      .patch("/api/v1/admin/reviews/not-a-uuid")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({ status: "APPROVED" })
      .expect(404);
  });
});
