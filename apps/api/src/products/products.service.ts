import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { Locale } from "../generated/prisma/enums";
import { parseLocale, selectTranslation } from "../common/localization/locale";
import { PrismaService } from "../database/prisma.service";
import { ProductQueryDto } from "./dto/product-query.dto";

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(query: ProductQueryDto): Promise<unknown> {
    const locale = parseLocale(query.locale);
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 24, 48);
    const where: Prisma.ProductWhereInput = {
      published: true,
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.brand ? { brand: { slug: query.brand } } : {}),
      ...(query.availability ? { availability: query.availability } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            price: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            translations: {
              some: { name: { contains: query.q, mode: "insensitive" } },
            },
          }
        : {}),
    };
    const orderBy = this.orderBy(query.sort);
    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: this.publicInclude(),
      }),
    ]);
    return {
      items: products.map((product) => this.toPublicProduct(product, locale)),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async listFeatured(locale?: string): Promise<unknown[]> {
    return this.listFlagged("featured", locale);
  }

  async listNew(locale?: string): Promise<unknown[]> {
    return this.listFlagged("isNew", locale);
  }

  async detail(slug: string, localeValue?: string): Promise<unknown> {
    const locale = parseLocale(localeValue);
    const product = await this.prisma.product.findFirst({
      where: { slug, published: true },
      include: this.publicInclude(),
    });
    if (!product) throw new NotFoundException("Product not found");
    return this.toPublicProduct(product, locale, true);
  }

  async suggestions(q: string, localeValue?: string): Promise<unknown[]> {
    const locale = parseLocale(localeValue);
    if (q.trim().length < 2) return [];
    const products = await this.prisma.product.findMany({
      where: {
        published: true,
        translations: {
          some: { name: { contains: q.trim(), mode: "insensitive" } },
        },
      },
      take: 8,
      orderBy: [{ displayOrder: "asc" }, { slug: "asc" }],
      include: { translations: true },
    });
    return products.map((product) => ({
      slug: product.slug,
      name:
        selectTranslation<any>(product.translations, locale)?.name ??
        product.slug,
    }));
  }

  private async listFlagged(
    flag: "featured" | "isNew",
    localeValue?: string,
  ): Promise<unknown[]> {
    const locale = parseLocale(localeValue);
    const products = await this.prisma.product.findMany({
      where: { published: true, [flag]: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      take: 12,
      include: this.publicInclude(),
    });
    return products.map((product) => this.toPublicProduct(product, locale));
  }

  private publicInclude(): Prisma.ProductInclude {
    return {
      translations: true,
      category: { include: { translations: true } },
      brand: { include: { translations: true } },
      images: { orderBy: { position: "asc" }, include: { translations: true } },
    };
  }

  private orderBy(
    sort: ProductQueryDto["sort"],
  ): Prisma.ProductOrderByWithRelationInput[] {
    if (sort === "priceAsc") return [{ price: "asc" }, { displayOrder: "asc" }];
    if (sort === "priceDesc")
      return [{ price: "desc" }, { displayOrder: "asc" }];
    if (sort === "newest") return [{ createdAt: "desc" }];
    return [{ displayOrder: "asc" }, { createdAt: "desc" }];
  }

  private toPublicProduct(
    product: any,
    locale: Locale,
    detailed = false,
  ): unknown {
    const translation = selectTranslation<any>(product.translations, locale);
    const categoryTranslation = selectTranslation<any>(
      product.category.translations,
      locale,
    );
    const brandTranslation = product.brand
      ? selectTranslation<any>(product.brand.translations, locale)
      : undefined;
    const images = product.images as Array<{
      id: string;
      thumbnailKey: string;
      cardKey: string;
      detailKey: string;
      translations: Array<{ locale: Locale; altText: string }>;
      primary: boolean;
    }>;
    return {
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      name: translation?.name ?? product.slug,
      shortDescription: translation?.shortDescription ?? null,
      ...(detailed ? { description: translation?.description ?? null } : {}),
      price: product.price === null ? null : String(product.price),
      currency: product.currency,
      availability: product.availability,
      featured: product.featured,
      isNew: product.isNew,
      ...(detailed ? { characteristics: product.characteristics } : {}),
      category: {
        slug: product.category.slug,
        name: categoryTranslation?.name ?? product.category.slug,
      },
      brand: product.brand
        ? {
            slug: product.brand.slug,
            name: brandTranslation?.name ?? product.brand.name,
          }
        : null,
      images: images.map((image) => ({
        id: image.id,
        thumbnailUrl: `/api/v1/media/${image.thumbnailKey}`,
        cardUrl: `/api/v1/media/${image.cardKey}`,
        detailUrl: `/api/v1/media/${image.detailKey}`,
        alt:
          selectTranslation(image.translations, locale)?.altText ??
          translation?.name ??
          product.slug,
        primary: image.primary,
      })),
    };
  }
}
