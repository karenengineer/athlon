import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { AdminProductQueryDto } from "./dto/admin-product-query.dto";
import {
  adminListEnvelope,
  adminListOffset,
  adminNamePage,
  adminOrderedListEnvelope,
  rethrowCatalogConflict,
} from "../common/admin-list";

@Injectable()
export class AdminProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminProductQueryDto): Promise<unknown> {
    const skip = adminListOffset(query);
    const where: Prisma.ProductWhereInput = {
      ...(query.published !== undefined ? { published: query.published } : {}),
      ...(query.featured !== undefined ? { featured: query.featured } : {}),
      ...(query.isNew !== undefined ? { isNew: query.isNew } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(query.availability ? { availability: query.availability } : {}),
      ...(query.q
        ? {
            OR: [
              { sku: { contains: query.q, mode: "insensitive" } },
              { slug: { contains: query.q, mode: "insensitive" } },
              {
                translations: {
                  some: { name: { contains: query.q, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    };
    const include = {
      translations: true,
      category: true,
      brand: true,
      images: true,
    } as const;
    if (query.sort === "name") {
      const [total, keys] = await Promise.all([
        this.prisma.product.count({ where }),
        this.prisma.product.findMany({
          where,
          select: {
            id: true,
            translations: { select: { locale: true, name: true } },
          },
        }),
      ]);
      const ids = adminNamePage(keys, query);
      const items = ids.length
        ? await this.prisma.product.findMany({
            where: { ...where, id: { in: ids } },
            include,
          })
        : [];
      return adminOrderedListEnvelope(ids, items, total, query);
    }
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === "priceAsc"
        ? [{ price: "asc" }, { id: "asc" }]
        : query.sort === "priceDesc"
          ? [{ price: "desc" }, { id: "asc" }]
          : query.sort === "updated"
            ? [{ updatedAt: "desc" }, { id: "asc" }]
            : [{ displayOrder: "asc" }, { updatedAt: "desc" }, { id: "asc" }];
    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy,
        include,
      }),
    ]);
    return adminListEnvelope(items, total, query);
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

  async create(input: CreateProductDto): Promise<unknown> {
    try {
      return await this.prisma.product.create({
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
    } catch (error) {
      rethrowProductWriteConflict(error);
    }
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
    try {
      return await this.prisma.product.update({
        where: { id },
        data,
        include: { translations: true },
      });
    } catch (error) {
      rethrowProductWriteConflict(error);
    }
  }

  async setPublished(id: string, published: boolean): Promise<unknown> {
    await this.ensureExists(id);
    return this.prisma.product.update({ where: { id }, data: { published } });
  }

  async delete(id: string): Promise<void> {
    await this.ensureExists(id);
    try {
      await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      rethrowCatalogConflict(error);
    }
  }

  private async ensureExists(id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!product) throw new NotFoundException("Product not found");
  }
}

// Product create/PATCH only: do not expose ORM constraint names or identifiers.
function rethrowProductWriteConflict(error: unknown): never {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  )
    throw new ConflictException(
      "A product with this SKU or slug already exists",
    );
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2025"
  )
    throw new ConflictException(
      "Product or category/brand link changed; reload before saving",
    );
  rethrowCatalogConflict(error);
}
