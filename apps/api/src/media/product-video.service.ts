import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { STORAGE_ADAPTER, StorageAdapter } from "../storage/storage-adapter";
import { productVideoMetadata } from "./product-video";
import { VideoProcessor } from "./video-processor";

@Injectable()
export class ProductVideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: VideoProcessor,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async upload(productId: string, file: Express.Multer.File | undefined) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: true },
    });
    if (!product) throw new NotFoundException("Product not found");
    if (!product.images.length)
      throw new BadRequestException(
        "Add a cover image before uploading a video",
      );
    const processed = await this.processor.process(file);
    const id = randomUUID();
    const data = {
      desktopKey: `${id}-preview-desktop.mp4`,
      mobileKey: `${id}-preview-mobile.mp4`,
      durationSeconds: processed.durationSeconds,
      sizeBytes: processed.desktop.length,
      mobileSizeBytes: processed.mobile.length,
    };
    try {
      await this.storage.put(data.desktopKey, processed.desktop);
      await this.storage.put(data.mobileKey, processed.mobile);
      const previous = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId}::uuid FOR UPDATE`;
        const current = await tx.product.findUnique({
          where: { id: productId },
          include: { images: true, video: true },
        });
        if (!current) throw new NotFoundException("Product not found");
        if (!current.images.length)
          throw new BadRequestException(
            "Add a cover image before uploading a video",
          );
        await tx.productVideo.upsert({
          where: { productId },
          create: { productId, ...data },
          update: data,
        });
        return current.video;
      });
      if (previous) await this.deleteFiles(previous);
      return productVideoMetadata(data);
    } catch (error) {
      await this.deleteFiles(data);
      throw error;
    }
  }

  async remove(productId: string): Promise<void> {
    const previous = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId}::uuid FOR UPDATE`;
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { video: true },
      });
      if (!product) throw new NotFoundException("Product not found");
      await tx.productVideo.deleteMany({ where: { productId } });
      return product.video;
    });
    if (previous) await this.deleteFiles(previous);
  }

  private async deleteFiles(video: { desktopKey: string; mobileKey: string }) {
    await Promise.allSettled([
      this.storage.delete(video.desktopKey),
      this.storage.delete(video.mobileKey),
    ]);
  }
}
