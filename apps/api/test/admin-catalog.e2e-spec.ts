import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import {
  brandId,
  categoryId,
  childId,
  fixtureCount,
  fixtureList,
  fixtures,
} from "./admin-list-fixtures";

type ListBody = {
  items: { id: string; published: boolean }[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

describe("Admin catalog", () => {
  let app: INestApplication;
  let accessToken: string;
  const csrf = "known-csrf-token";
  const prisma = {
    $transaction: jest
      .fn()
      .mockImplementation((callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
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

  beforeEach(() => {
    jest.clearAllMocks();
    for (const [delegate, rows] of [
      [prisma.product, fixtures.products],
      [prisma.category, fixtures.categories],
      [prisma.brand, fixtures.brands],
    ] as const) {
      delegate.count.mockImplementation((query) =>
        Promise.resolve(fixtureCount(rows, query)),
      );
      delegate.findMany.mockImplementation((query) =>
        Promise.resolve(fixtureList(rows, query)),
      );
      delegate.findUnique.mockImplementation(({ where }) =>
        Promise.resolve(rows.find((row) => row.id === where.id) ?? null),
      );
      delegate.delete.mockResolvedValue({});
    }
  });

  const cookies = () => [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`];

  describe.each(["products", "categories", "brands"])(
    "%s list contract",
    (resource) => {
      it("requires authentication", async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/admin/${resource}`)
          .expect(401);
      });

      it.each([
        "page=bad",
        "page=0",
        "page=1.5",
        "pageSize=101",
        "pageSize=0",
        "pageSize=1e2",
        "published=no",
        "published=1",
        "sort=unsafe",
        "unknown=value",
        "published=false&published=true",
      ])("rejects %s", async (query) => {
        await request(app.getHttpServer())
          .get(`/api/v1/admin/${resource}?${query}`)
          .set("Cookie", cookies())
          .expect(400);
      });

      it("defaults pagination and includes both publication states", async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/admin/${resource}`)
          .set("Cookie", cookies())
          .expect(200);
        const body = response.body as ListBody;
        expect(body.meta).toEqual({
          page: 1,
          pageSize: 24,
          total: resource === "brands" ? 2 : 3,
          totalPages: 1,
        });
        expect(body.items.some((item) => item.published)).toBe(true);
        expect(body.items.some((item) => !item.published)).toBe(true);
      });

      it("rejects computed offsets outside the persistence integer range", async () => {
        await request(app.getHttpServer())
          .get(`/api/v1/admin/${resource}?page=21474838&pageSize=100`)
          .set("Cookie", cookies())
          .expect(400);
        const delegate =
          resource === "products"
            ? prisma.product
            : resource === "categories"
              ? prisma.category
              : prisma.brand;
        expect(delegate.findMany).not.toHaveBeenCalled();
        await request(app.getHttpServer())
          .get(`/api/v1/admin/${resource}?page=2147483648&pageSize=1`)
          .set("Cookie", cookies())
          .expect(200);
        expect(delegate.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 2147483647, take: 1 }),
        );
      });

      it("applies false filter before count and pagination", async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/admin/${resource}?published=false&pageSize=1&page=2`)
          .set("Cookie", cookies())
          .expect(200);
        const body = response.body as ListBody;
        expect(body.items.every((item) => !item.published)).toBe(true);
        expect(body.meta).toEqual({
          page: 2,
          pageSize: 1,
          total: resource === "brands" ? 1 : 2,
          totalPages: resource === "brands" ? 1 : 2,
        });
        const delegate =
          resource === "products"
            ? prisma.product
            : resource === "categories"
              ? prisma.category
              : prisma.brand;
        expect(delegate.count).toHaveBeenCalledWith({
          where: { published: false },
        });
        expect(delegate.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { published: false },
            skip: 1,
            take: 1,
          }),
        );
      });

      it("searches translation text case-insensitively", async () => {
        const query =
          resource === "products"
            ? "ALPHA"
            : resource === "categories"
              ? "EQUIPMENT"
              : "LOCALIZED";
        const response = await request(app.getHttpServer())
          .get(`/api/v1/admin/${resource}?q=${query}&published=false`)
          .set("Cookie", cookies())
          .expect(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.meta.total).toBe(1);
      });

      it.each(["order", "updated", "name"])(
        "returns deterministic %s ordering",
        async (sort) => {
          const response = await request(app.getHttpServer())
            .get(`/api/v1/admin/${resource}?sort=${sort}`)
            .set("Cookie", cookies())
            .expect(200);
          const expected =
            resource === "products"
              ? ["p1", "p2", "p3"]
              : resource === "brands"
                ? sort === "order"
                  ? [childId, brandId]
                  : [brandId, childId]
                : sort === "order"
                  ? [childId, categoryId, brandId]
                  : sort === "name"
                    ? [brandId, categoryId, childId]
                    : [categoryId, brandId, childId];
          expect(
            (response.body as ListBody).items.map((item) => item.id),
          ).toEqual(expected);
          if (sort === "updated") {
            const delegate =
              resource === "products"
                ? prisma.product
                : resource === "categories"
                  ? prisma.category
                  : prisma.brand;
            expect(delegate.findMany).toHaveBeenCalledWith(
              expect.objectContaining({
                orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
              }),
            );
          }
        },
      );
    },
  );

  it.each([
    "featured=bad",
    "isNew=1",
    "availability=UNKNOWN",
    "categoryId=invalid",
    "brandId=invalid",
  ])("rejects invalid product filter %s", async (query) => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/products?${query}`)
      .set("Cookie", cookies())
      .expect(400);
  });

  it("combines all product filters and uses the same persistence where", async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/products?published=false&featured=true&isNew=false&availability=IN_STOCK&categoryId=${categoryId}&brandId=${brandId}&q=protein&pageSize=1&sort=priceDesc`,
      )
      .set("Cookie", cookies())
      .expect(200);
    expect((response.body as ListBody).items.map((item) => item.id)).toEqual([
      "p3",
    ]);
    expect(response.body.meta.total).toBe(2);
    const where = {
      published: false,
      featured: true,
      isNew: false,
      availability: "IN_STOCK",
      categoryId,
      brandId,
      OR: [
        { sku: { contains: "protein", mode: "insensitive" } },
        { slug: { contains: "protein", mode: "insensitive" } },
        {
          translations: {
            some: { name: { contains: "protein", mode: "insensitive" } },
          },
        },
      ],
    };
    expect(prisma.product.count).toHaveBeenCalledWith({ where });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ price: "desc" }, { id: "asc" }],
      }),
    );
  });

  it("orders tied products deterministically across pages", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/admin/products?sort=order&pageSize=1&page=2")
      .set("Cookie", cookies())
      .expect(200);
    expect(response.body.items[0].id).toBe("p2");
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { displayOrder: "asc" },
          { updatedAt: "desc" },
          { id: "asc" },
        ],
      }),
    );
  });

  it.each([
    ["priceAsc", ["p1", "p2", "p3"]],
    ["priceDesc", ["p3", "p2", "p1"]],
  ])("returns product %s sorting", async (sort, ids) => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/products?sort=${sort}`)
      .set("Cookie", cookies())
      .expect(200);
    expect((response.body as ListBody).items.map((item) => item.id)).toEqual(
      ids,
    );
  });

  it("searches product SKU and supports true and false boolean filters", async () => {
    const response = await request(app.getHttpServer())
      .get(
        "/api/v1/admin/products?q=sku-2&published=true&featured=false&isNew=true",
      )
      .set("Cookie", cookies())
      .expect(200);
    expect((response.body as ListBody).items.map((item) => item.id)).toEqual([
      "p2",
    ]);
    expect(response.body.meta.total).toBe(1);
  });

  it.each(["products", "categories", "brands"])(
    "returns an empty %s envelope for no matches",
    async (resource) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/${resource}?q=not-found&sort=name`)
        .set("Cookie", cookies())
        .expect(200);
      expect(response.body).toEqual({
        items: [],
        meta: { page: 1, pageSize: 24, total: 0, totalPages: 0 },
      });
    },
  );

  it.each(["products", "categories", "brands"])(
    "pages %s by HY, RU, EN name fallback before fetching rich rows",
    async (resource) => {
      const delegate =
        resource === "products"
          ? prisma.product
          : resource === "categories"
            ? prisma.category
            : prisma.brand;
      const rows = [
        {
          id: "z",
          name: "A base",
          translations: [
            { locale: "EN", name: "A ignored" },
            { locale: "HY", name: "Z" },
          ],
        },
        {
          id: "b",
          name: "Z base",
          translations: [
            { locale: "EN", name: "Z ignored" },
            { locale: "RU", name: "B" },
          ],
        },
        {
          id: "a",
          name: "Z base",
          translations: [{ locale: "EN", name: "A" }],
        },
        { id: "c", name: "C", translations: [] },
      ];
      delegate.findMany.mockImplementation((query) =>
        Promise.resolve(fixtureList(rows, query)),
      );
      delegate.count.mockResolvedValue(rows.length);
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/${resource}?sort=name&page=2&pageSize=1`)
        .set("Cookie", cookies())
        .expect(200);
      expect((response.body as ListBody).items.map((item) => item.id)).toEqual([
        resource === "brands" ? "b" : "a",
      ]);
      expect(delegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            translations: { select: { locale: true, name: true } },
          }),
        }),
      );
      expect(delegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [resource === "brands" ? "b" : "a"] } },
          include: expect.any(Object),
        }),
      );
    },
  );

  it.each(["categories", "brands"])(
    "rejects product-only price sorting for %s",
    async (resource) => {
      await request(app.getHttpServer())
        .get(`/api/v1/admin/${resource}?sort=priceAsc`)
        .set("Cookie", cookies())
        .expect(400);
    },
  );

  it.each(["products", "categories", "brands"])(
    "restores %s name order after rich fetch and breaks name ties by id",
    async (resource) => {
      const delegate =
        resource === "products"
          ? prisma.product
          : resource === "categories"
            ? prisma.category
            : prisma.brand;
      const rows = [
        { id: "c", translations: [{ locale: "HY", name: "B" }] },
        { id: "b", translations: [{ locale: "HY", name: "A" }] },
        { id: "a", translations: [{ locale: "HY", name: "A" }] },
      ];
      delegate.findMany.mockImplementation((query) =>
        Promise.resolve(fixtureList(rows, query)),
      );
      delegate.count.mockResolvedValue(3);
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/${resource}?sort=name&pageSize=2`)
        .set("Cookie", cookies())
        .expect(200);
      expect((response.body as ListBody).items.map((item) => item.id)).toEqual([
        "a",
        "b",
      ]);
      expect(response.body.meta).toEqual({
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      });
      expect(delegate.findMany.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({ where: {}, select: expect.any(Object) }),
      );
      expect(delegate.findMany.mock.calls[0]?.[0]).not.toHaveProperty(
        "include",
      );
    },
  );

  it.each(["products", "categories", "brands"])(
    "omits disappeared %s rows from the selected name page without changing total",
    async (resource) => {
      const delegate =
        resource === "products"
          ? prisma.product
          : resource === "categories"
            ? prisma.category
            : prisma.brand;
      const rows = [
        { id: "b", translations: [{ locale: "HY", name: "B" }] },
        { id: "a", translations: [{ locale: "HY", name: "A" }] },
      ];
      delegate.count.mockResolvedValue(2);
      delegate.findMany.mockImplementation((query) =>
        Promise.resolve(
          fixtureList(
            query.select ? rows : rows.filter((row) => row.id !== "a"),
            query,
          ),
        ),
      );
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/${resource}?sort=name&pageSize=2`)
        .set("Cookie", cookies())
        .expect(200);
      expect((response.body as ListBody).items.map((item) => item.id)).toEqual([
        "b",
      ]);
      expect(response.body.meta).toEqual({
        page: 1,
        pageSize: 2,
        total: 2,
        totalPages: 1,
      });
    },
  );

  it("returns controlled conflict on brand transaction serialization failure", async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: "P2034" });
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/brands/${childId}`)
      .set("Cookie", cookies())
      .set("x-csrf-token", csrf)
      .expect(409);
  });

  it("preserves product deletion FK conflicts as controlled 409", async () => {
    prisma.product.delete.mockRejectedValueOnce({ code: "P2003" });
    await request(app.getHttpServer())
      .delete("/api/v1/admin/products/p1")
      .set("Cookie", cookies())
      .set("x-csrf-token", csrf)
      .expect(409);
  });

  it.each(["products", "categories", "brands"])(
    "rejects %s mutation without CSRF",
    async (resource) => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/${resource}`)
        .set("Cookie", cookies())
        .send({})
        .expect(403);
    },
  );

  it.each(["categories", "brands"])(
    "retains %s creation defaults",
    async (resource) => {
      const delegate =
        resource === "categories" ? prisma.category : prisma.brand;
      await request(app.getHttpServer())
        .post(`/api/v1/admin/${resource}`)
        .set("Cookie", cookies())
        .set("x-csrf-token", csrf)
        .send({
          slug: "default-entity",
          ...(resource === "categories"
            ? { code: "default-entity", parentId: categoryId }
            : { name: "Default Brand" }),
          translations: [{ locale: "HY", name: "Default" }],
        })
        .expect(201);
      const data = delegate.create.mock.calls[0]?.[0].data as Record<
        string,
        unknown
      >;
      expect(data.published).toBe(true);
      if (resource === "categories") expect(data.displayOrder).toBe(0);
    },
  );

  it.each(["categories", "brands"])(
    "fetches %s by id and rejects missing ids",
    async (resource) => {
      const id = resource === "categories" ? categoryId : brandId;
      await request(app.getHttpServer())
        .get(`/api/v1/admin/${resource}/${id}`)
        .set("Cookie", cookies())
        .expect(200)
        .expect(({ body }) => expect(body.id).toBe(id));
      await request(app.getHttpServer())
        .get(`/api/v1/admin/${resource}/64d3f1a3-8413-4bc6-b32d-437871a22b54`)
        .set("Cookie", cookies())
        .expect(404);
    },
  );

  it("rejects deleting a brand with products instead of setting brandId null", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/brands/${brandId}`)
      .set("Cookie", cookies())
      .set("x-csrf-token", csrf)
      .expect(409);
    expect(prisma.brand.delete).not.toHaveBeenCalled();
    expect(prisma.product.count).toHaveBeenCalledWith({ where: { brandId } });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("allows deletion of an unused brand", async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/brands/${childId}`)
      .set("Cookie", cookies())
      .set("x-csrf-token", csrf)
      .expect(204);
    expect(prisma.brand.delete).toHaveBeenCalledWith({
      where: { id: childId },
    });
  });

  it("maps category foreign key deletion failures to conflict", async () => {
    prisma.category.delete.mockRejectedValueOnce({ code: "P2003" });
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/categories/${categoryId}`)
      .set("Cookie", cookies())
      .set("x-csrf-token", csrf)
      .expect(409);
    expect(prisma.product.delete).not.toHaveBeenCalled();
  });

  it("prevents reparenting a category beneath its own descendant", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${categoryId}`)
      .set("Cookie", cookies())
      .set("x-csrf-token", csrf)
      .send({ parentId: childId })
      .expect(409);
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it("prevents reparenting a child into a third root", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${childId}`)
      .set("Cookie", cookies())
      .set("x-csrf-token", csrf)
      .send({ parentId: null })
      .expect(409);
  });

  it("rejects self-parenting and missing category parents", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${childId}`)
      .set("Cookie", cookies())
      .set("x-csrf-token", csrf)
      .send({ parentId: childId })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${childId}`)
      .set("Cookie", cookies())
      .set("x-csrf-token", csrf)
      .send({ parentId: "64d3f1a3-8413-4bc6-b32d-437871a22b54" })
      .expect(404);
  });

  it("keeps an existing root without treating it as a third root", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${categoryId}`)
      .set("Cookie", cookies())
      .set("x-csrf-token", csrf)
      .send({ parentId: null, displayOrder: 3 })
      .expect(200);
    expect(prisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { parentId: null, displayOrder: 3 } }),
    );
  });

  it.each(["categories", "brands"])(
    "does not reset omitted %s publication or ordering on PATCH",
    async (resource) => {
      const id = resource === "categories" ? categoryId : brandId;
      const delegate =
        resource === "categories" ? prisma.category : prisma.brand;
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/${resource}/${id}`)
        .set("Cookie", cookies())
        .set("x-csrf-token", csrf)
        .send({ translations: [{ locale: "HY", name: "Updated" }] })
        .expect(200);
      const data = delegate.update.mock.calls[0]?.[0].data as Record<
        string,
        unknown
      >;
      expect(data.published).toBeUndefined();
      expect(data.displayOrder).toBeUndefined();
      expect(data.translations).toBeDefined();
    },
  );

  it("preserves nullable product update fields", async () => {
    await request(app.getHttpServer())
      .patch("/api/v1/admin/products/p1")
      .set("Cookie", cookies())
      .set("x-csrf-token", csrf)
      .send({ price: null, brandId: null })
      .expect(200);
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { price: null, brand: { disconnect: true } },
      }),
    );
  });

  it.each(["products", "categories", "brands"])(
    "rejects duplicate %s translation locales on update",
    async (resource) => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/${resource}/${categoryId}`)
        .set("Cookie", cookies())
        .set("x-csrf-token", csrf)
        .send({
          translations: [
            { locale: "EN", name: "One" },
            { locale: "EN", name: "Two" },
          ],
        })
        .expect(400);
    },
  );

  it.each(["products", "categories", "brands"])(
    "rejects blank %s required translation names",
    async (resource) => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/${resource}/${categoryId}`)
        .set("Cookie", cookies())
        .set("x-csrf-token", csrf)
        .send({ translations: [{ locale: "EN", name: "   " }] })
        .expect(400);
    },
  );

  it.each([
    ["products", "p1", { sku: "   " }],
    ["brands", brandId, { name: "   " }],
    ["products", "p1", { sku: null }],
    ["brands", brandId, { name: null }],
    ["products", "p1", { translations: [null] }],
  ])(
    "rejects invalid required text for %s %s %j",
    async (resource, id, payload) => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/${resource}/${id}`)
        .set("Cookie", cookies())
        .set("x-csrf-token", csrf)
        .send(payload)
        .expect(400);
    },
  );

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
