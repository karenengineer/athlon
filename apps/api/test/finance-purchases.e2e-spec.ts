import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { Prisma } from "../src/generated/prisma/client";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { InventoryLedgerService } from "../src/finance/inventory/inventory-ledger.service";

const adminId = "55c20c13-3b51-44fb-a6ff-33fe765d29bb";
const supplierId = "65c20c13-3b51-44fb-a6ff-33fe765d29bb";
const otherSupplierId = "75c20c13-3b51-44fb-a6ff-33fe765d29bb";
const productId = "85c20c13-3b51-44fb-a6ff-33fe765d29bb";
const otherProductId = "95c20c13-3b51-44fb-a6ff-33fe765d29bb";
const categoryId = "a5c20c13-3b51-44fb-a6ff-33fe765d29bb";
const otherCategoryId = "b5c20c13-3b51-44fb-a6ff-33fe765d29bb";
const csrf = "known-csrf-token";

type Row = Record<string, unknown>;

type SupplierRow = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};
type ProductRow = {
  id: string;
  sku: string;
  categoryId: string;
  translations: { locale: string; name: string }[];
  category: { id: string; code: string };
};
type PurchaseItemRow = {
  id: string;
  purchaseId: string;
  productId: string;
  quantity: number;
  purchaseUnitPrice: Prisma.Decimal;
};
type PurchaseRow = {
  id: string;
  purchaseNumber: string;
  date: Date;
  supplierId: string;
  notes: string | null;
  createdByAdminId: string;
  importKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: PurchaseItemRow[];
};
type HydratedPurchase = Omit<PurchaseRow, "items"> & {
  supplier: SupplierRow | undefined;
  createdByAdmin: { id: string; email: string };
  items: (PurchaseItemRow & { product: ProductRow | undefined })[];
};
type PurchaseWhere = {
  supplierId?: string;
  date?: { gte?: Date; lte?: Date };
  items?: {
    some?: { productId?: string; product?: { categoryId?: string } };
  };
  OR?: { purchaseNumber?: { contains: string } }[];
};
type SupplierWhere = {
  active?: boolean;
  OR?: Record<string, { contains: string }>[];
};
type OrderBy = Record<string, "asc" | "desc">[];
type PurchaseCreateData = Omit<PurchaseRow, "updatedAt" | "items"> & {
  items: {
    create: Array<
      Omit<PurchaseItemRow, "purchaseId" | "purchaseUnitPrice"> & {
        purchaseUnitPrice: ConstructorParameters<typeof Prisma.Decimal>[0];
      }
    >;
  };
};
type PurchaseUpdateData = Partial<
  Pick<PurchaseRow, "date" | "supplierId" | "notes">
