import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { parseLocale, selectTranslation } from "../common/localization/locale";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(localeValue?: string): Promise<unknown[]> {
    const locale = parseLocale(localeValue);
    const categories = await this.prisma.category.findMany({
      where: { parentId: null, published: true },
      orderBy: [{ displayOrder: "asc" }, { slug: "asc" }],
      include: {
        translations: true,
        children: {
          where: { published: true },
          orderBy: [{ displayOrder: "asc" }, { slug: "asc" }],
          include: { translations: true },
        },
      },
    });
    return categories.map((category) => {
      const translation = selectTranslation(category.translations, locale);
      return {
        id: category.id,
        code: category.code,
        slug: category.slug,
        name: translation?.name ?? category.code,
        description: translation?.description ?? null,
        displayOrder: category.displayOrder,
        children: category.children.map((child) => {
          const childTranslation = selectTranslation(
            child.translations,
            locale,
          );
          return {
            id: child.id,
            code: child.code,
            slug: child.slug,
            name: childTranslation?.name ?? child.code,
            description: childTranslation?.description ?? null,
            displayOrder: child.displayOrder,
          };
        }),
      };
    });
  }
}
