import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";

@Injectable()
export class AdminBrandsService {
  constructor(private readonly prisma: PrismaService) {}
  list(): Promise<unknown[]> {
    return this.prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: { translations: true },
    });
  }
  create(input: CreateBrandDto): Promise<unknown> {
    return this.prisma.brand.create({
      data: {
        slug: input.slug,
        name: input.name,
        logoKey: input.logoKey ?? null,
        published: input.published,
        translations: { create: input.translations },
      },
      include: { translations: true },
    });
  }
  async update(id: string, input: UpdateBrandDto): Promise<unknown> {
    await this.ensureExists(id);
    const { translations, ...fields } = input;
    return this.prisma.brand.update({
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
  }
  async delete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.brand.delete({ where: { id } });
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
