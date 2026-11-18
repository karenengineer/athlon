import { BadRequestException, INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { Readable } from "node:stream";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApplication } from "../src/bootstrap";
import { PrismaService } from "../src/database/prisma.service";
import { VideoProcessor } from "../src/media/video-processor";
import { STORAGE_ADAPTER } from "../src/storage/storage-adapter";

const productId = "24d3f1a3-8413-4bc6-b32d-437871a22b54";
const imageId = "34d3f1a3-8413-4bc6-b32d-437871a22b54";
const key = "24d3f1a3-8413-4bc6-b32d-437871a22b54-preview-desktop.mp4";

describe("Product preview video HTTP", () => {
  let app: INestApplication;
  let token: string;
  let video: {
    desktopKey: string;
    mobileKey: string;
    durationSeconds: number;
    sizeBytes: number;
    mobileSizeBytes: number;
  } | null;
  const data = Buffer.from("0123456789");
  const files = new Map<string, Buffer>();
  const storage = {
    put: jest.fn((key: string, buffer: Buffer) => {
      files.set(key, buffer);
      return Promise.resolve();
    }),
    delete: jest.fn((key: string) => {
      files.delete(key);
      return Promise.resolve();
    }),
    read: jest.fn((key: string) => Promise.resolve(files.get(key))),
    stat: jest.fn((key: string) =>
      Promise.resolve({ size: files.get(key)!.length }),
    ),
    stream: jest.fn((key: string, range?: { start: number; end: number }) =>
      Readable.from(
        range
          ? files.get(key)!.subarray(range.start, range.end + 1)
          : files.get(key)!,
      ),
    ),
  };
  const processor = { process: jest.fn() };
  const prisma = {
    product: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          id: productId,
          images: [{ id: imageId }],
          video,
        }),
      ),
    },
    productImage: {
      findUnique: jest.fn(() => Promise.resolve({ id: imageId, productId })),
      count: jest.fn(() => Promise.resolve(1)),
      delete: jest.fn(),
    },
    productVideo: {
      upsert: jest.fn(({ create }: { create: NonNullable<typeof video> }) => {
        video = create;
        return Promise.resolve(video);
      }),
      deleteMany: jest.fn(() => {
        video = null;
        return Promise.resolve({ count: 1 });
      }),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(
      (operation: (tx: unknown) => unknown): Promise<unknown> =>
        Promise.resolve(operation(prisma)),
    ),
  };
  beforeAll(async () => {
    token = await new JwtService().signAsync(
      {
        sub: productId,
        role: "ADMIN",
        type: "access",
        email: "admin@athlon.test",
      },
      {
        secret: "test-access-secret-with-at-least-32-characters",
        expiresIn: 900,
      },
    );
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(STORAGE_ADAPTER)
      .useValue(storage)
      .overrideProvider(VideoProcessor)
      .useValue(processor)
      .compile();
    app = configureApplication(module.createNestApplication());
    await app.init();
  });
  afterAll(async () => app?.close());
  beforeEach(() => {
    jest.clearAllMocks();
    files.clear();
    files.set(key, data);
    video = {
      desktopKey: key,
      mobileKey: key.replace("desktop", "mobile"),
      durationSeconds: 3,
      sizeBytes: 10,
      mobileSizeBytes: 5,
    };
    processor.process.mockResolvedValue({
      desktop: Buffer.from("desktop"),
      mobile: Buffer.from("mobile"),
      durationSeconds: 3,
    });
  });
  const auth = (r: request.Test) =>
    r
      .set("Cookie", [`athlon_access=${token}`, "athlon_csrf=video-fixture"])
      .set("x-csrf-token", "video-fixture");
  const upload = () =>
    auth(
      request(app.getHttpServer()).put(
        `/api/v1/admin/products/${productId}/video`,
      ),
    );

  it("rejects anonymous and CSRF-free video uploads and removals", async () => {
    await request(app.getHttpServer())
      .put(`/api/v1/admin/products/${productId}/video`)
      .expect(401);
    await request(app.getHttpServer())
      .put(`/api/v1/admin/products/${productId}/video`)
      .set("Cookie", `athlon_access=${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/products/${productId}/video`)
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/products/${productId}/video`)
      .set("Cookie", `athlon_access=${token}`)
      .expect(403);
    expect(processor.process).not.toHaveBeenCalled();
  });
  it("returns normalized variant metadata on upload and removes it", async () => {
    const result = await upload()
      .attach("file", Buffer.from("mock video"), {
        filename: "preview.mp4",
        contentType: "video/mp4",
      })
      .expect(200);
    expect(result.body).toMatchObject({
      mimeType: "video/mp4",
      durationSeconds: 3,
      sizeBytes: 7,
      mobileSizeBytes: 6,
    });
    expect(result.body.mobileUrl).toMatch(/preview-mobile\.mp4$/);
    await auth(
      request(app.getHttpServer()).delete(
        `/api/v1/admin/products/${productId}/video`,
      ),
    ).expect(204);
    expect(video).toBeNull();
  });
  it("preserves the existing video when content validation fails", async () => {
    processor.process.mockRejectedValueOnce(
      new BadRequestException("Invalid video content"),
    );
    await upload()
      .attach("file", Buffer.from("not a video"), {
        filename: "fake.mp4",
        contentType: "video/mp4",
      })
      .expect(400);
    expect(video!.desktopKey).toBe(key);
    expect(storage.put).not.toHaveBeenCalled();
  });
  it("requires a cover while a video remains attached", async () => {
    await auth(
      request(app.getHttpServer()).delete(
        `/api/v1/admin/products/${productId}/images/${imageId}`,
      ),
    ).expect(400);
    expect(prisma.productImage.delete).not.toHaveBeenCalled();
  });
  it("streams exact byte ranges without reading the entire video into memory", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/media/${key}`)
      .set("Range", "bytes=2-5")
      .expect(206)
      .expect("Content-Type", "video/mp4")
      .expect("Content-Range", "bytes 2-5/10")
      .expect("Content-Length", "4")
      .expect("Accept-Ranges", "bytes");
    expect(response.body).toEqual(Buffer.from("2345"));
    expect(storage.read).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get(`/api/v1/media/${key}`)
      .set("Range", "bytes=20-")
      .expect(416)
      .expect("Content-Range", "bytes */10");
    expect(storage.stream).toHaveBeenCalledTimes(1);
  });
});
