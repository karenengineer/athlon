import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

export interface SitemapInventory {
  productSlugs: string[];
  categorySlugs: string[];
}

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService) {}

  async sitemapInventory(): Promise<SitemapInventory> {
    const [products, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: { published: true },
        select: { slug: true },
      }),
      this.prisma.category.findMany({
        where: { parentId: null, published: true },
        select: {
          slug: true,
          children: {
            where: { published: true },
            select: { slug: true },
          },
        },
      }),
    ]);

    return {
      productSlugs: [
        ...new Set(products.map((product) => product.slug)),
      ].sort(),
      categorySlugs: [
        ...new Set(
          categories.flatMap((category) => [
            category.slug,
            ...category.children.map((child) => child.slug),
          ]),
        ),
      ].sort(),
    };
  }
}
