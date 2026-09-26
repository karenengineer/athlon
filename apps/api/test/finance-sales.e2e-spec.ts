import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { Prisma } from "../src/generated/prisma/client";

const adminId = "55c20c13-3b51-44fb-a6ff-33fe765d29bb";
const productId = "85c20c13-3b51-44fb-a6ff-33fe765d29bb";
const otherProductId = "95c20c13-3b51-44fb-a6ff-33fe765d29bb";
const limitedProductId = "a5c20c13-3b51-44fb-a6ff-33fe765d29bb";
const scarceProductId = "b5c20c13-3b51-44fb-a6ff-33fe765d29bb";
const categoryId = "c5c20c13-3b51-44fb-a6ff-33fe765d29bb";
const otherCategoryId = "d5c20c13-3b51-44fb-a6ff-33fe765d29bb";
const csrf = "known-csrf-token";

describe("Finance sales", () => {
  let app: INestApplication;
  let accessToken: string;
  let transaction: jest.Mock;
  const sales: Array<Record<string, unknown>> = [];

  beforeAll(async () => {
    accessToken = await new JwtService().signAsync(
      {
        sub: adminId,
        email: "admin@athlon.test",
        role: "ADMIN",
        type: "access",
      },
      {
        secret: "test-access-secret-with-at-least-32-characters",
        expiresIn: 900,
      },
    );
    const purchaseItems = [
      productId,
      otherProductId,
      limitedProductId,
      scarceProductId,
    ].map((stockProductId, index) => ({
      id: `purchase-item-${index + 1}`,
      productId: stockProductId,
      quantity:
        stockProductId === limitedProductId
          ? 1
          : stockProductId === scarceProductId
            ? 3
            : 10,
      purchaseUnitPrice: new Prisma.Decimal(index === 0 ? 12000 : 8000),
      purchase: {
        date: new Date("2026-09-20T00:00:00.000Z"),
        createdAt: new Date("2026-09-20T10:00:00.000Z"),
      },
    }));
    const productFor = (id: unknown) => ({
      id,
      sku: id === productId ? "WHEY-1" : "BELT-1",
      translations: [
        {
          locale: "EN",
          name: id === productId ? "Whey Protein" : "Training Belt",
        },
      ],
      category: {
        id: id === productId ? categoryId : otherCategoryId,
        translations: [],
      },
    });
    const matchesSale = (
      sale: Record<string, unknown>,
      where: Record<string, unknown> = {},
    ): boolean => {
      const date = where.date as { gte?: Date; lte?: Date } | undefined;
      if (date?.gte && (sale.date as Date) < date.gte) return false;
      if (date?.lte && (sale.date as Date) > date.lte) return false;
      if (where.channel && sale.channel !== where.channel) return false;
      if (
        where.trainerReferralCode &&
        sale.trainerReferralCode !== where.trainerReferralCode
      )
        return false;
      const some = (
        where.items as { some?: Record<string, unknown> } | undefined
      )?.some;
      const items = sale.items as Array<Record<string, unknown>>;
      if (
        some?.productId &&
        !items.some((item) => item.productId === some.productId)
      )
        return false;
      const category = (some?.product as { categoryId?: string } | undefined)
        ?.categoryId;
      if (
        category &&
        !items.some(
          (item) => productFor(item.productId).category.id === category,
        )
      )
        return false;
      const or = where.OR as
        | Array<{ saleNumber?: { contains?: string } }>
        | undefined;
      const query = or?.[0]?.saleNumber?.contains?.toLowerCase();
      if (
        query &&
        ![
          sale.saleNumber,
          sale.orderId,
          sale.customerName,
          sale.customerPhone,
        ].some(
          (value) =>
            typeof value === "string" && value.toLowerCase().includes(query),
        ) &&
        !items.some((item) => {
          const product = productFor(item.productId);
          return (
            product.sku.toLowerCase().includes(query) ||
            product.translations.some((translation) =>
              translation.name.toLowerCase().includes(query),
            )
          );
        })
      )
        return false;
      return true;
    };
    const orderSales = (
      rows: Array<Record<string, unknown>>,
      orderBy?: Array<Record<string, "asc" | "desc">>,
    ) => {
      if (!orderBy) return rows;
      return [...rows].sort((left, right) => {
        for (const ordering of orderBy) {
          const [field, direction] = Object.entries(ordering)[0]!;
          const l = left[field] as string | Date;
          const r = right[field] as string | Date;
          if (l < r) return direction === "asc" ? -1 : 1;
          if (l > r) return direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    };
    let transactionTail = Promise.resolve();
    transaction = jest.fn((callback: (tx: unknown) => Promise<unknown>) => {
      const result = transactionTail.then(() => callback(prisma));
      transactionTail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    });
    const prisma: Record<string, unknown> = {
      $transaction: transaction,
      product: {
        count: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
          Promise.resolve(where.id.in.length),
        ),
      },
      purchaseItem: {
        findMany: jest.fn(({ where }: { where: { productId: string } }) =>
          Promise.resolve(
            purchaseItems.filter((item) => item.productId === where.productId),
          ),
        ),
      },
      saleItem: {
        findMany: jest.fn(({ where }: { where: { productId: string } }) =>
          Promise.resolve(
            sales.flatMap((sale) =>
              (sale.items as Array<Record<string, unknown>>)
                .filter((item) => item.productId === where.productId)
                .map((item) => ({
                  ...item,
                  sale: { date: sale.date, createdAt: sale.createdAt },
                })),
            ),
          ),
        ),
        updateMany: jest.fn(
          ({
            where: { id },
            data: { costUnitSnapshot },
          }: {
            where: { id: string };
            data: { costUnitSnapshot: Prisma.Decimal };
          }) => {
            let count = 0;
            for (const sale of sales) {
              for (const item of sale.items as Array<Record<string, unknown>>) {
                if (item.id === id) {
                  item.costUnitSnapshot = costUnitSnapshot;
                  count += 1;
                }
              }
            }
            return Promise.resolve({ count });
          },
        ),
      },
      sale: {
        count: jest.fn(
          ({ where = {} }: { where?: Record<string, unknown> } = {}) =>
            Promise.resolve(
              sales.filter((sale) => matchesSale(sale, where)).length,
            ),
        ),
        findMany: jest.fn(
          ({
            where = {},
            skip = 0,
            take,
            orderBy,
          }: {
            where?: Record<string, unknown>;
            skip?: number;
            take?: number;
            orderBy?: Array<Record<string, "asc" | "desc">>;
          } = {}) => {
            const rows = orderSales(
              sales.filter((sale) => matchesSale(sale, where)),
              orderBy,
            );
            return Promise.resolve(
              rows.slice(skip, take ? skip + take : undefined),
            );
          },
        ),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          const items = data.items as {
            create: Array<Record<string, unknown>>;
          };
          const sale = {
            ...data,
            updatedAt: data.createdAt,
            createdByAdmin: { id: adminId, email: "admin@athlon.test" },
            items: items.create.map((item) => ({
              ...item,
              saleId: data.id,
              product: productFor(item.productId),
            })),
          };
          sales.push(sale);
          return Promise.resolve(sale);
        }),
        findUnique: jest.fn(({ where: { id } }: { where: { id: string } }) =>
          Promise.resolve(sales.find((sale) => sale.id === id) ?? null),
        ),
        update: jest.fn(
          ({
            where: { id },
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown> & {
              items?: {
                deleteMany: unknown;
                create: Array<Record<string, unknown>>;
              };
            };
          }) => {
            const index = sales.findIndex((sale) => sale.id === id);
            const current = sales[index]!;
            const nextItems = data.items
              ? data.items.create.map((item) => ({
                  ...item,
                  saleId: id,
                  product: productFor(item.productId),
                }))
              : current.items;
            const fields: Record<string, unknown> = { ...data };
            delete fields.items;
            const next = { ...current, ...fields, items: nextItems };
            sales[index] = next;
            return Promise.resolve(next);
          },
        ),
        delete: jest.fn(({ where: { id } }: { where: { id: string } }) => {
          const index = sales.findIndex((sale) => sale.id === id);
          return Promise.resolve(sales.splice(index, 1)[0]);
        }),
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = configureApplication(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => app?.close());

  it("uses the inventory cost snapshot to calculate sale profit", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/admin/finance/sales")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({
        date: "2026-09-21",
        channel: "DIRECT",
        items: [{ productId, quantity: 1, actualUnitPrice: "15000" }],
      })
      .expect(201);

    expect(response.body.items[0]).toMatchObject({
      netRevenue: "15000",
      costOfGoodsSold: "12000",
      grossProfit: "3000",
      grossMarginPercent: "20",
    });
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it("creates one sale for multiple products and subtracts each line discount once", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/admin/finance/sales")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({
        date: "2026-09-21",
        channel: "GYM",
        items: [
          {
            productId,
            quantity: 2,
            actualUnitPrice: "15000",
            lineDiscount: "1000",
          },
          { productId: otherProductId, quantity: 1, actualUnitPrice: "10000" },
        ],
      })
      .expect(201);

    expect(response.body.items).toHaveLength(2);
    expect(response.body.totalNetRevenue).toBe("39000");
  });

  it("reads a sale by id", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/finance/sales")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({
        date: "2026-09-21",
        channel: "DIRECT",
        items: [{ productId, quantity: 1, actualUnitPrice: "15000" }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/admin/finance/sales/${created.body.id}`)
      .set("Cookie", [`athlon_access=${accessToken}`])
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(created.body.id));
  });

  it("lists sales as distinct orders", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/admin/finance/sales?page=1&pageSize=100")
      .set("Cookie", [`athlon_access=${accessToken}`])
      .expect(200);

    expect(response.body.meta.total).toBe(sales.length);
    expect(response.body.items).toHaveLength(sales.length);
  });

  it("updates and deletes a sale through the ledger-backed routes", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/finance/sales")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({
        date: "2026-09-21",
        channel: "DIRECT",
        customerName: "Original",
        items: [{ productId, quantity: 1, actualUnitPrice: "15000" }],
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/admin/finance/sales/${created.body.id}`)
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({
        customerName: "  ",
        items: [
          { productId: otherProductId, quantity: 1, actualUnitPrice: "11000" },
        ],
      })
      .expect(200);
    expect(updated.body.customerName).toBeNull();
    expect(updated.body.items).toHaveLength(1);
    expect(updated.body.items[0].productId).toBe(otherProductId);

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/finance/sales/${created.body.id}`)
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .expect(204);
  });

  it("allows only one of two concurrent sales when one unit is in stock", async () => {
    const sendSale = () =>
      request(app.getHttpServer())
        .post("/api/v1/admin/finance/sales")
        .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
        .set("x-csrf-token", csrf)
        .send({
          date: "2026-09-21",
          channel: "DIRECT",
          items: [
            {
              productId: limitedProductId,
              quantity: 1,
              actualUnitPrice: "100",
            },
          ],
        });

    const responses = await Promise.all([sendSale(), sendSale()]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 400,
    ]);
    const soldQuantity = sales
      .flatMap((sale) => sale.items as Array<Record<string, unknown>>)
      .filter((item) => item.productId === limitedProductId)
      .reduce((sum, item) => sum + Number(item.quantity), 0);
    expect(soldQuantity).toBe(1);
  });

  it("returns the exact available quantity when a sale exceeds stock", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/admin/finance/sales")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({
        date: "2026-09-21",
        channel: "DIRECT",
        items: [
          { productId: scarceProductId, quantity: 5, actualUnitPrice: "100" },
        ],
      })
      .expect(400);
    expect(response.body.message).toBe("Only 3 units are currently available.");
  });

  it.each([
    [
      "duplicate products",
      [
        { productId, quantity: 1, actualUnitPrice: "100" },
        { productId, quantity: 1, actualUnitPrice: "100" },
      ],
      "DIRECT",
    ],
    [
      "zero quantity",
      [{ productId, quantity: 0, actualUnitPrice: "100" }],
      "DIRECT",
    ],
    [
      "negative price",
      [{ productId, quantity: 1, actualUnitPrice: "-1" }],
      "DIRECT",
    ],
    [
      "negative discount",
      [{ productId, quantity: 1, actualUnitPrice: "100", lineDiscount: "-1" }],
      "DIRECT",
    ],
    [
      "discount above line revenue",
      [{ productId, quantity: 2, actualUnitPrice: "100", lineDiscount: "201" }],
      "DIRECT",
    ],
    [
      "unknown channel",
      [{ productId, quantity: 1, actualUnitPrice: "100" }],
      "PHONE",
    ],
  ])("rejects %s before persistence", async (_name, items, channel) => {
    const countBefore = sales.length;
    await request(app.getHttpServer())
      .post("/api/v1/admin/finance/sales")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({ date: "2026-09-21", channel, items })
      .expect(400);
    expect(sales).toHaveLength(countBefore);
  });

  it("normalizes optional text and prevents clients forging website source metadata", async () => {
    const created = await request(app.getHttpServer())
      .post("/api/v1/admin/finance/sales")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({
        date: "2026-09-21",
        orderId: " ",
        customerName: " ",
        customerPhone: " ",
        trainerReferralCode: " ",
        notes: " ",
        channel: "DIRECT",
        items: [{ productId, quantity: 1, actualUnitPrice: "100" }],
      })
      .expect(201);
    expect(created.body).toMatchObject({
      orderId: null,
      sourceType: "MANUAL",
      sourceId: null,
      customerName: null,
      customerPhone: null,
      trainerReferralCode: null,
      notes: null,
    });

    await request(app.getHttpServer())
      .post("/api/v1/admin/finance/sales")
      .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
      .set("x-csrf-token", csrf)
      .send({
        date: "2026-09-21",
        channel: "WEBSITE",
        sourceType: "WEBSITE_ORDER",
        sourceId: "order-123",
        items: [{ productId, quantity: 1, actualUnitPrice: "100" }],
      })
      .expect(400);
  });

  it("protects reads and requires CSRF on writes", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/finance/sales")
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/admin/finance/sales")
      .set("Cookie", [`athlon_access=${accessToken}`])
      .send({
        date: "2026-09-21",
        channel: "DIRECT",
        items: [{ productId, quantity: 1, actualUnitPrice: "100" }],
      })
      .expect(403);
  });

  it("filters, searches, sorts, and paginates sale orders", async () => {
    const create = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post("/api/v1/admin/finance/sales")
        .set("Cookie", [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`])
        .set("x-csrf-token", csrf)
        .send(body)
        .expect(201);
    const first = await create({
      date: "2026-10-01",
      orderId: "ORDER-ALPHA",
      channel: "TRAINER",
      trainerReferralCode: "COACH-RED",
      customerName: "Customer Alpha",
      items: [{ productId, quantity: 1, actualUnitPrice: "20000" }],
    });
    const second = await create({
      date: "2026-10-02",
      orderId: "ORDER-BETA",
      channel: "INSTAGRAM",
      customerName: "Customer Beta",
      items: [
        { productId: otherProductId, quantity: 1, actualUnitPrice: "1000" },
      ],
    });
    const cases: Array<[string, string]> = [
      ["dateFrom=2026-10-01&dateTo=2026-10-01", first.body.id],
      [
        `dateFrom=2026-10-01&dateTo=2026-10-02&productId=${otherProductId}`,
        second.body.id,
      ],
      [
        `dateFrom=2026-10-01&dateTo=2026-10-02&categoryId=${categoryId}`,
        first.body.id,
      ],
      ["channel=TRAINER", first.body.id],
      ["trainerReferralCode=COACH-RED", first.body.id],
      ["q=Customer%20Alpha", first.body.id],
      ["q=ORDER-BETA", second.body.id],
    ];
    for (const [query, expectedId] of cases) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/finance/sales?${query}`)
        .set("Cookie", [`athlon_access=${accessToken}`])
        .expect(200);
      const body = response.body as { items: Array<{ id: string }> };
      expect(body.items.map((sale) => sale.id)).toEqual([expectedId]);
    }

    const newest = await request(app.getHttpServer())
      .get(
        "/api/v1/admin/finance/sales?dateFrom=2026-10-01&dateTo=2026-10-02&sort=dateDesc&page=1&pageSize=1",
      )
      .set("Cookie", [`athlon_access=${accessToken}`])
      .expect(200);
    expect(newest.body.items[0].id).toBe(second.body.id);
    expect(newest.body.meta).toMatchObject({ total: 2, totalPages: 2 });

    const lowestRevenue = await request(app.getHttpServer())
      .get(
        "/api/v1/admin/finance/sales?dateFrom=2026-10-01&dateTo=2026-10-02&sort=revenueAsc&page=1&pageSize=1",
      )
      .set("Cookie", [`athlon_access=${accessToken}`])
      .expect(200);
    expect(lowestRevenue.body.items[0].id).toBe(second.body.id);
  });
});
