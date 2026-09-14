import { Injectable } from "@nestjs/common";
import { parseLocale, selectTranslation } from "../common/localization/locale";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(localeValue?: string): Promise<unknown[]> {
    const locale = parseLocale(localeValue);
    const brands = await this.prisma.brand.findMany({
      where: { published: true },
      orderBy: { name: "asc" },
      include: { translations: true },
    });
    return brands.map((brand) => {
      const translation = selectTranslation(brand.translations, locale);
      return {
        id: brand.id,
        slug: brand.slug,
        name: translation?.name ?? brand.name,
        description: translation?.description ?? null,
        logoUrl: brand.logoKey ? `/api/v1/media/${brand.logoKey}` : null,
      };
    });
  }
}
