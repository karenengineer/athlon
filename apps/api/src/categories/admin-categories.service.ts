import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class AdminCategoriesService {
  constructor(private readonly prisma: PrismaService) {}
  list(): Promise<unknown[]> {
    return this.prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { displayOrder: "asc" }],
      include: { translations: true },
    });
  }
  async create(input: CreateCategoryDto): Promise<unknown> {
    if (
      !input.parentId &&
      (await this.prisma.category.count({ where: { parentId: null } })) >= 2
    ) {
      throw new ConflictException("Only two top-level categories are allowed");
    }
    return this.prisma.category.create({
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
  }
  async update(id: string, input: UpdateCategoryDto): Promise<unknown> {
    await this.ensureExists(id);
    const { translations, ...fields } = input;
    return this.prisma.category.update({
      where: { id },
      data: {
        ...fields,
        ...(translations
          ? {
              translations: {
                upsert: translations.map((item) => ({
                  where: {
                    categoryId_locale: { categoryId: id, locale: item.locale },
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
  }
  async delete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.category.delete({ where: { id } });
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