> & {
  items?: {
    deleteMany: Row;
    create: PurchaseCreateData["items"]["create"];
  };
};
type ListBody = {
  items: { id: string }[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

function makePrismaMock() {
  const suppliers: SupplierRow[] = [
    {
      id: supplierId,
      name: "Primary Supplier",
      contactName: "Ani",
      phone: null,
      email: "ani@example.com",
      notes: null,
      active: true,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    {
      id: otherSupplierId,
      name: "Backup Supplier",
      contactName: null,
      phone: null,
      email: null,
      notes: null,
      active: false,
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
      updatedAt: new Date("2026-08-02T00:00:00.000Z"),
    },
  ];
  const products: ProductRow[] = [
    {
      id: productId,
      sku: "WHEY-1",
      categoryId,
      translations: [{ locale: "EN", name: "Whey Protein" }],
      category: { id: categoryId, code: "nutrition" },
    },
    {
      id: otherProductId,
      sku: "BELT-1",
      categoryId: otherCategoryId,
      translations: [{ locale: "EN", name: "Training Belt" }],
      category: { id: otherCategoryId, code: "equipment" },
    },
  ];
  const admin = { id: adminId, email: "admin@athlon.test" };
  const purchases: PurchaseRow[] = [];

  const hydratePurchase = (purchase: PurchaseRow): HydratedPurchase => ({
    ...purchase,
    supplier: suppliers.find((supplier) => supplier.id === purchase.supplierId),
    createdByAdmin: admin,
    items: purchase.items.map((item) => ({
      ...item,
      product: products.find((product) => product.id === item.productId),
    })),
  });

  const matchesPurchase = (
    purchase: PurchaseRow,
    where: PurchaseWhere = {},
  ): boolean => {
    if (where.supplierId && purchase.supplierId !== where.supplierId)
      return false;
    if (where.date?.gte && purchase.date < where.date.gte) return false;
    if (where.date?.lte && purchase.date > where.date.lte) return false;
    const hydrated = hydratePurchase(purchase);
    if (where.items?.some?.productId) {
      if (
        !purchase.items.some(
          (item) => item.productId === where.items?.some?.productId,
        )
      )
        return false;
    }
    if (where.items?.some?.product?.categoryId) {
      if (
        !hydrated.items.some(
          (item) =>
            item.product?.categoryId === where.items?.some?.product?.categoryId,
        )
      )
        return false;
    }
    if (where.OR) {
      const query = String(where.OR[0]?.purchaseNumber?.contains).toLowerCase();
      if (
        !purchase.purchaseNumber.toLowerCase().includes(query) &&
        !hydrated.items.some(
          (item) =>
            item.product?.sku.toLowerCase().includes(query) ||
            item.product?.translations.some((translation) =>
              translation.name.toLowerCase().includes(query),
            ),
        )
      )
        return false;
    }
    return true;
  };

  const orderRows = <T extends object>(
    rows: T[],
    orderBy: OrderBy | undefined,
  ): T[] => {
    if (!orderBy) return rows;
    return [...rows].sort((left, right) => {
      for (const ordering of orderBy) {
        const [field, direction] = Object.entries(ordering)[0] as [
          string,
          "asc" | "desc",
        ];
        const l = (left as Row)[field] as string | number | Date;
        const r = (right as Row)[field] as string | number | Date;
        if (l < r) return direction === "asc" ? -1 : 1;
        if (l > r) return direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  };

  const matchesSupplier = (
    supplier: SupplierRow,
    where: SupplierWhere,
  ): boolean =>
    (where.active === undefined || supplier.active === where.active) &&
    (!where.OR ||
      where.OR.some((condition) => {
        const [field, filter] = Object.entries(condition)[0]!;
        const value = (supplier as unknown as Row)[field];
        return (
          typeof value === "string" &&
          value.toLowerCase().includes(filter.contains.toLowerCase())
        );
      }));

  const transaction = jest.fn();
  const prisma = {
    suppliers,
    products,
    purchases,
    $transaction: transaction,
    supplier: {
      count: jest.fn(({ where = {} }: { where?: SupplierWhere } = {}) =>
        Promise.resolve(
          suppliers.filter((supplier) => matchesSupplier(supplier, where))
            .length,
        ),
      ),
      findMany: jest.fn(
        ({
          where = {},
          skip = 0,
          take,
          orderBy,
        }: {
          where?: SupplierWhere;
          skip?: number;
          take?: number;
          orderBy?: OrderBy;
        } = {}) => {
          const rows = suppliers.filter((supplier) =>
            matchesSupplier(supplier, where),
          );
          return Promise.resolve(
            orderRows(rows, orderBy).slice(
              skip,
              take ? skip + take : undefined,
            ),
          );
        },
      ),
      findUnique: jest.fn(
        ({ where: { id } }: { where: { id: string }; select?: Row }) =>
          Promise.resolve(
            suppliers.find((supplier) => supplier.id === id) ?? null,
          ),
      ),
      create: jest.fn(
        ({
          data,
        }: {
          data: Omit<SupplierRow, "id" | "createdAt" | "updatedAt">;
        }) => {
          if (
            suppliers.some(
              (supplier) =>
                supplier.name.trim().toLowerCase() ===
                data.name.trim().toLowerCase(),
            )
          )
            return Promise.reject(
              Object.assign(new Error("duplicate supplier"), { code: "P2002" }),
            );
          const row: SupplierRow = {
            id: "c5c20c13-3b51-44fb-a6ff-33fe765d29bb",
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          suppliers.push(row);
          return Promise.resolve(row);
        },
      ),
      update: jest.fn(
        ({
          where: { id },
          data,
        }: {
          where: { id: string };
          data: Partial<Omit<SupplierRow, "id" | "createdAt" | "updatedAt">>;
        }) => {
          const index = suppliers.findIndex((supplier) => supplier.id === id);
          const current = suppliers[index];
          if (!current)
            return Promise.reject(
              Object.assign(new Error("missing"), { code: "P2025" }),
            );
          const next = { ...current, ...data, updatedAt: new Date() };
          suppliers[index] = next;
          return Promise.resolve(next);
        },
      ),
      delete: jest.fn(({ where: { id } }: { where: { id: string } }) => {
        if (purchases.some((purchase) => purchase.supplierId === id))
          return Promise.reject(
            Object.assign(new Error("referenced"), { code: "P2003" }),
          );
        const index = suppliers.findIndex((supplier) => supplier.id === id);
        if (index < 0)
          return Promise.reject(
            Object.assign(new Error("missing"), { code: "P2025" }),
          );
        return Promise.resolve(suppliers.splice(index, 1)[0]);
      }),
    },
    product: {
      count: jest.fn(
        ({
          where: {
            id: { in: ids },
          },
        }: {
          where: { id: { in: string[] } };
        }) =>
          Promise.resolve(
            products.filter((product) => ids.includes(product.id)).length,
          ),
      ),
      findMany: jest.fn(
        ({
          where: {
            id: { in: ids },
          },
        }: {
          where: { id: { in: string[] } };
        }) =>
          Promise.resolve(
            products.filter((product) => ids.includes(product.id)),
          ),
      ),
    },
    purchase: {
      count: jest.fn(({ where = {} }: { where?: PurchaseWhere } = {}) =>
        Promise.resolve(
          purchases.filter((purchase) => matchesPurchase(purchase, where))
            .length,
        ),
      ),
      findMany: jest.fn(
        ({
          where = {},
          skip = 0,
          take,
          orderBy,
        }: {
          where?: PurchaseWhere;
          skip?: number;
          take?: number;
          orderBy?: OrderBy;
          include?: Row;
        } = {}) => {
          const rows = orderRows(
            purchases.filter((purchase) => matchesPurchase(purchase, where)),
            orderBy,
          );
          return Promise.resolve(
            rows
              .slice(skip, take ? skip + take : undefined)
              .map(hydratePurchase),
          );
        },
      ),
      findUnique: jest.fn(
        ({ where: { id } }: { where: { id: string }; include?: Row }) => {
          const purchase = purchases.find((candidate) => candidate.id === id);
          return Promise.resolve(purchase ? hydratePurchase(purchase) : null);
        },
      ),
      create: jest.fn(
        ({ data }: { data: PurchaseCreateData; include?: Row }) => {
          const row: PurchaseRow = {
            id: data.id,
            purchaseNumber: data.purchaseNumber,
            date: data.date,
            supplierId: data.supplierId,
            notes: data.notes ?? null,
            createdByAdminId: data.createdByAdminId,
            importKey: data.importKey ?? null,
            createdAt: data.createdAt,
            updatedAt: data.createdAt,
            items: data.items.create.map((item) => ({
              ...item,
              purchaseId: data.id,
              purchaseUnitPrice: new Prisma.Decimal(item.purchaseUnitPrice),
            })),
          };
          purchases.push(row);
          return Promise.resolve(hydratePurchase(row));
        },
      ),
      update: jest.fn(
        ({
          where: { id },
          data,
        }: {
          where: { id: string };
          data: PurchaseUpdateData;
          include?: Row;
        }) => {
          const index = purchases.findIndex((purchase) => purchase.id === id);
          const current = purchases[index];
          if (!current)
            return Promise.reject(
              Object.assign(new Error("missing"), { code: "P2025" }),
            );
          const items = data.items?.deleteMany
            ? data.items.create.map((item) => ({
                ...item,
                purchaseId: id,
                purchaseUnitPrice: new Prisma.Decimal(item.purchaseUnitPrice),
              }))
            : current.items;
          const next: PurchaseRow = {
            ...current,
            ...data,
            items,
            updatedAt: new Date(),
          };
          purchases[index] = next;
          return Promise.resolve(hydratePurchase(next));
        },
      ),
      delete: jest.fn(({ where: { id } }: { where: { id: string } }) => {
        const index = purchases.findIndex((purchase) => purchase.id === id);
        if (index < 0)
          return Promise.reject(
            Object.assign(new Error("missing"), { code: "P2025" }),
          );
        return Promise.resolve(purchases.splice(index, 1)[0]);
      }),
    },
    purchaseItem: { findMany: jest.fn(() => Promise.resolve([])) },
    saleItem: {
      findMany: jest.fn(() => Promise.resolve([])),
      updateMany: jest.fn(() => Promise.resolve({ count: 0 })),
    },
  };

  transaction.mockImplementation(
    (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
  );

  return prisma;
}

describe("Finance suppliers and purchases", () => {
  let app: INestApplication;
  let accessToken: string;
  let prisma: ReturnType<typeof makePrismaMock>;
  const ledger = {
    recalculateProducts: jest.fn(() => Promise.resolve(new Map())),
  };

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
    prisma = makePrismaMock();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(InventoryLedgerService)
      .useValue(ledger)
      .compile();
    app = configureApplication(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => app?.close());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.purchases.splice(0);
  });

  const cookies = () => [`athlon_access=${accessToken}`, `athlon_csrf=${csrf}`];
  const auth = (verb: "get" | "post" | "patch" | "delete", path: string) =>
    request(app.getHttpServer())[verb](path).set("Cookie", cookies());
  const purchaseInput = (overrides: Row = {}) => ({
    date: "2026-09-21",
    supplierId,
    notes: "Opening stock",
    items: [{ productId, quantity: 10, purchaseUnitPrice: "12000" }],
    ...overrides,
  });

  const createPurchase = async (overrides: Row = {}) =>
    auth("post", "/api/v1/admin/finance/purchases")
      .set("x-csrf-token", csrf)
      .send(purchaseInput(overrides))
      .expect(201);

  it.each(["suppliers", "purchases"])(
    "protects unauthenticated %s reads",
    async (resource) => {
      await request(app.getHttpServer())
        .get(`/api/v1/admin/finance/${resource}`)
        .expect(401);
    },
  );

  it.each(["suppliers", "purchases"])(
    "requires CSRF for authenticated %s writes",
    async (resource) => {
      await auth("post", `/api/v1/admin/finance/${resource}`)
        .send(
          resource === "suppliers" ? { name: "New Supplier" } : purchaseInput(),
        )
        .expect(403);
    },
  );

  it("rejects duplicate product lines before starting a transaction", async () => {
    await auth("post", "/api/v1/admin/finance/purchases")
      .set("x-csrf-token", csrf)
      .send(
        purchaseInput({
          items: [
            { productId, quantity: 1, purchaseUnitPrice: "100" },
            { productId, quantity: 2, purchaseUnitPrice: "200" },
          ],
        }),
      )
      .expect(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates a purchase for the authenticated admin and returns line totals", async () => {
    const created = await createPurchase({ createdByAdminId: undefined });
    expect(created.body.purchaseNumber).toMatch(/^PUR-20260921-[A-F0-9]{8}$/);
    expect(created.body.createdByAdminId).toBe(adminId);
    expect(created.body.items[0]).toMatchObject({
      quantity: 10,
      purchaseUnitPrice: "12000",
      totalPurchaseCost: "120000",
    });
    expect(created.body.totalPurchaseCost).toBe("120000");
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(ledger.recalculateProducts).toHaveBeenCalledWith(
      prisma,
      [productId],
      expect.objectContaining({ upsert: expect.any(Array) }),
    );
  });

  it("rejects a client-supplied audit owner", async () => {
    await auth("post", "/api/v1/admin/finance/purchases")
      .set("x-csrf-token", csrf)
      .send({ ...purchaseInput(), createdByAdminId: otherSupplierId })
      .expect(400);
  });

  it("supports supplier CRUD, normalized-name conflict, and referenced deletion protection", async () => {
    const listed = await auth(
      "get",
      "/api/v1/admin/finance/suppliers?active=false&q=backup&page=1&pageSize=1&sort=name",
    ).expect(200);
    expect(listed.body.meta).toEqual({
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    });
    expect(listed.body.items[0].id).toBe(otherSupplierId);

    const created = await auth("post", "/api/v1/admin/finance/suppliers")
      .set("x-csrf-token", csrf)
      .send({ name: "Third Supplier", active: true })
      .expect(201);
    await auth("patch", `/api/v1/admin/finance/suppliers/${created.body.id}`)
      .set("x-csrf-token", csrf)
      .send({ active: false })
      .expect(200)
      .expect(({ body }) => expect(body.active).toBe(false));
    await auth("post", "/api/v1/admin/finance/suppliers")
      .set("x-csrf-token", csrf)
      .send({ name: " primary supplier " })
      .expect(409);

    await createPurchase();
    await auth("delete", `/api/v1/admin/finance/suppliers/${supplierId}`)
      .set("x-csrf-token", csrf)
      .expect(409);
    await auth("patch", `/api/v1/admin/finance/suppliers/${supplierId}`)
      .set("x-csrf-token", csrf)
      .send({ active: false })
      .expect(200);
  });

  it("filters by date, product, category, supplier, number, SKU, and product name", async () => {
    const first = await createPurchase();
    const second = await createPurchase({
      date: "2026-09-22",
      supplierId: otherSupplierId,
      items: [
        { productId: otherProductId, quantity: 1, purchaseUnitPrice: "90000" },
      ],
    });
    const cases = [
      ["dateFrom=2026-09-22&dateTo=2026-09-22", second.body.id],
      [`productId=${productId}`, first.body.id],
      [`categoryId=${otherCategoryId}`, second.body.id],
      [`supplierId=${otherSupplierId}`, second.body.id],
      [`q=${encodeURIComponent(second.body.purchaseNumber)}`, second.body.id],
      ["q=BELT-1", second.body.id],
      ["q=Whey", first.body.id],
    ];
    for (const [query, expectedId] of cases) {
      const response = await auth(
        "get",
        `/api/v1/admin/finance/purchases?${query}`,
      ).expect(200);
      const body = response.body as ListBody;
      expect(body.items.map((item) => item.id)).toEqual([expectedId]);
    }
  });

  it("sorts by date and total and paginates after filtering", async () => {
    const first = await createPurchase({ date: "2026-09-20" });
    const second = await createPurchase({
      date: "2026-09-22",
      items: [{ productId, quantity: 1, purchaseUnitPrice: "50000" }],
    });
    const third = await createPurchase({
      date: "2026-09-21",
      items: [{ productId, quantity: 1, purchaseUnitPrice: "200000" }],
    });
    const newest = await auth(
      "get",
      "/api/v1/admin/finance/purchases?sort=dateDesc&page=1&pageSize=2",
    ).expect(200);
    const newestBody = newest.body as ListBody;
    expect(newestBody.items.map((item) => item.id)).toEqual([
      second.body.id,
      third.body.id,
    ]);
    expect(newest.body.meta).toEqual({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    const totals = await auth(
      "get",
      "/api/v1/admin/finance/purchases?sort=totalAsc&page=2&pageSize=2",
    ).expect(200);
    const totalsBody = totals.body as ListBody;
    expect(totalsBody.items.map((item) => item.id)).toEqual([third.body.id]);
    expect(first.body.totalPurchaseCost).toBe("120000");
  });

  it("reads, updates, and deletes purchases through proposed ledger mutations", async () => {
    const created = await createPurchase();
    await auth("get", `/api/v1/admin/finance/purchases/${created.body.id}`)
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(created.body.id));
    ledger.recalculateProducts.mockClear();
    const updated = await auth(
      "patch",
      `/api/v1/admin/finance/purchases/${created.body.id}`,
    )
      .set("x-csrf-token", csrf)
      .send({
        date: "2026-09-19",
        items: [
          { productId: otherProductId, quantity: 2, purchaseUnitPrice: "500" },
        ],
      })
      .expect(200);
    expect(updated.body.items[0]).toMatchObject({
      productId: otherProductId,
      totalPurchaseCost: "1000",
    });
    expect(ledger.recalculateProducts).toHaveBeenCalledWith(
      prisma,
      expect.arrayContaining([productId, otherProductId]),
      expect.objectContaining({
        upsert: expect.any(Array),
        deleteIds: expect.any(Array),
      }),
    );
    expect(ledger.recalculateProducts.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.purchase.update.mock.invocationCallOrder[0]!,
    );
    ledger.recalculateProducts.mockClear();
    await auth("delete", `/api/v1/admin/finance/purchases/${created.body.id}`)
      .set("x-csrf-token", csrf)
      .expect(204);
    expect(ledger.recalculateProducts).toHaveBeenCalledWith(
      prisma,
      [otherProductId],
      expect.objectContaining({ deleteIds: expect.any(Array) }),
    );
    expect(ledger.recalculateProducts.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.purchase.delete.mock.invocationCallOrder[0]!,
    );
  });

  it("does not persist a purchase edit rejected by ledger validation", async () => {
    const created = await createPurchase();
    prisma.purchase.update.mockClear();
    ledger.recalculateProducts.mockRejectedValueOnce(
      new Error("Only 0 units are currently available."),
    );
    await auth("patch", `/api/v1/admin/finance/purchases/${created.body.id}`)
      .set("x-csrf-token", csrf)
      .send({
        items: [{ productId, quantity: 1, purchaseUnitPrice: "12000" }],
      })
      .expect(400);
    expect(prisma.purchase.update).not.toHaveBeenCalled();
  });
});
