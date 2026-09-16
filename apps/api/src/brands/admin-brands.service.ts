import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";
import { Prisma } from "../generated/prisma/client";
import { AdminListQueryDto } from "../common/dto/admin-list-query.dto";
import {
  adminListEnvelope,
  adminListOffset,
  adminNamePage,
  adminOrderedListEnvelope,
  rethrowCatalogConflict,
  rethrowCategoryBrandWriteConflict,
} from "../common/admin-list";

@Injectable()
export class AdminBrandsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(query: AdminListQueryDto): Promise<unknown> {
    const skip = adminListOffset(query);
    const where: Prisma.BrandWhereInput = {
      ...(query.published !== undefined ? { published: query.published } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
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
    if (query.sort === "name") {
      const [total, keys] = await Promise.all([
        this.prisma.brand.count({ where }),
        this.prisma.brand.findMany({
          where,
          select: {
            id: true,
            name: true,
            translations: { select: { locale: true, name: true } },
          },
        }),
      ]);
      const ids = adminNamePage(keys, query);
      const items = ids.length
        ? await this.prisma.brand.findMany({
            where: { ...where, id: { in: ids } },
            include: { translations: true },
          })
        : [];
      return adminOrderedListEnvelope(ids, items, total, query);
    }
    const orderBy: Prisma.BrandOrderByWithRelationInput[] =
      query.sort === "updated"
        ? [{ updatedAt: "desc" }, { id: "asc" }]
        : [{ name: "asc" }, { id: "asc" }];
    const [total, items] = await Promise.all([
      this.prisma.brand.count({ where }),
      this.prisma.brand.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy,
        include: { translations: true },
      }),
    ]);
    return adminListEnvelope(items, total, query);
  }
  async get(id: string): Promise<unknown> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!brand) throw new NotFoundException("Brand not found");
    return brand;
  }
  async create(input: CreateBrandDto): Promise<unknown> {
    try {
      return await this.prisma.brand.create({
        data: {
          slug: input.slug,
          name: input.name,
          logoKey: input.logoKey ?? null,
          published: input.published,
          translations: { create: input.translations },
        },
        include: { translations: true },
      });
    } catch (error) {
      rethrowCategoryBrandWriteConflict(error);
    }
  }
  async update(id: string, input: UpdateBrandDto): Promise<unknown> {
    await this.ensureExists(id);
    const { translations, ...fields } = input;
    try {
      return await this.prisma.brand.update({
        where: { id },
        data: {
          ...fields,
          ...(translations
            ? {
                translations: {
                  upsert: translations.map((item) => ({
                    where: {
                      brandId_locale: { brandId: id, locale: item.locale },
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
    } catch (error) {
      rethrowCategoryBrandWriteConflict(error);
    }
  }
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          if (
            !(await tx.brand.findUnique({
              where: { id },
              select: { id: true },
            }))
          )
            throw new NotFoundException("Brand not found");
          if ((await tx.product.count({ where: { brandId: id } })) > 0)
            throw new ConflictException("Brand is associated with products");
          await tx.brand.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      rethrowCatalogConflict(error);
    }
  }
  private async ensureExists(id: string): Promise<void> {
    if (
      !(await this.prisma.brand.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Brand not found");
  }
}
