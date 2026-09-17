import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import sharp, { Metadata } from "sharp";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { rethrowCatalogConflict } from "../common/admin-list";
import { STORAGE_ADAPTER, StorageAdapter } from "../storage/storage-adapter";
import { ReorderImagesDto } from "./dto/reorder-images.dto";
import { UpdateImageDto } from "./dto/update-image.dto";
import { UploadImageFieldsDto } from "./dto/upload-image-fields.dto";

// Bound four concurrent raster pipelines on the 2GB host. No animated inputs.
const rasterOptions = {
  failOn: "error" as const,
  limitInputPixels: 16_000_000,
};

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async upload(
    productId: string,
    file: Express.Multer.File | undefined,
    fields: UploadImageFieldsDto,
  ): Promise<unknown> {
    if (!file) throw new BadRequestException("Image file is required");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      throw new BadRequestException("Unsupported image type");
    }
    if (file.size > this.config.get<number>("MAX_UPLOAD_BYTES", 5_242_880)) {
      throw new BadRequestException("Image is too large");
    }
    if (
      !(await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException("Product not found");
    }

    let metadata: Metadata;
    try {
      metadata = await sharp(file.buffer, rasterOptions).metadata();
    } catch {
      throw new BadRequestException("Invalid image content");
    }
    if (
      !metadata.width ||
      !metadata.height ||
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      file.mimetype !== `image/${metadata.format}` ||
      metadata.width > 8192 ||
      metadata.height > 8192 ||
      metadata.width * metadata.height > 16_000_000 ||
      (metadata.pages ?? 1) > 1
    ) {
      throw new BadRequestException("Invalid image content");
    }

    const id = randomUUID();
    const keys = {
      original: `${id}-original.webp`,
      thumbnail: `${id}-thumbnail.webp`,
      card: `${id}-card.webp`,
      detail: `${id}-detail.webp`,
    };
    const base = sharp(file.buffer, rasterOptions).rotate();
    const [original, thumbnail, card, detail] = await Promise.all([
      base
        .clone()
        .resize({ width: 2000, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer(),
      base
        .clone()
        .resize({
          width: 240,
          height: 240,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer(),
      base
        .clone()
        .resize({
          width: 640,
          height: 640,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 84 })
        .toBuffer(),
      base
        .clone()
        .resize({
          width: 1400,
          height: 1400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 88 })
        .toBuffer(),
    ]).catch(() => {
      throw new BadRequestException("Invalid image content");
    });
    const entries = [
      [keys.original, original],
      [keys.thumbnail, thumbnail],
      [keys.card, card],
      [keys.detail, detail],
    ] as const;
    try {
      const writes = await Promise.allSettled(
        entries.map(([key, buffer]) => this.storage.put(key, buffer)),
      );
      const failedWrite = writes.find((write) => write.status === "rejected");
      if (failedWrite?.status === "rejected") throw failedWrite.reason;
      return await this.prisma.$transaction(
        async (tx) => {
          const last = await tx.productImage.aggregate({
            where: { productId },
            _max: { position: true },
          });
          if (fields.primary === "true")
            await tx.productImage.updateMany({
              where: { productId },
              data: { primary: false },
            });
          return tx.productImage.create({
            data: {
              productId,
              originalKey: keys.original,
              thumbnailKey: keys.thumbnail,
              cardKey: keys.card,
              detailKey: keys.detail,
              mimeType: "image/webp",
              width: metadata.width,
              height: metadata.height,
              sizeBytes: original.length,
              primary: fields.primary === "true",
              position: (last._max.position ?? -1) + 1,
              translations: {
                create: [
                  { locale: "RU", altText: fields.altRu },
                  ...(fields.altHy
                    ? [{ locale: "HY" as const, altText: fields.altHy }]
                    : []),
                  ...(fields.altEn
                    ? [{ locale: "EN" as const, altText: fields.altEn }]
                    : []),
                ],
              },
            },
            include: { translations: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      await Promise.allSettled(
        entries.map(([key]) => this.storage.delete(key)),
      );
      rethrowCatalogConflict(error);
    }
  }

  async reorder(productId: string, input: ReorderImagesDto): Promise<void> {
    if (
      new Set(input.images.map((image) => image.id)).size !==
        input.images.length ||
      new Set(input.images.map((image) => image.position)).size !==
        input.images.length
    )
      throw new BadRequestException("Duplicate image IDs or positions");
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const images = await tx.productImage.findMany({
            where: {
              productId,
              id: { in: input.images.map((image) => image.id) },
            },
            select: { id: true },
          });
          if (images.length !== input.images.length)
            throw new NotFoundException("Image not found");
          for (const image of input.images)
            await tx.productImage.update({
              where: { id: image.id, productId },
              data: { position: image.position },
            });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      rethrowCatalogConflict(error);
    }
  }

  async update(
    productId: string,
    imageId: string,
    input: UpdateImageDto,
  ): Promise<unknown> {
    const translations = [
      ...(input.altRu !== undefined
        ? [{ locale: "RU" as const, altText: input.altRu }]
        : []),
      ...(input.altHy !== undefined
        ? [{ locale: "HY" as const, altText: input.altHy }]
        : []),
      ...(input.altEn !== undefined
        ? [{ locale: "EN" as const, altText: input.altEn }]
        : []),
    ];
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const image = await tx.productImage.findUnique({
            where: { id: imageId },
          });
          if (!image || image.productId !== productId)
            throw new NotFoundException("Image not found");
          if (input.primary)
            await tx.productImage.updateMany({
              where: { productId },
              data: { primary: false },
            });
          return tx.productImage.update({
            where: { id: imageId },
            data: {
              ...(input.primary !== undefined
                ? { primary: input.primary }
                : {}),
              ...(translations.length
                ? {
                    translations: {
                      upsert: translations.map((item) => ({
                        where: {
                          productImageId_locale: {
                            productImageId: imageId,
                            locale: item.locale,
                          },
                        },
                        create: item,
                        update: item,
                      })),
                    },
                  }
                : {}),
            },
            include: { translations: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      rethrowCatalogConflict(error);
    }
  }

  async delete(productId: string, imageId: string): Promise<void> {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });
    if (!image || image.productId !== productId)
      throw new NotFoundException("Image not found");
    await this.prisma.productImage.delete({ where: { id: imageId } });
    await Promise.allSettled(
      [
        image.originalKey,
        image.thumbnailKey,
        image.cardKey,
        image.detailKey,
      ].map((key) => this.storage.delete(key)),
    );
  }

  read(filename: string): Promise<Buffer> {
    return this.storage.read(filename);
  }
}
