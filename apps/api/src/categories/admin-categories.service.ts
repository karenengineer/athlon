import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { Prisma } from "../generated/prisma/client";
import { AdminListQueryDto } from "../common/dto/admin-list-query.dto";
import {
  adminListEnvelope,
  adminListOffset,
  adminNamePage,
  rethrowCatalogConflict,
} from "../common/admin-list";

@Injectable()
export class AdminCategoriesService {
  constructor(private readonly prisma: PrismaService) {}
  async list(query: AdminListQueryDto): Promise<unknown> {
    const skip = adminListOffset(query);
    const where: Prisma.CategoryWhereInput = {
      ...(query.published !== undefined ? { published: query.published } : {}),
      ...(query.q
        ? {
            OR: [
              { code: { contains: query.q, mode: "insensitive" } },
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
        this.prisma.category.count({ where }),
        this.prisma.category.findMany({
          where,
          select: {
            id: true,
            translations: { select: { locale: true, name: true } },
          },
        }),
      ]);
      const ids = adminNamePage(keys, query);
      const items = ids.length
        ? await this.prisma.category.findMany({
            where: { ...where, id: { in: ids } },
            include: { translations: true },
          })
        : [];
      const byId = new Map(items.map((item) => [item.id, item]));
      return adminListEnvelope(
        ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
        total,
        query,
      );
    }
    const orderBy: Prisma.CategoryOrderByWithRelationInput[] =
      query.sort === "updated"
        ? [{ updatedAt: "desc" }, { id: "asc" }]
        : [{ parentId: "asc" }, { displayOrder: "asc" }, { id: "asc" }];
    const [total, items] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
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
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!category) throw new NotFoundException("Category not found");
    return category;
  }
  async create(input: CreateCategoryDto): Promise<unknown> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          if (
            !input.parentId &&
            (await tx.category.count({ where: { parentId: null } })) >= 2
          ) {
            throw new ConflictException(
              "Only two top-level categories are allowed",
            );
          }
          if (input.parentId) await this.ensureParent(tx, input.parentId);
          return tx.category.create({
            data: {
              code: input.code,
              slug: input.slug,
              parentId: input.parentId ?? null,
              published: input.published,
              displayOrder: input.displayOrder,
              translations: { create: input.translations },
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
  async update(id: string, input: UpdateCategoryDto): Promise<unknown> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.category.findUnique({
            where: { id },
            select: { id: true, parentId: true },
          });
          if (!current) throw new NotFoundException("Category not found");
          if (
            input.parentId === null &&
            current.parentId !== null &&
            (await tx.category.count({ where: { parentId: null } })) >= 2
          ) {
            throw new ConflictException(
              "Only two top-level categories are allowed",
            );
          }
          if (input.parentId) {
            const seen = new Set([id]);
            let parentId: string | null = input.parentId;
            while (parentId) {
              if (seen.has(parentId))
                throw new ConflictException("Category cycles are not allowed");
              seen.add(parentId);
              const parent = await this.ensureParent(tx, parentId);
              parentId = parent.parentId;
            }
          }
          const { translations, ...fields } = input;
          return tx.category.update({
            where: { id },
            data: {
              ...fields,
              ...(translations
                ? {
                    translations: {
                      upsert: translations.map((item) => ({
                        where: {
                          categoryId_locale: {
                            categoryId: id,
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
  async delete(id: string): Promise<void> {
    await this.ensureExists(id);
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      rethrowCatalogConflict(error);
    }
  }
  private async ensureParent(tx: Prisma.TransactionClient, id: string) {
    const parent = await tx.category.findUnique({
      where: { id },
      select: { id: true, parentId: true },
    });
    if (!parent) throw new NotFoundException("Parent category not found");
    return parent;
  }
  private async ensureExists(id: string): Promise<void> {
    if (
      !(await this.prisma.category.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Category not found");
  }
}
