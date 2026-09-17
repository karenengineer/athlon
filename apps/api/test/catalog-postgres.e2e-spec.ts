import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { LocalStorageAdapter } from "../src/storage/local-storage.adapter";
import { STORAGE_ADAPTER } from "../src/storage/storage-adapter";
import { cleanupOwnedResources } from "./isolated-cleanup";

const exec = promisify(execFile);
// Never accepts DATABASE_URL or an existing database. Opt-in creates its own
// uniquely named container, dedicated DB and loopback-only random port.
const integration =
  process.env.ATHLON_PG_INTEGRATION === "1" ? describe : describe.skip;
integration("Isolated actual PostgreSQL catalog acceptance", () => {
  const container = `athlon-task5-${randomUUID()}`;
  let created = false;
  let uploads: string | undefined;
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;
  let token: string;
  let categoryId: string;
  let brandId: string;
  let productId: string;
  let png: Buffer;
  const auth = (r: request.Test) =>
    r
      .set("Cookie", [`athlon_access=${token}`, "athlon_csrf=isolated-csrf"])
      .set("x-csrf-token", "isolated-csrf");
  const server = () => app!.getHttpServer();
  const categoryInput = (slug: string, parentId?: string) => ({
    code: slug,
    slug,
    parentId,
    published: false,
    displayOrder: 2,
    translations: [
      { locale: "HY", name: slug, description: null },
      { locale: "RU", name: `RU ${slug}`, seoTitle: null },
    ],
  });
  const productInput = (sku: string, extra = {}) => ({
    sku,
    slug: sku.toLowerCase(),
    categoryId,
    brandId,
    price: 10.5,
    availability: "ON_REQUEST",
    characteristics: { weight: "1kg" },
    featured: true,
    isNew: true,
    published: false,
    displayOrder: 3,
    translations: [
      { locale: "HY", name: sku, description: null, shortDescription: null },
      { locale: "RU", name: `RU ${sku}`, shortDescription: "Keep RU" },
    ],
    ...extra,
  });
  beforeAll(async () => {
    await exec("docker", [
      "run",
      "--detach",
      "--rm",
      "--name",
      container,
      "--label",
      "athlon.test=task5",
      "-e",
      "POSTGRES_USER=athlon_task5",
      "-e",
      "POSTGRES_PASSWORD=isolated-task5-only",
      "-e",
      "POSTGRES_DB=athlon_task5",
      "-p",
      "127.0.0.1::5432",
      "postgres:17-alpine",
    ]);
    created = true;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await exec("docker", [
          "exec",
          container,
          "pg_isready",
          "-U",
          "athlon_task5",
          "-d",
          "athlon_task5",
        ]);
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!ready) throw new Error("Isolated PostgreSQL did not start");
    const { stdout } = await exec("docker", ["port", container, "5432/tcp"]);
    const port = stdout.trim().match(/^127\.0\.0\.1:(\d+)$/)?.[1];
    if (!port) throw new Error("Expected isolated loopback database port");
    const url = `postgresql://athlon_task5:isolated-task5-only@127.0.0.1:${port}/athlon_task5`;
    await exec("pnpm", ["exec", "prisma", "migrate", "deploy"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: url },
      timeout: 60_000,
    });
    uploads = await mkdtemp(join(tmpdir(), "athlon-task5-media-"));
    prisma = new PrismaService(new ConfigService({ DATABASE_URL: url }));
    const storage = new LocalStorageAdapter(
      new ConfigService({ UPLOAD_DIR: uploads }),
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(STORAGE_ADAPTER)
      .useValue(storage)
      .compile();
    app = configureApplication(module.createNestApplication());
    await app.init();
    token = await new JwtService().signAsync(
      {
        sub: randomUUID(),
        email: "isolated@athlon.test",
        role: "ADMIN",
        type: "access",
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
  }, 120_000);
  afterAll(async () => {
    const ownedApp = app;
    const ownedPrisma = prisma;
    const ownedUploads = uploads;
    await cleanupOwnedResources([
      ...(ownedApp
        ? [{ label: "Nest app / Prisma", cleanup: () => ownedApp.close() }]
        : ownedPrisma
          ? [{ label: "Prisma", cleanup: () => ownedPrisma.onModuleDestroy() }]
          : []),
      ...(created
        ? [
            {
              label: `container ${container}`,
              cleanup: () =>
                exec("docker", ["stop", container], { timeout: 15_000 }),
            },
          ]
        : []),
      ...(ownedUploads
        ? [
            {
              label: `uploads ${ownedUploads}`,
              cleanup: () => rm(ownedUploads, { recursive: true, force: true }),
            },
          ]
        : []),
    ]);
  }, 30_000);

  it("persists category and brand CRUD, preserves omitted/null translations, and maps dependencies", async () => {
    const category = await auth(
      request(server()).post("/api/v1/admin/categories"),
    )
      .send(categoryInput("root-one"))
      .expect(201);
    categoryId = category.body.id;
    const brand = await auth(request(server()).post("/api/v1/admin/brands"))
      .send({
        slug: "acme",
        name: "ACME",
        published: false,
        logoKey: null,
        translations: [
          { locale: "HY", name: "ACME", description: null },
          { locale: "EN", name: "ACME EN" },
        ],
      })
      .expect(201);
    brandId = brand.body.id;
    await auth(
      request(server()).patch(`/api/v1/admin/categories/${categoryId}`),
    )
      .send({ translations: [{ locale: "HY", name: "Updated" }] })
      .expect(200);
    const loaded = await auth(
      request(server()).get(`/api/v1/admin/categories/${categoryId}`),
    ).expect(200);
    expect(loaded.body.published).toBe(false);
    expect(loaded.body.displayOrder).toBe(2);
    expect(loaded.body.translations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locale: "HY",
          name: "Updated",
          description: null,
        }),
        expect.objectContaining({
          locale: "RU",
          name: "RU root-one",
          seoTitle: null,
        }),
      ]),
    );
    await auth(request(server()).patch(`/api/v1/admin/brands/${brandId}`))
      .send({ name: "ACME updated" })
      .expect(200);
    const child = await auth(request(server()).post("/api/v1/admin/categories"))
      .send(categoryInput("child", categoryId))
      .expect(201);
    await auth(
      request(server()).delete(`/api/v1/admin/categories/${categoryId}`),
    ).expect(409);
    await auth(
      request(server()).patch(`/api/v1/admin/categories/${categoryId}`),
    )
      .send({ parentId: child.body.id })
      .expect(409);
    await auth(
      request(server()).delete(`/api/v1/admin/categories/${child.body.id}`),
    ).expect(204);
  });
  it("uses real serializable transactions to prevent concurrent third roots", async () => {
    const results = await Promise.all(
      ["root-two", "root-three"].map((slug) =>
        auth(request(server()).post("/api/v1/admin/categories")).send(
          categoryInput(slug),
        ),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await prisma!.category.count({ where: { parentId: null } })).toBe(2);
  });
  it("persists product create/PATCH/filter queries, preserves other locales and excludes drafts publicly", async () => {
    const createdProduct = await auth(
      request(server()).post("/api/v1/admin/products"),
    )
      .send(productInput("PROTEIN"))
      .expect(201);
    productId = createdProduct.body.id;
    const patched = await auth(
      request(server()).patch(`/api/v1/admin/products/${productId}`),
    )
      .send({
        price: null,
        translations: [{ locale: "HY", name: "Changed HY" }],
      })
      .expect(200);
    expect(patched.body.price).toBeNull();
    expect(patched.body.published).toBe(false);
    expect(patched.body.featured).toBe(true);
    expect(patched.body.isNew).toBe(true);
    expect(patched.body.displayOrder).toBe(3);
    expect(patched.body.characteristics).toEqual({ weight: "1kg" });
    expect(patched.body.translations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locale: "RU",
          name: "RU PROTEIN",
          shortDescription: "Keep RU",
        }),
        expect.objectContaining({
          locale: "HY",
          name: "Changed HY",
          shortDescription: null,
        }),
      ]),
    );
    const list = await auth(
      request(server()).get(
        `/api/v1/admin/products?categoryId=${categoryId}&brandId=${brandId}&published=false&featured=true&isNew=true&availability=ON_REQUEST&q=protein&sort=priceDesc&pageSize=1`,
      ),
    ).expect(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.items[0].id).toBe(productId);
    await request(server()).get("/api/v1/products/protein").expect(404);
    const publicList = await request(server())
      .get("/api/v1/products")
      .expect(200);
    expect(publicList.body.items).toEqual([]);
    await auth(
      request(server()).delete(`/api/v1/admin/categories/${categoryId}`),
    ).expect(409);
    await auth(
      request(server()).delete(`/api/v1/admin/brands/${brandId}`),
    ).expect(409);
  });
  it("maps actual product uniqueness/FK failures safely for create and PATCH", async () => {
    await auth(request(server()).post("/api/v1/admin/products"))
      .send(productInput("PROTEIN"))
      .expect(409);
    const second = await auth(request(server()).post("/api/v1/admin/products"))
      .send(productInput("SECOND"))
      .expect(201);
    await auth(
      request(server()).patch(`/api/v1/admin/products/${second.body.id}`),
    )
      .send({ sku: "PROTEIN" })
      .expect(409);
    await auth(request(server()).post("/api/v1/admin/products"))
      .send(productInput("FOREIGN", { categoryId: randomUUID() }))
      .expect(409);
    await auth(
      request(server()).patch(`/api/v1/admin/products/${second.body.id}`),
    )
      .send({ categoryId: randomUUID() })
      .expect(409);
    await auth(
      request(server()).delete(`/api/v1/admin/products/${second.body.id}`),
    ).expect(204);
  });
  it("keeps concurrent primary uploads consistent and rejects foreign reorders atomically", async () => {
    const results = await Promise.all(
      ["One", "Two"].map((alt) =>
        auth(
          request(server()).post(`/api/v1/admin/products/${productId}/images`),
        )
          .field("altRu", alt)
          .field("primary", "true")
          .attach("file", png, "safe.png"),
      ),
    );
    expect(results.every((result) => [201, 409].includes(result.status))).toBe(
      true,
    );
    expect(results.some((result) => result.status === 201)).toBe(true);
    expect(
      await prisma!.productImage.count({ where: { productId, primary: true } }),
    ).toBe(1);
    // Always provide a non-primary target, even if one concurrent upload loses
    // its serializable race, so the PATCH must actually switch primary state.
    const target = await auth(
      request(server()).post(`/api/v1/admin/products/${productId}/images`),
    )
      .field("altRu", "Keep persisted RU")
      .attach("file", png, "safe.png")
      .expect(201);
    const rows = await prisma!.productImage.findMany({ where: { productId } });
    expect(await readdir(uploads!)).toHaveLength(rows.length * 4);
    await auth(
      request(server()).patch(
        `/api/v1/admin/products/${productId}/images/order`,
      ),
    )
      .send({
        images: [
          { id: rows[0]!.id, position: 5 },
          { id: randomUUID(), position: 6 },
        ],
      })
      .expect(404);
    expect(
      (await prisma!.productImage.findUnique({ where: { id: rows[0]!.id } }))!
        .position,
    ).toBe(rows[0]!.position);
    await auth(
      request(server()).patch(
        `/api/v1/admin/products/${productId}/images/${target.body.id}`,
      ),
    )
      .send({ altHy: "Նոր", primary: true })
      .expect(200);
    const persisted = await prisma!.productImage.findUniqueOrThrow({
      where: { id: target.body.id },
      include: { translations: true },
    });
    expect(persisted.primary).toBe(true);
    expect(persisted.translations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locale: "HY", altText: "Նոր" }),
        expect.objectContaining({ locale: "RU", altText: "Keep persisted RU" }),
      ]),
    );
    const primaries = await prisma!.productImage.findMany({
      where: { productId, primary: true },
    });
    expect(primaries.map((image) => image.id)).toEqual([target.body.id]);
    await auth(
      request(server()).delete(
        `/api/v1/admin/products/${productId}/images/${target.body.id}`,
      ),
    ).expect(204);
    expect(await readdir(uploads!)).toHaveLength((rows.length - 1) * 4);
  });
  it("preserves brand link safety against a simultaneous product create/delete", async () => {
    for (let iteration = 0; iteration < 3; iteration++) {
      const brand = await auth(request(server()).post("/api/v1/admin/brands"))
        .send({
          slug: `race-${iteration}`,
          name: "Race",
          translations: [{ locale: "HY", name: "Race" }],
        })
        .expect(201);
      const [product, deletion] = await Promise.all([
        auth(request(server()).post("/api/v1/admin/products")).send(
          productInput(`RACE-${iteration}`, { brandId: brand.body.id }),
        ),
        auth(request(server()).delete(`/api/v1/admin/brands/${brand.body.id}`)),
      ]);
      expect([201, 409]).toContain(product.status);
      expect([204, 409]).toContain(deletion.status);
      expect(product.status === 201 && deletion.status === 204).toBe(false);
    }
  });
});
