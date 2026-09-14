import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, pageSize = 24): Promise<unknown> {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const currentPage = Math.max(page, 1);
    const [total, items] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.findMany({
        skip: (currentPage - 1) * take,
        take,
        orderBy: [{ displayOrder: "asc" }, { updatedAt: "desc" }],
        include: {
          translations: true,
          category: true,
          brand: true,
          images: true,
        },
      }),
    ]);
    return {
      items,
      meta: {
        page: currentPage,
        pageSize: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async get(id: string): Promise<unknown> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        translations: true,
        images: { include: { translations: true } },
      },
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  create(input: CreateProductDto): Promise<unknown> {
    return this.prisma.product.create({
      data: {
        sku: input.sku,
        slug: input.slug,
        categoryId: input.categoryId,
        ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
        price: input.price ?? null,
        currency: "AMD",
        availability: input.availability,
        characteristics: input.characteristics as Prisma.InputJsonValue,
        featured: input.featured,
        isNew: input.isNew,
        published: input.published,
        displayOrder: input.displayOrder,
        translations: { create: input.translations },
      },
      include: { translations: true },
    });
  }

  async update(id: string, input: UpdateProductDto): Promise<unknown> {
    await this.ensureExists(id);
    const { translations } = input;
    const data: Prisma.ProductUpdateInput = {
      ...(input.sku !== undefined ? { sku: input.sku } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.categoryId !== undefined
        ? { category: { connect: { id: input.categoryId } } }
        : {}),
      ...(input.brandId !== undefined
        ? input.brandId
          ? { brand: { connect: { id: input.brandId } } }
          : { brand: { disconnect: true } }
        : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.availability !== undefined
        ? { availability: input.availability }
        : {}),
      ...(input.characteristics !== undefined
        ? { characteristics: input.characteristics as Prisma.InputJsonValue }
        : {}),
      ...(input.featured !== undefined ? { featured: input.featured } : {}),
      ...(input.isNew !== undefined ? { isNew: input.isNew } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
      ...(input.displayOrder !== undefined
        ? { displayOrder: input.displayOrder }
        : {}),
      ...(translations
        ? {
            translations: {
              upsert: translations.map((translation) => ({
                where: {
                  productId_locale: {
                    productId: id,
                    locale: translation.locale,
                  },
                },
                create: translation,
                update: translation,
              })),
            },
          }
        : {}),
    };
    return this.prisma.product.update({
      where: { id },
      data,
      include: { translations: true },
    });
  }

  async setPublished(id: string, published: boolean): Promise<unknown> {
    await this.ensureExists(id);
    return this.prisma.product.update({ where: { id }, data: { published } });
  }

  async delete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.product.delete({ where: { id } });
  }

  private async ensureExists(id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product not found");
  }
}
