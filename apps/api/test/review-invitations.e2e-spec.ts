import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { Prisma } from "../src/generated/prisma/client";
import { hashReviewToken } from "../src/reviews/review-token";

const orderId = "a1d2f6c0-5f37-4d55-9f0e-7f8a0c2b9e01";
const productId = "b7c1e2d3-4a5b-4c6d-8e7f-901234567890";
const otherProductId = "c8d2f3e4-5b6c-4d7e-9f80-a12345678901";
const token = "A".repeat(43);

describe("Verified-buyer reviews", () => {
  let app: INestApplication;
  let accessToken: string;
  const csrf = "known-csrf-token";
  const cookies = () => [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`];
  const fetchSpy = jest.spyOn(global, "fetch");
  const prisma = {
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    reviewInvitation: {
      upsert: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    productReview: { create: jest.fn() },
    siteSetting: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeAll(async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
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

  afterAll(async () => {
    delete process.env.RESEND_API_KEY;
    fetchSpy.mockRestore();
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue(new Response("{}", { status: 200 }));
  });

  const server = () => app.getHttpServer();

  const deliveredOrder = {
    id: orderId,
    reference: "ATH-0001",
    locale: "HY",
    customerName: "Aram Petrosyan",
    customerEmail: "buyer@example.test",
    deliveredAt: new Date("2026-11-24T10:00:00Z"),
    items: [
      { productId, name: "Whey" },
      { productId: null, name: "Deleted product" },
    ],
  };

  describe("admin orders", () => {
    it("requires admin auth, and CSRF to mark delivered", async () => {
      await request(server()).get("/api/v1/admin/orders").expect(401);
      await request(server())
        .post(`/api/v1/admin/orders/${orderId}/delivered`)
        .set("Cookie", cookies())
        .expect(403);
      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it("lists orders waiting for delivery by default", async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);
      const response = await request(server())
        .get("/api/v1/admin/orders")
        .set("Cookie", cookies())
        .expect(200);
      expect(response.body.meta).toMatchObject({ page: 1, toDeliver: 0 });
      const where = prisma.order.findMany.mock.calls[0][0].where;
      expect(where.AND[1]).toEqual({ deliveredAt: null });
    });

    it("marks a paid order delivered and emails a hashed-token review link", async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce({ id: orderId, deliveredAt: null })
        .mockResolvedValueOnce(deliveredOrder);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      const response = await request(server())
        .post(`/api/v1/admin/orders/${orderId}/delivered`)
        .set("Cookie", cookies())
        .set("x-csrf-token", csrf)
        .expect(200);
      expect(response.body.reviewEmail).toBe("SENT");

      const upsert = prisma.reviewInvitation.upsert.mock.calls[0][0];
      expect(upsert.create.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      const email = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
      expect(email.to).toEqual(["buyer@example.test"]);
      const link = /https:\/\/athlon\.am\/hy\/review\/([A-Za-z0-9_-]{43})/.exec(
        email.text,
      );
      expect(link).not.toBeNull();
      // The link carries the token; only its hash is stored.
      expect(hashReviewToken(link![1]!)).toBe(upsert.create.tokenHash);
      expect(email.text).toContain("Whey");
      expect(email.text).not.toContain("Deleted product");
      expect(prisma.reviewInvitation.update).toHaveBeenCalled();
    });

    it("refuses orders the customer cannot have received", async () => {
      prisma.order.findUnique
        .mockResolvedValueOnce({ id: orderId, deliveredAt: null })
        .mockResolvedValueOnce({ deliveredAt: null });
      prisma.order.updateMany.mockResolvedValue({ count: 0 });
      await request(server())
        .post(`/api/v1/admin/orders/${orderId}/delivered`)
        .set("Cookie", cookies())
        .set("x-csrf-token", csrf)
        .expect(409);
      expect(prisma.reviewInvitation.upsert).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("does not email twice when an order is already delivered", async () => {
      prisma.order.findUnique.mockResolvedValueOnce({
        id: orderId,
        deliveredAt: new Date("2026-11-24T10:00:00Z"),
      });
      const response = await request(server())
        .post(`/api/v1/admin/orders/${orderId}/delivered`)
        .set("Cookie", cookies())
        .set("x-csrf-token", csrf)
        .expect(200);
      expect(response.body.reviewEmail).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("reports a failed email without losing the delivery", async () => {
      prisma.order.findUnique.mockResolvedValueOnce(deliveredOrder);
      fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 500 }));
      const response = await request(server())
        .post(`/api/v1/admin/orders/${orderId}/review-email`)
        .set("Cookie", cookies())
        .set("x-csrf-token", csrf)
        .expect(200);
      expect(response.body.reviewEmail).toBe("FAILED");
      expect(prisma.reviewInvitation.update).not.toHaveBeenCalled();
    });

    it("will not send a review link for an undelivered order", async () => {
      prisma.order.findUnique.mockResolvedValueOnce({
        ...deliveredOrder,
        deliveredAt: null,
      });
      await request(server())
        .post(`/api/v1/admin/orders/${orderId}/review-email`)
        .set("Cookie", cookies())
        .set("x-csrf-token", csrf)
        .expect(409);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("review link", () => {
    const invitation = (overrides: object = {}) => ({
      expiresAt: new Date(Date.now() + 86_400_000),
      order: {
        id: orderId,
        locale: "HY",
        customerName: "Aram Petrosyan",
        deliveredAt: new Date(),
        reviews: [],
        items: [
          {
            name: "Whey",
            product: {
              id: productId,
              slug: "whey",
              published: true,
              translations: [
                { locale: "HY", name: "Շիճուկ" },
                { locale: "EN", name: "Whey" },
              ],
              images: [{ thumbnailKey: "p/whey-thumb.webp" }],
            },
          },
        ],
        ...overrides,
      },
    });
    const valid = {
      productId,
      authorName: "Aram",
      rating: 5,
      body: "Great taste and mixes well.",
      locale: "hy",
    };

    it("rejects malformed and unknown tokens", async () => {
      await request(server())
        .get("/api/v1/public/review-invitations/short")
        .expect(404);
      expect(prisma.reviewInvitation.findUnique).not.toHaveBeenCalled();
      prisma.reviewInvitation.findUnique.mockResolvedValue(null);
      await request(server())
        .get(`/api/v1/public/review-invitations/${token}`)
        .expect(404);
      expect(prisma.reviewInvitation.findUnique.mock.calls[0][0].where).toEqual(
        { tokenHash: hashReviewToken(token) },
      );
    });

    it("rejects an expired link", async () => {
      prisma.reviewInvitation.findUnique.mockResolvedValue({
        ...invitation(),
        expiresAt: new Date(Date.now() - 1000),
      });
      await request(server())
        .get(`/api/v1/public/review-invitations/${token}`)
        .expect(410);
    });

    it("lists the bought products in the requested language", async () => {
      prisma.reviewInvitation.findUnique.mockResolvedValue(invitation());
      const response = await request(server())
        .get(`/api/v1/public/review-invitations/${token}?locale=en`)
        .expect(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body).toMatchObject({
        authorName: "Aram",
        locale: "hy",
        items: [
          {
            productId,
            slug: "whey",
            name: "Whey",
            imageUrl: "/api/v1/media/p/whey-thumb.webp",
            reviewed: false,
          },
        ],
      });
    });

    it("stores a pending review tied to the order", async () => {
      prisma.reviewInvitation.findUnique.mockResolvedValue(invitation());
      await request(server())
        .post(`/api/v1/public/review-invitations/${token}/reviews`)
        .send(valid)
        .expect(202)
        .expect({ status: "PENDING" });
      expect(prisma.productReview.create).toHaveBeenCalledWith({
        data: {
          productId,
          orderId,
          locale: "HY",
          authorName: "Aram",
          rating: 5,
          body: valid.body,
        },
      });
    });

    it("refuses products that were not in the order", async () => {
      prisma.reviewInvitation.findUnique.mockResolvedValue(invitation());
      await request(server())
        .post(`/api/v1/public/review-invitations/${token}/reviews`)
        .send({ ...valid, productId: otherProductId })
        .expect(404);
      expect(prisma.productReview.create).not.toHaveBeenCalled();
    });

    it("allows one review per product per order", async () => {
      prisma.reviewInvitation.findUnique.mockResolvedValue(invitation());
      prisma.productReview.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("duplicate", {
          code: "P2002",
          clientVersion: "test",
        }),
      );
      await request(server())
        .post(`/api/v1/public/review-invitations/${token}/reviews`)
        .send(valid)
        .expect(409);
    });

    it.each([
      [{ rating: 0 }],
      [{ rating: 6 }],
      [{ body: "short" }],
      [{ authorName: "A" }],
      [{ productId: "not-a-uuid" }],
      [{ status: "APPROVED" }],
    ])("rejects invalid input %j", async (override) => {
      prisma.reviewInvitation.findUnique.mockResolvedValue(invitation());
      await request(server())
        .post(`/api/v1/public/review-invitations/${token}/reviews`)
        .send({ ...valid, ...override })
        .expect(400);
      expect(prisma.productReview.create).not.toHaveBeenCalled();
    });
  });
});
