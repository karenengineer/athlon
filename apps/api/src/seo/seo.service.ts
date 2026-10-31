import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

export interface SitemapEntry {
  slug: string;
  updatedAt: string;
}

export interface SitemapInventory {
  productSlugs: string[];
  categorySlugs: string[];
}

const uniqueEntries = (
  records: readonly { slug: string; updatedAt: Date }[],
): SitemapEntry[] =>
  [...new Map(records.map((record) => [record.slug, record])).values()]
    .map(({ slug, updatedAt }) => ({
      slug,
      updatedAt: updatedAt.toISOString(),
    }))
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

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
          updatedAt: true,
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
