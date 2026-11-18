import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { StorageAdapter } from "../storage/storage-adapter";
import { ProductVideoService } from "./product-video.service";
import { VideoProcessor } from "./video-processor";

describe("product video persistence", () => {
  const id = "24d3f1a3-8413-4bc6-b32d-437871a22b54";
  const prior = { desktopKey: "old-desktop", mobileKey: "old-mobile" };
  const file = { buffer: Buffer.from("fixture") } as Express.Multer.File;
  const storage = { put: jest.fn(), delete: jest.fn() };
  const processor = { process: jest.fn() };
  let product: {
    id: string;
    images: object[];
    video: typeof prior | null;
  } | null;
  const prisma = {
    product: { findUnique: jest.fn(() => Promise.resolve(product)) },
    productVideo: { upsert: jest.fn(), deleteMany: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(
      (operation: (tx: unknown) => unknown): Promise<unknown> =>
        Promise.resolve(operation(prisma)),
    ),
  };
  const service = new ProductVideoService(
    prisma as unknown as PrismaService,
    processor as unknown as VideoProcessor,
    storage as unknown as StorageAdapter,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    product = { id, images: [{}], video: prior };
    prisma.product.findUnique.mockImplementation(() =>
      Promise.resolve(product),
    );
    prisma.$transaction.mockImplementation((operation) =>
      Promise.resolve(operation(prisma)),
    );
    processor.process.mockResolvedValue({
      desktop: Buffer.from("desktop"),
      mobile: Buffer.from("mobile"),
      durationSeconds: 3,
    });
  });

  it("requires an existing cover before processing or writing files", async () => {
    product!.images = [];
    await expect(service.upload(id, file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(processor.process).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("swaps both variants atomically before deleting the previous files", async () => {
    const result = await service.upload(id, file);
    expect(result).toMatchObject({
      durationSeconds: 3,
      mimeType: "video/mp4",
      sizeBytes: 7,
      mobileSizeBytes: 6,
    });
    expect(result!.url).toMatch(/preview-desktop\.mp4$/);
    expect(result!.mobileUrl).toMatch(/preview-mobile\.mp4$/);
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(storage.delete.mock.calls.map(([key]) => key)).toEqual([
      prior.desktopKey,
      prior.mobileKey,
    ]);
    expect(prisma.productVideo.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      storage.delete.mock.invocationCallOrder[0]!,
    );
  });

  it("rechecks the cover after acquiring the product lock", async () => {
    prisma.product.findUnique
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce({ ...product!, images: [] });
    await expect(service.upload(id, file)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.productVideo.upsert).not.toHaveBeenCalled();
    expect(storage.delete.mock.calls).toHaveLength(2);
    expect(storage.delete.mock.calls.flat()).not.toContain(prior.desktopKey);
  });

  it("keeps prior files and cleans both new files if the database swap fails", async () => {
    prisma.productVideo.upsert.mockRejectedValueOnce(
      new Error("transaction failed"),
    );
    await expect(service.upload(id, file)).rejects.toThrow(
      "transaction failed",
    );
    expect(storage.delete.mock.calls).toHaveLength(2);
    expect(storage.delete.mock.calls.flat()).not.toContain(prior.desktopKey);
  });

  it("cleans files even if the second storage write fails", async () => {
    storage.put
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("disk full"));
    await expect(service.upload(id, file)).rejects.toThrow("disk full");
    expect(storage.delete.mock.calls).toHaveLength(2);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("makes removal idempotent and deletes references before files", async () => {
    await service.remove(id);
    expect(prisma.productVideo.deleteMany).toHaveBeenCalledWith({
      where: { productId: id },
    });
    expect(storage.delete.mock.calls.flat()).toEqual([
      prior.desktopKey,
      prior.mobileKey,
    ]);
    storage.delete.mockClear();
    product!.video = null;
    await service.remove(id);
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
