import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import sharp from "sharp";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { STORAGE_ADAPTER } from "../src/storage/storage-adapter";

const productId = "24d3f1a3-8413-4bc6-b32d-437871a22b54";
const imageId = "34d3f1a3-8413-4bc6-b32d-437871a22b54";
const foreignId = "44d3f1a3-8413-4bc6-b32d-437871a22b54";
type ImageRow = {
  id: string;
  productId: string;
  primary: boolean;
  position: number;
  [key: string]: unknown;
};

describe("Secure product media HTTP", () => {
  let app: INestApplication;
  let token: string;
  let png: Buffer;
  let rows: ImageRow[];
  let failStorage = false;
  const files = new Map<string, Buffer>();
  const storage = {
    put: (key: string, buffer: Buffer) => {
      if (failStorage && key.endsWith("-original.webp"))
        return Promise.reject(new Error("isolated storage failure"));
      if (failStorage)
        return new Promise<void>((resolve) =>
          setTimeout(() => {
            files.set(key, buffer);
            resolve();
          }, 20),
        );
      files.set(key, buffer);
      return Promise.resolve();
    },
    delete: (key: string) => {
      files.delete(key);
      return Promise.resolve();
    },
    read: (key: string) => Promise.resolve(files.get(key)),
  };
  const prisma = {
    product: { findUnique: jest.fn(() => Promise.resolve({ id: productId })) },
    productImage: {
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(rows.find((row) => row.id === where.id) ?? null),
      ),
      findMany: jest.fn(
        ({ where }: { where: { productId: string; id?: { in: string[] } } }) =>
          Promise.resolve(
            rows.filter(
              (row) =>
                row.productId === where.productId &&
                (!where.id?.in || where.id.in.includes(row.id)),
            ),
          ),
      ),
      aggregate: jest.fn(({ where }) =>
        Promise.resolve({
          _max: {
            position: Math.max(
              -1,
              ...rows
                .filter((row) => row.productId === where.productId)
                .map((row) => row.position),
            ),
          },
        }),
      ),
      create: jest.fn(({ data }) => {
        const row = { id: imageId, position: 0, ...data };
        rows.push(row);
        return Promise.resolve(row);
      }),
      updateMany: jest.fn(({ where, data }) => {
        rows
          .filter((row) => row.productId === where.productId)
          .forEach((row) => Object.assign(row, data));
        return Promise.resolve({ count: rows.length });
      }),
      update: jest.fn(({ where, data }) => {
        const row = rows.find(
          (row) =>
            row.id === where.id &&
            (!where.productId || row.productId === where.productId),
        );
        if (!row)
          return Promise.reject(
            Object.assign(new Error("Missing image"), { code: "P2025" }),
          );
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
      delete: jest.fn(({ where }) => {
        const row = rows.find((row) => row.id === where.id);
        rows = rows.filter((row) => row.id !== where.id);
        return Promise.resolve(row);
      }),
    },
    $transaction: jest.fn(
      async (
        operation: ((tx: unknown) => Promise<unknown>) | Promise<unknown>[],
      ): Promise<unknown> =>
        typeof operation === "function"
          ? operation(prisma)
          : Promise.all(operation),
    ),
  };
  beforeAll(async () => {
    token = await new JwtService().signAsync(
      {
        sub: foreignId,
        role: "ADMIN",
        type: "access",
        email: "test@athlon.test",
      },
      {
        secret: "test-access-secret-with-at-least-32-characters",
        expiresIn: 900,
      },
    );
    png = await sharp({
      create: { width: 32, height: 24, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(STORAGE_ADAPTER)
      .useValue(storage)
      .compile();
    app = configureApplication(module.createNestApplication());
    await app.init();
  });
  afterAll(async () => app?.close());
  beforeEach(() => {
    jest.clearAllMocks();
    files.clear();
    rows = [];
    failStorage = false;
  });
  const auth = (r: request.Test) =>
    r
      .set("Cookie", [`athlon_access=${token}`, "athlon_csrf=fixture-csrf"])
      .set("x-csrf-token", "fixture-csrf");
  const upload = (buffer: Buffer, contentType = "image/png") =>
    auth(
      request(app.getHttpServer()).post(
        `/api/v1/admin/products/${productId}/images`,
      ),
    )
      .field("altRu", "Изображение")
      .attach("file", buffer, { filename: "../../unsafe.png", contentType });

  it("rejects unauthorized and missing-CSRF uploads before any storage write", async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${productId}/images`)
      .attach("file", Buffer.from("<svg/>"), "fake.png")
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${productId}/images`)
      .set("Cookie", `athlon_access=${token}`)
      .field("altRu", "x")
      .attach("file", png, "image.png")
      .expect(403);
    expect(files.size).toBe(0);
    expect(rows).toEqual([]);
  });
  it("rejects SVG/HTML mislabeled as PNG without writing files", async () => {
    await upload(Buffer.from("<svg/>")).expect(400);
    expect(files.size).toBe(0);
  });
  it("rejects valid raster content whose declared type does not match", async () => {
    await upload(png, "image/jpeg").expect(400);
    expect(files.size).toBe(0);
  });
  it("returns controlled 400 for a PNG with valid metadata but corrupt pixels", async () => {
    const corrupt = Buffer.from(png);
    corrupt[png.indexOf("IDAT") + 4] = 0;
    expect((await sharp(corrupt).metadata()).width).toBe(32);
    await upload(corrupt).expect(400);
    expect(files.size).toBe(0);
  });
  it("rejects decompression-heavy and excessively wide rasters before writes", async () => {
    const heavy = await sharp({
      create: { width: 4097, height: 4097, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const wide = await sharp({
      create: { width: 8193, height: 1, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await upload(heavy).expect(400);
    await upload(wide).expect(400);
    expect(files.size).toBe(0);
  });
  it("enforces the exact multipart 5,242,880 byte maximum", async () => {
    await upload(Buffer.alloc(5_242_881)).expect(413);
    expect(files.size).toBe(0);
  });
  it("decodes allowed images into randomized safe webp variants and appends position with a single primary", async () => {
    rows = [{ id: foreignId, productId, position: 3, primary: true }];
    const response = await upload(png)
      .field("altHy", "Նկար")
      .field("altEn", "Image")
      .field("primary", "true")
      .expect(201);
    expect(response.body.position).toBe(4);
    expect(rows.filter((row) => row.primary)).toHaveLength(1);
    expect(files.size).toBe(4);
    for (const [key, buffer] of files) {
      expect(key).toMatch(
        /^[0-9a-f-]+-(original|thumbnail|card|detail)\.webp$/,
      );
      expect((await sharp(buffer).metadata()).format).toBe("webp");
    }
  });
  it("rejects duplicate reorder IDs without altering order", async () => {
    rows = [{ id: imageId, productId, primary: false, position: 7 }];
    await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/products/${productId}/images/order`,
      ),
    )
      .send({
        images: [
          { id: imageId, position: 0 },
          { id: imageId, position: 1 },
        ],
      })
      .expect(400);
    expect(rows[0]!.position).toBe(7);
  });
  it("waits for every variant write before cleanup after a partial storage failure", async () => {
    failStorage = true;
    await upload(png).expect(500);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(files.size).toBe(0);
    expect(rows).toEqual([]);
  });
  it("rejects malformed media product and image IDs before storage/ORM access", async () => {
    await auth(
      request(app.getHttpServer()).post(
        "/api/v1/admin/products/not-a-uuid/images",
      ),
    )
      .field("altRu", "x")
      .attach("file", png, "image.png")
      .expect(400);
    await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/products/${productId}/images/not-a-uuid`,
      ),
    )
      .send({ primary: true })
      .expect(400);
    expect(files.size).toBe(0);
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });
  it("rejects foreign reorder IDs before changing an owned image", async () => {
    rows = [
      { id: imageId, productId, primary: true, position: 7 },
      { id: foreignId, productId: foreignId, primary: false, position: 2 },
    ];
    await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/products/${productId}/images/order`,
      ),
    )
      .send({
        images: [
          { id: imageId, position: 0 },
          { id: foreignId, position: 1 },
        ],
      })
      .expect(404);
    expect(rows[0]!.position).toBe(7);
  });
  it("updates a primary and locale alt text together, and rejects foreign update/delete", async () => {
    rows = [
      { id: imageId, productId, primary: false, position: 0 },
      { id: foreignId, productId, primary: true, position: 1 },
    ];
    await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/products/${productId}/images/${imageId}`,
      ),
    )
      .send({ primary: true, altRu: "Новое", altHy: "Նոր" })
      .expect(200);
    expect(rows.filter((row) => row.primary).map((row) => row.id)).toEqual([
      imageId,
    ]);
    await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/products/${foreignId}/images/${imageId}`,
      ),
    )
      .send({ primary: true })
      .expect(404);
    await auth(
      request(app.getHttpServer()).delete(
        `/api/v1/admin/products/${foreignId}/images/${imageId}`,
      ),
    ).expect(404);
    expect(rows).toHaveLength(2);
  });
});
